import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcryptjs';
import { Model, Types } from 'mongoose';
import type { RequestActor } from '../../../common/auth/auth.decorators';
import {
  ConflictActionException,
  DomainException,
  EntityNotFoundException,
  ForbiddenActionException,
} from '../../../common/exceptions/domain.exception';
import { containsRegex, iso, toObjectId } from '../../../common/utils/mongo';
import { normalizeEmail } from '../../../common/utils/text';
import type { AuthConfig } from '../../../config/configuration';
import type { AdminDto, Paginated } from '../../../contract/api';
import { AuditService } from '../../audit/audit.service';
import { CreateAdminDto, ResetAdminPasswordDto, UpdateAdminDto } from '../dto/iam.dto';
import { Admin, AdminDocument } from '../schemas/admin.schema';
import { AdminRole, AdminRoleDocument } from '../schemas/admin-role.schema';
import { RoleService } from './role.service';
import { ADMIN_PASSWORD_MIN_LENGTH } from '../password.policy';

interface ListQuery {
  page?: number;
  pageSize?: number;
  q?: string;
}

/** What `toDto` reads off an admin, whether the role is populated or not. */
type AdminShape = Pick<Admin, 'email' | 'name' | 'phone' | 'isOwner' | 'status' | 'lastLoginAt' | 'createdAt' | 'updatedAt'> & {
  _id: Types.ObjectId;
  guideId?: Types.ObjectId;
};

@Injectable()
export class AdminService {
  private readonly saltRounds: number;

  constructor(
    @InjectModel(Admin.name) private readonly admins: Model<Admin>,
    @InjectModel(AdminRole.name) private readonly roles: Model<AdminRole>,
    private readonly roleService: RoleService,
    private readonly audit: AuditService,
    configService: ConfigService,
  ) {
    this.saltRounds = configService.getOrThrow<AuthConfig>('auth').saltRounds;
  }

