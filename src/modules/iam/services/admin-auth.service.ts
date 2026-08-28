import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { RequestActor } from '../../../common/auth/auth.decorators';
import { TokenService } from '../../../common/auth/token.service';
import { DomainException, ForbiddenActionException } from '../../../common/exceptions/domain.exception';
import type { AdminSessionDto } from '../../../contract/api';
import { AuditService } from '../../audit/audit.service';
import { ChangePasswordDto, UpdateOwnProfileDto } from '../dto/iam.dto';
import { AdminDocument } from '../schemas/admin.schema';
import { AdminRoleDocument } from '../schemas/admin-role.schema';
import { AdminSession } from '../schemas/admin-session.schema';
import { AdminService } from './admin.service';

export interface RequestOrigin {
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class AdminAuthService {
  constructor(
    @InjectModel(AdminSession.name) private readonly sessions: Model<AdminSession>,
    private readonly admins: AdminService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
  ) {}

  async login(email: string, password: string, origin: RequestOrigin): Promise<AdminSessionDto> {
    const admin = await this.admins.findByEmail(email);
    if (!admin || !(await this.admins.verifyPassword(admin, password))) {
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Email or password is wrong' });
    }
    if (admin.status !== 'ACTIVE') {
      throw new ForbiddenActionException('ACCOUNT_SUSPENDED', 'This account is suspended');
    }
    const { role } = await this.admins.getWithRole(String(admin._id));
    admin.lastLoginAt = new Date();
    await admin.save();

    const session = await this.openSession(admin, origin);
    await this.audit.record(this.actorOf(admin, role, String(session.sessionId)), 'admin.login', 'admin', String(admin._id));
    return this.sessionDto(admin, role, session);
  }

  async refresh(refreshToken: string): Promise<AdminSessionDto> {
    const hash = this.tokens.hashRefresh(refreshToken);
    const session = await this.sessions.findOne({ refreshHash: hash });
    if (session) {
      if (session.revokedAt || session.expiresAt < new Date()) {
        throw new UnauthorizedException({ code: 'INVALID_REFRESH_TOKEN', message: 'Sign in again' });
      }
      const { admin, role } = await this.admins.getWithRole(String(session.adminId));
      if (admin.status !== 'ACTIVE' || admin.sessionVersion !== session.sessionVersion) {
        session.revokedAt = new Date();
        await session.save();
        throw new UnauthorizedException({ code: 'SESSION_REVOKED', message: 'This session was signed out' });
      }
      const rotated = this.tokens.issueRefreshToken();
      session.previousRefreshHash = session.refreshHash;
      session.refreshHash = rotated.hash;
      session.lastSeenAt = new Date();
      session.expiresAt = new Date(Date.now() + this.tokens.refreshTtlMs());
      await session.save();
      return this.sessionDto(admin, role, { sessionId: session._id, refreshToken: rotated.token });
    }
    const reused = await this.sessions.findOne({ previousRefreshHash: hash });
    if (reused) {
      reused.revokedAt = new Date();
      await reused.save();
      throw new UnauthorizedException({ code: 'REFRESH_TOKEN_REUSED', message: 'Sign in again' });
    }
    throw new UnauthorizedException({ code: 'INVALID_REFRESH_TOKEN', message: 'Sign in again' });
  }

  async logout(sessionId: string): Promise<void> {
    await this.sessions.updateOne({ _id: new Types.ObjectId(sessionId) }, { $set: { revokedAt: new Date() } });
  }

  async me(actor: RequestActor) {
    const { admin, role } = await this.admins.getWithRole(actor.id);
    return { admin: this.admins.toDto(admin, role), permissions: role.permissions };
  }

  async updateProfile(actor: RequestActor, dto: UpdateOwnProfileDto) {
    const { admin, role } = await this.admins.getWithRole(actor.id);
    if (dto.name !== undefined) admin.name = dto.name.trim();
    if (dto.phone !== undefined) admin.phone = dto.phone.trim();
    await admin.save();
    return this.admins.toDto(admin, role);
  }

  async changePassword(actor: RequestActor, dto: ChangePasswordDto): Promise<void> {
    const admin = await this.admins.getById(actor.id);
    if (!(await this.admins.verifyPassword(admin, dto.currentPassword))) {
      throw new DomainException('INVALID_CREDENTIALS', 'Current password is wrong', 401);
    }
    await this.admins.setPassword(admin, dto.newPassword);
    await this.audit.record(actor, 'admin.password_change', 'admin', actor.id);
  }

  private async openSession(admin: AdminDocument, origin: RequestOrigin) {
    const { token, hash } = this.tokens.issueRefreshToken();
    const session = await this.sessions.create({
      adminId: admin._id,
      refreshHash: hash,
      sessionVersion: admin.sessionVersion,
      expiresAt: new Date(Date.now() + this.tokens.refreshTtlMs()),
      userAgent: origin.userAgent?.slice(0, 200),
      ip: origin.ip,
      lastSeenAt: new Date(),
    });
    return { sessionId: session._id, refreshToken: token };
  }

  private sessionDto(
    admin: AdminDocument,
    role: AdminRoleDocument,
    session: { sessionId: Types.ObjectId; refreshToken: string },
  ): AdminSessionDto {
    const accessToken = this.tokens.signAccess({
      sub: String(admin._id),
      realm: 'ADMIN',
      sessionId: String(session.sessionId),
      name: admin.name,
      isOwner: admin.isOwner,
      tier: role.tier,
      roleKey: role.key,
      permissions: role.permissions,
      guideId: admin.guideId ? String(admin.guideId) : undefined,
    });
    return {
      accessToken,
      refreshToken: session.refreshToken,
      admin: this.admins.toDto(admin, role),
      permissions: role.permissions,
    };
  }

  private actorOf(admin: AdminDocument, role: AdminRoleDocument, sessionId: string): RequestActor {
    return {
      id: String(admin._id),
      realm: 'ADMIN',
      sessionId,
      displayName: admin.name,
      isOwner: admin.isOwner,
      tier: role.tier,
      roleKey: role.key,
      permissions: role.permissions,
    };
  }
}
