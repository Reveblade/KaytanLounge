import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { RequestActor } from '../../../common/auth/auth.decorators';
import { PERMISSION_GROUPS, SYSTEM_ROLES } from '../../../common/auth/permissions';
import {
  ConflictActionException,
  EntityNotFoundException,
  ForbiddenActionException,
} from '../../../common/exceptions/domain.exception';
import { toObjectId } from '../../../common/utils/mongo';
import type { AdminRoleDto, Permission } from '../../../contract/api';
import { Admin, AdminDocument } from '../schemas/admin.schema';
import { AdminRole, AdminRoleDocument } from '../schemas/admin-role.schema';
import { CreateRoleDto, UpdateRoleDto } from '../dto/iam.dto';

@Injectable()
export class RoleService {
  constructor(
    @InjectModel(AdminRole.name) private readonly roles: Model<AdminRole>,
    @InjectModel(Admin.name) private readonly admins: Model<Admin>,
  ) {}

  permissionGroups() {
    return PERMISSION_GROUPS;
  }

  /** Writes the owner / full-access roles and the editable presets if missing. */
  async ensureSystemRoles(): Promise<void> {
    for (const seed of SYSTEM_ROLES) {
      const existing = await this.roles.findOne({ key: seed.key });
      if (!existing) {
        await this.roles.create(seed);
      } else if (seed.isSystem) {
        // System roles always carry the full current catalog.
        existing.permissions = seed.permissions;
        existing.tier = seed.tier;
        existing.isSystem = true;
        await existing.save();
      }
    }
  }

  async list(): Promise<AdminRoleDto[]> {
    const [roles, counts] = await Promise.all([
      this.roles.find().sort({ tier: 1, createdAt: 1 }).lean(),
      this.admins.aggregate<{ _id: string; count: number }>([
        { $group: { _id: '$roleId', count: { $sum: 1 } } },
      ]),
    ]);
    const countByRole = new Map(counts.map((c) => [String(c._id), c.count]));
    const order: Record<string, number> = { OWNER: 0, FULL: 1, STANDARD: 2 };
    return roles
      .sort((a, b) => order[a.tier] - order[b.tier] || a.createdAt.getTime() - b.createdAt.getTime())
      .map((r) => this.toDto(r, countByRole.get(String(r._id)) ?? 0));
  }

  async getById(id: string): Promise<AdminRoleDocument> {
    const role = await this.roles.findById(toObjectId(id, 'roleId'));
    if (!role) throw new EntityNotFoundException('Role', id);
    return role;
  }

  async getByKey(key: string): Promise<AdminRoleDocument> {
    const role = await this.roles.findOne({ key });
    if (!role) throw new EntityNotFoundException('Role', key);
    return role;
  }

  async create(actor: RequestActor, dto: CreateRoleDto): Promise<AdminRoleDto> {
    this.assertMayGrant(actor, dto.permissions);
    const exists = await this.roles.exists({ key: dto.key });
    if (exists) throw new ConflictActionException('ROLE_KEY_TAKEN', `Role key ${dto.key} already exists`);
    const role = await this.roles.create({ ...dto, tier: 'STANDARD', isSystem: false });
    return this.toDto(role.toObject(), 0);
  }

  async update(actor: RequestActor, id: string, dto: UpdateRoleDto): Promise<AdminRoleDto> {
    const role = await this.getById(id);
    if (role.isSystem) {
      throw new ForbiddenActionException('ROLE_IMMUTABLE', 'System roles cannot be edited');
    }
    if (dto.permissions) {
      this.assertMayGrant(actor, dto.permissions);
      // Nobody may hand out through a role what they could not hold themselves.
      role.permissions = dto.permissions;
    }
    if (dto.name !== undefined) role.name = dto.name;
    if (dto.description !== undefined) role.description = dto.description;
    await role.save();
    const count = await this.admins.countDocuments({ roleId: role._id });
    return this.toDto(role.toObject(), count);
  }

  async remove(actor: RequestActor, id: string): Promise<void> {
    const role = await this.getById(id);
    if (role.isSystem) {
      throw new ForbiddenActionException('ROLE_IMMUTABLE', 'System roles cannot be deleted');
    }
    this.assertMayGrant(actor, role.permissions);
    const inUse = await this.admins.countDocuments({ roleId: role._id });
    if (inUse > 0) {
      throw new ConflictActionException('ROLE_IN_USE', 'Reassign the admins holding this role first', {
        adminCount: inUse,
      });
    }
    await role.deleteOne();
  }

  /**
   * Whether `actor` may hand out `role` to somebody. Owner is never assignable, Full
   * Access only by the owner, anything else only within the actor's own permissions.
   */
  canAssign(actor: RequestActor, role: Pick<AdminRole, 'tier' | 'permissions'>): boolean {
    if (role.tier === 'OWNER') return false;
    if (role.tier === 'FULL') return Boolean(actor.isOwner);
    if (actor.isOwner || actor.tier === 'FULL') return true;
    return role.permissions.every((p) => actor.permissions.includes(p));
  }

  assertMayGrant(actor: RequestActor, permissions: Permission[]): void {
    if (actor.isOwner || actor.tier === 'FULL') return;
    const outside = permissions.filter((p) => !actor.permissions.includes(p));
    if (outside.length) {
      throw new ForbiddenActionException(
        'PERMISSION_ESCALATION',
        'You can only grant permissions you hold yourself',
        { permissions: outside },
      );
    }
  }

  toDto(role: AdminRole & { _id: unknown }, adminCount?: number): AdminRoleDto {
    return {
      id: String(role._id),
      key: role.key,
      name: role.name,
      description: role.description,
      tier: role.tier,
      permissions: role.permissions,
      isSystem: role.isSystem,
      adminCount,
      createdAt: role.createdAt.toISOString(),
      updatedAt: role.updatedAt.toISOString(),
    };
  }

  /** Effective permission set for an admin, resolved from their role. */
  effectivePermissions(admin: AdminDocument, role: AdminRole): Permission[] {
    return admin.isOwner ? [...role.permissions] : role.permissions;
  }
}