  async list(query: ListQuery): Promise<Paginated<AdminDto>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const filter = query.q
      ? { $or: [{ name: containsRegex(query.q) }, { email: containsRegex(query.q) }] }
      : {};
    const [items, total] = await Promise.all([
      this.admins
        .find(filter)
        .sort({ isOwner: -1, createdAt: 1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .populate<{ roleId: AdminRoleDocument }>('roleId'),
      this.admins.countDocuments(filter),
    ]);
    return { items: items.map((a) => this.toDto(a, a.roleId)), total, page, pageSize };
  }

  async getById(id: string): Promise<AdminDocument> {
    const admin = await this.admins.findById(toObjectId(id, 'adminId'));
    if (!admin) throw new EntityNotFoundException('Admin', id);
    return admin;
  }

  async getWithRole(id: string): Promise<{ admin: AdminDocument; role: AdminRoleDocument }> {
    const admin = await this.getById(id);
    const role = await this.roleService.getById(String(admin.roleId));
    return { admin, role };
  }

  async findByEmail(email: string): Promise<AdminDocument | null> {
    return this.admins.findOne({ email: normalizeEmail(email) });
  }

  async create(actor: RequestActor, dto: CreateAdminDto): Promise<AdminDto> {
    const email = normalizeEmail(dto.email);
    if (await this.admins.exists({ email })) {
      throw new ConflictActionException('EMAIL_TAKEN', 'An admin with this email already exists');
    }
    const role = await this.roleService.getById(dto.roleId);
    if (!this.roleService.canAssign(actor, role)) {
      throw new ForbiddenActionException('ROLE_NOT_ASSIGNABLE', 'You cannot assign this role');
    }
    const admin = await this.admins.create({
      email,
      name: dto.name.trim(),
      phone: dto.phone?.trim(),
      passwordHash: await bcrypt.hash(dto.password, this.saltRounds),
      roleId: role._id,
      guideId: dto.guideId ? toObjectId(dto.guideId, 'guideId') : undefined,
      isOwner: false,
      status: 'ACTIVE',
    });
    await this.audit.record(actor, 'admin.create', 'admin', String(admin._id), `Invited ${admin.email} as ${role.name}`);
    return this.toDto(admin, role);
  }

  async update(actor: RequestActor, id: string, dto: UpdateAdminDto): Promise<AdminDto> {
    const { admin, role } = await this.getWithRole(id);
    const self = actor.id === String(admin._id);
    if (!self) this.assertCanManage(actor, admin, role);

    let nextRole = role;
    if (dto.roleId && dto.roleId !== String(role._id)) {
      if (self) {
        throw new ForbiddenActionException('SELF_ROLE_CHANGE', 'You cannot change your own role');
      }
      if (admin.isOwner) {
        throw new ForbiddenActionException('OWNER_IMMUTABLE', 'The owner role cannot be changed');
      }
      nextRole = await this.roleService.getById(dto.roleId);
      if (!this.roleService.canAssign(actor, nextRole)) {
        throw new ForbiddenActionException('ROLE_NOT_ASSIGNABLE', 'You cannot assign this role');
      }
      admin.roleId = nextRole._id;
      admin.sessionVersion += 1;
    }
    if (dto.status && dto.status !== admin.status) {
      if (self) throw new ForbiddenActionException('SELF_SUSPEND', 'You cannot suspend yourself');
      if (admin.isOwner) throw new ForbiddenActionException('OWNER_IMMUTABLE', 'The owner cannot be suspended');
      admin.status = dto.status;
      admin.sessionVersion += 1;
    }
    if (dto.email) {
      const email = normalizeEmail(dto.email);
      if (email !== admin.email && (await this.admins.exists({ email }))) {
        throw new ConflictActionException('EMAIL_TAKEN', 'An admin with this email already exists');
      }
      admin.email = email;
    }
    if (dto.name !== undefined) admin.name = dto.name.trim();
    if (dto.phone !== undefined) admin.phone = dto.phone?.trim();
    if (dto.guideId !== undefined) {
      admin.guideId = dto.guideId ? toObjectId(dto.guideId, 'guideId') : undefined;
    }
    await admin.save();
    await this.audit.record(actor, 'admin.update', 'admin', String(admin._id), `Updated ${admin.email}`, {
      fields: Object.keys(dto),
    });
    return this.toDto(admin, nextRole);
  }

  async resetPassword(actor: RequestActor, id: string, dto: ResetAdminPasswordDto): Promise<void> {
    const { admin, role } = await this.getWithRole(id);
    if (actor.id !== String(admin._id)) this.assertCanManage(actor, admin, role);
    admin.passwordHash = await bcrypt.hash(dto.newPassword, this.saltRounds);
    admin.sessionVersion += 1;
    await admin.save();
    await this.audit.record(actor, 'admin.password_reset', 'admin', String(admin._id), `Reset password of ${admin.email}`);
  }

  async remove(actor: RequestActor, id: string): Promise<void> {
    const { admin, role } = await this.getWithRole(id);
    if (actor.id === String(admin._id)) {
      throw new ForbiddenActionException('SELF_DELETE', 'You cannot delete your own account');
    }
    this.assertCanManage(actor, admin, role);
    await admin.deleteOne();
    await this.audit.record(actor, 'admin.delete', 'admin', String(admin._id), `Removed ${admin.email}`);
  }

  /** Ensures the owner exists. Idempotent; never overwrites an existing owner. */
  /**
   * There is exactly one owner. Its address and name follow `OWNER_EMAIL` / `OWNER_NAME`,
   * so changing the config moves the account rather than creating a second one — the
   * partial unique index would reject that anyway. The password is only ever written on
   * creation: a re-seed must not undo a password someone changed in the panel.
   */
  async ensureOwner(seed: { email: string; password: string; name: string; resetPassword?: boolean }): Promise<AdminDocument> {
    const existing = await this.admins.findOne({ isOwner: true });
    if (existing) {
      const email = normalizeEmail(seed.email);
      if (existing.email !== email || existing.name !== seed.name) {
        existing.email = email;
        existing.name = seed.name;
        await existing.save();
      }
      // The break-glass path: nobody can reset the owner through the panel, so a locked-out
      // owner would otherwise have no way back in. Requires shell and env access.
      if (seed.resetPassword) await this.setPassword(existing, seed.password);
      return existing;
    }
    const ownerRole = await this.roleService.getByKey('owner');
    return this.admins.create({
      email: normalizeEmail(seed.email),
      name: seed.name,
      passwordHash: await bcrypt.hash(seed.password, this.saltRounds),
      roleId: ownerRole._id,
      isOwner: true,
      status: 'ACTIVE',
    });
  }

  async upsertByEmail(input: {
    email: string;
    name: string;
    password: string;
    roleKey: string;
    phone?: string;
    guideId?: Types.ObjectId;
  }): Promise<AdminDocument> {
    const role = await this.roleService.getByKey(input.roleKey);
    const email = normalizeEmail(input.email);
    const existing = await this.admins.findOne({ email });
    if (existing) return existing;
    return this.admins.create({
      email,
      name: input.name,
      phone: input.phone,
      passwordHash: await bcrypt.hash(input.password, this.saltRounds),
      roleId: role._id,
      guideId: input.guideId,
      isOwner: false,
      status: 'ACTIVE',
    });
  }

  /**
   * The management lattice. Owner > Full Access > Standard. Nobody touches the owner;
   * full-access admins cannot touch each other; standard admins with ADMINS_WRITE only
   * reach standard admins whose permissions sit inside their own.
   */
  assertCanManage(actor: RequestActor, target: AdminDocument, targetRole: AdminRole): void {
    if (target.isOwner) {
      throw new ForbiddenActionException('OWNER_IMMUTABLE', 'The owner account cannot be managed by others');
    }
    if (actor.isOwner) return;
    if (targetRole.tier === 'FULL') {
      throw new ForbiddenActionException(
        'FULL_ACCESS_PROTECTED',
        'Only the owner can manage full-access admins',
      );
    }
    if (actor.tier === 'FULL') return;
    const outside = targetRole.permissions.filter((p) => !actor.permissions.includes(p));
    if (outside.length) {
      throw new ForbiddenActionException(
        'ADMIN_OUT_OF_REACH',
        'This admin holds permissions you do not have',
        { permissions: outside },
      );
    }
  }

  async verifyPassword(admin: AdminDocument, password: string): Promise<boolean> {
    return bcrypt.compare(password, admin.passwordHash);
  }

  async setPassword(admin: AdminDocument, password: string): Promise<void> {
    if (password.length < ADMIN_PASSWORD_MIN_LENGTH) {
      throw new DomainException('WEAK_PASSWORD', `Use at least ${ADMIN_PASSWORD_MIN_LENGTH} characters`);
    }
    admin.passwordHash = await bcrypt.hash(password, this.saltRounds);
    admin.sessionVersion += 1;
    await admin.save();
  }

  toDto(admin: AdminShape, role: AdminRole & { _id: unknown }): AdminDto {
    return {
      id: String(admin._id),
      email: admin.email,
      name: admin.name,
      phone: admin.phone,
      role: { id: String(role._id), key: role.key, name: role.name, tier: role.tier },
      isOwner: admin.isOwner,
      status: admin.status,
      guideId: admin.guideId ? String(admin.guideId) : undefined,
      lastLoginAt: iso(admin.lastLoginAt),
      createdAt: admin.createdAt.toISOString(),
      updatedAt: admin.updatedAt.toISOString(),
    };
  }
}
