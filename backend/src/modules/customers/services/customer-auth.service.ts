import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { RequestActor } from '../../../common/auth/auth.decorators';
import { TokenService } from '../../../common/auth/token.service';
import { DomainException } from '../../../common/exceptions/domain.exception';
import type { AuthConfig } from '../../../config/configuration';
import type { CustomerLoginResult, CustomerSessionDto, Locale } from '../../../contract/api';
import { CustomerSession } from '../schemas/customer-session.schema';
import { CustomerDocument } from '../schemas/customer.schema';
import { CustomerService } from './customer.service';
import {
  isKuwhoChallenge,
  KuwhoClient,
  type KuwhoLoginResult,
  type KuwhoProfile,
  type KuwhoSession,
} from './kuwho.client';

export interface RequestOrigin {
  ip?: string;
  userAgent?: string;
}

/**
 * Customer identity lives at Kuwho. This service is the bridge: every sign-in flow is
 * forwarded to Kuwho, and a successful Kuwho session is exchanged for a local one whose
 * access token this API can verify on its own. The Kuwho refresh token is kept encrypted
 * on the local session so later profile actions can still reach Kuwho as the customer.
 */
@Injectable()
export class CustomerAuthService {
  private readonly logger = new Logger(CustomerAuthService.name);
  private readonly encryptionKey: Buffer;
  /** Kuwho access tokens are short-lived; cache them per session to avoid refreshing on each call. */
  private readonly kuwhoAccessCache = new Map<string, { token: string; expiresAt: number }>();

  constructor(
    @InjectModel(CustomerSession.name) private readonly sessions: Model<CustomerSession>,
    private readonly kuwho: KuwhoClient,
    private readonly customers: CustomerService,
    private readonly tokens: TokenService,
    configService: ConfigService,
  ) {
    const auth = configService.getOrThrow<AuthConfig>('auth');
    this.encryptionKey = createHash('sha256').update(`biy-kuwho:${auth.refreshSecret}`).digest();
  }

  // -- Sign-in flows (all forwarded to Kuwho) --------------------------------------

  requestPhoneCode(phone: string, ip?: string) {
    return this.kuwho.post<{ expiresInSeconds: number; phone: string }>(
      'auth/customer/otp/request',
      { phone },
      { forwardedIp: ip },
    );
  }

  async verifyPhoneCode(phone: string, code: string, displayName: string | undefined, origin: RequestOrigin) {
    const session = await this.kuwho.post<KuwhoSession>('auth/customer/otp/verify', { phone, code, displayName });
    return this.exchange(session, origin);
  }

  requestEmailCode(email: string, ip?: string) {
    return this.kuwho.post<{ expiresInSeconds: number; email: string }>(
      'auth/customer/email/otp/request',
      { email },
      { forwardedIp: ip },
    );
  }

  async verifyEmailCode(
    email: string,
    code: string,
    opts: { displayName?: string; phone?: string },
    origin: RequestOrigin,
  ): Promise<CustomerLoginResult> {
    const result = await this.kuwho.post<KuwhoLoginResult>('auth/customer/email/otp/verify', {
      email,
      code,
      ...opts,
    });
    return this.settle(result, origin);
  }

  async loginWithGoogle(idToken: string, origin: RequestOrigin): Promise<CustomerLoginResult> {
    const result = await this.kuwho.post<KuwhoLoginResult>('auth/customer/google', { idToken });
    return this.settle(result, origin);
  }

  async loginWithMeta(accessToken: string, origin: RequestOrigin): Promise<CustomerLoginResult> {
    const result = await this.kuwho.post<KuwhoLoginResult>('auth/customer/meta', { accessToken });
    return this.settle(result, origin);
  }

  async confirmLinkChallenge(challengeId: string, code: string, origin: RequestOrigin) {
    const session = await this.kuwho.post<KuwhoSession>('auth/customer/link/confirm', { challengeId, code });
    return this.exchange(session, origin);
  }

  async confirmPhoneAdoption(challengeId: string, code: string, origin: RequestOrigin) {
    const session = await this.kuwho.post<KuwhoSession>('auth/customer/email/otp/adopt', { challengeId, code });
    return this.exchange(session, origin);
  }

  /**
   * A client that already holds a Kuwho session (future kuwho.com SSO) trades it in here.
   * Both tokens are required: a stolen access token alone must not mint a 30-day local session.
   */
  async exchangeKuwhoTokens(kuwhoAccessToken: string, kuwhoRefreshToken: string, origin: RequestOrigin) {
    const profile = await this.kuwho.get<KuwhoProfile>('customers/me', { bearer: kuwhoAccessToken });
    let fresh: KuwhoSession;
    try {
      fresh = await this.kuwho.post<KuwhoSession>('auth/customer/refresh', { refreshToken: kuwhoRefreshToken });
    } catch (error) {
      if (error instanceof DomainException && error.getStatus() >= 500) throw error;
      if (error instanceof DomainException) {
        throw new UnauthorizedException({
          code: 'INVALID_KUWHO_REFRESH',
          message: 'The Kuwho session is no longer valid',
        });
      }
      throw error;
    }
    if (fresh.customer?.id && fresh.customer.id !== profile.id) {
      throw new UnauthorizedException({
        code: 'KUWHO_TOKEN_MISMATCH',
        message: 'The Kuwho token pair does not belong to the same account',
      });
    }
    const session: KuwhoSession = {
      accessToken: fresh.accessToken,
      refreshToken: fresh.refreshToken,
      customer: {
        id: profile.id,
        displayName: profile.displayName,
        firstName: profile.firstName,
        lastName: profile.lastName,
        phone: profile.phone,
        email: profile.email,
        phoneVerified: profile.phoneVerified,
        emailVerified: profile.emailVerified,
      },
    };
    return this.exchange(session, origin, profile);
  }

  // -- Local session lifecycle -------------------------------------------------------

  async refresh(refreshToken: string): Promise<CustomerSessionDto> {
    const hash = this.tokens.hashRefresh(refreshToken);
    const session = await this.sessions.findOne({ refreshHash: hash });
    if (session) {
      if (session.revokedAt || session.expiresAt < new Date()) {
        throw new UnauthorizedException({ code: 'INVALID_REFRESH_TOKEN', message: 'Sign in again' });
      }
      const customer = await this.customers.getById(String(session.customerId));
      const rotated = this.tokens.issueRefreshToken();
      session.previousRefreshHash = session.refreshHash;
      session.refreshHash = rotated.hash;
      session.lastSeenAt = new Date();
      session.expiresAt = new Date(Date.now() + this.tokens.refreshTtlMs());
      await session.save();
      await this.customers.touch(String(customer._id));
      return this.sessionDto(customer, String(session._id), rotated.token);
    }
    const reused = await this.sessions.findOne({ previousRefreshHash: hash });
    if (reused) {
      reused.revokedAt = new Date();
      await reused.save();
      this.kuwhoAccessCache.delete(String(reused._id));
      throw new UnauthorizedException({ code: 'REFRESH_TOKEN_REUSED', message: 'Sign in again' });
    }
    throw new UnauthorizedException({ code: 'INVALID_REFRESH_TOKEN', message: 'Sign in again' });
  }

  async logout(sessionId: string): Promise<void> {
    const session = await this.sessions.findById(new Types.ObjectId(sessionId));
    if (!session) return;
    session.revokedAt = new Date();
    await session.save();
    this.kuwhoAccessCache.delete(sessionId);
    // Best effort: also end the Kuwho session this one was opened from.
    try {
      const token = await this.kuwhoAccessTokenFor(session, { allowRevoked: true });
      if (token) await this.kuwho.post('auth/customer/logout', {}, { bearer: token });
    } catch (error) {
      this.logger.debug(`kuwho logout skipped: ${String(error)}`);
    }
  }

  async logoutEverywhere(customerId: string): Promise<void> {
    const open = await this.sessions
      .find({ customerId: new Types.ObjectId(customerId), revokedAt: { $exists: false } })
      .select('_id');
    await this.sessions.updateMany(
      { customerId: new Types.ObjectId(customerId), revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date() } },
    );
    for (const session of open) this.kuwhoAccessCache.delete(String(session._id));
  }

  async listSessions(actor: RequestActor) {
    const sessions = await this.sessions
      .find({ customerId: new Types.ObjectId(actor.id), revokedAt: { $exists: false }, expiresAt: { $gt: new Date() } })
      .sort({ lastSeenAt: -1 });
    return sessions.map((s) => ({
      id: String(s._id),
      current: String(s._id) === actor.sessionId,
      userAgent: s.userAgent,
      ip: s.ip,
      lastSeenAt: (s.lastSeenAt ?? s.createdAt).toISOString(),
      createdAt: s.createdAt.toISOString(),
    }));
  }

  async revokeSession(actor: RequestActor, sessionId: string): Promise<void> {
    await this.sessions.updateOne(
      { _id: new Types.ObjectId(sessionId), customerId: new Types.ObjectId(actor.id) },
      { $set: { revokedAt: new Date() } },
    );
    this.kuwhoAccessCache.delete(sessionId);
  }

  // -- Acting at Kuwho on the customer's behalf ------------------------------------

  /** Fresh copy of the Kuwho profile, mirrored locally. */
  async syncProfile(actor: RequestActor): Promise<CustomerDocument> {
    const customer = await this.customers.getById(actor.id);
    const token = await this.kuwhoAccessTokenForActor(actor);
    if (!token) return customer;
    const profile = await this.kuwho.get<KuwhoProfile>('customers/me', { bearer: token });
    return this.customers.applyProfile(customer, profile);
  }

  async updateProfile(
    actor: RequestActor,
    patch: { firstName?: string; lastName?: string; displayName?: string; preferredLocale?: Locale },
  ): Promise<CustomerDocument> {
    const customer = await this.customers.getById(actor.id);
    const token = await this.kuwhoAccessTokenForActor(actor);
    if (token) {
      const profile = await this.kuwho.patch<KuwhoProfile>('customers/me', patch, { bearer: token });
      return this.customers.applyProfile(customer, profile);
    }
    // Sessions opened without a Kuwho token (seeded demo accounts) edit the mirror only.
    if (patch.displayName) customer.displayName = patch.displayName;
    if (patch.firstName !== undefined) customer.firstName = patch.firstName;
    if (patch.lastName !== undefined) customer.lastName = patch.lastName;
    if (patch.preferredLocale) customer.preferredLocale = patch.preferredLocale;
    return customer.save();
  }

  async requestPhoneAttachment(actor: RequestActor, phone: string) {
    const token = await this.requireKuwhoToken(actor);
    return this.kuwho.post<{ expiresInSeconds: number; phone: string }>(
      'customers/me/phone/request',
      { phone },
      { bearer: token },
    );
  }

  /** Kuwho answers with a fresh session; keep its refresh token so later calls still work. */
  async verifyPhoneAttachment(actor: RequestActor, phone: string, code: string): Promise<CustomerDocument> {
    const token = await this.requireKuwhoToken(actor);
    const fresh = await this.kuwho.post<KuwhoSession>('customers/me/phone/verify', { phone, code }, { bearer: token });
    const session = await this.sessions.findById(new Types.ObjectId(actor.sessionId));
    if (session) {
      session.kuwhoRefreshTokenEnc = this.encrypt(fresh.refreshToken);
      await session.save();
      this.kuwhoAccessCache.set(actor.sessionId, { token: fresh.accessToken, expiresAt: Date.now() + 10 * 60_000 });
    }
    const customer = await this.customers.getById(actor.id);
    const profile = await this.kuwho.get<KuwhoProfile>('customers/me', { bearer: fresh.accessToken });
    return this.customers.applyProfile(customer, profile);
  }

  // -- Internals ------------------------------------------------------------------------

  private async settle(result: KuwhoLoginResult, origin: RequestOrigin): Promise<CustomerLoginResult> {
    if (isKuwhoChallenge(result)) {
      return {
        challengeRequired: true,
        challengeId: result.challengeId,
        email: result.email,
        phone: result.phone,
        expiresInSeconds: result.expiresInSeconds,
      };
    }
    return this.exchange(result, origin);
  }

  private async exchange(kuwhoSession: KuwhoSession, origin: RequestOrigin, knownProfile?: KuwhoProfile): Promise<CustomerSessionDto> {
    let profile = knownProfile;
    if (!profile) {
      try {
        profile = await this.kuwho.get<KuwhoProfile>('customers/me', { bearer: kuwhoSession.accessToken });
      } catch (error) {
        this.logger.warn(`profile fetch after sign-in failed, using session payload: ${String(error)}`);
      }
    }
    const customer = await this.customers.upsertFromKuwho(kuwhoSession, profile);
    const { token, hash } = this.tokens.issueRefreshToken();
    const session = await this.sessions.create({
      customerId: customer._id,
      refreshHash: hash,
      kuwhoRefreshTokenEnc: this.encrypt(kuwhoSession.refreshToken),
      expiresAt: new Date(Date.now() + this.tokens.refreshTtlMs()),
      userAgent: origin.userAgent?.slice(0, 200),
      ip: origin.ip,
      lastSeenAt: new Date(),
    });
    this.kuwhoAccessCache.set(String(session._id), {
      token: kuwhoSession.accessToken,
      expiresAt: Date.now() + 10 * 60_000,
    });
    const dto = this.sessionDto(customer, String(session._id), token);
    return kuwhoSession.newAccount ? { ...dto, newAccount: true } : dto;
  }

  private sessionDto(customer: CustomerDocument, sessionId: string, refreshToken: string): CustomerSessionDto {
    const accessToken = this.tokens.signAccess({
      sub: String(customer._id),
      realm: 'CUSTOMER',
      sessionId,
      name: customer.displayName,
      kuwhoCustomerId: customer.kuwhoCustomerId,
      phoneVerified: customer.phoneVerified,
      permissions: [],
    });
    return { accessToken, refreshToken, customer: this.customers.toDto(customer) };
  }

  private async requireKuwhoToken(actor: RequestActor): Promise<string> {
    const token = await this.kuwhoAccessTokenForActor(actor);
    if (!token) {
      throw new DomainException('KUWHO_SESSION_MISSING', 'Sign in again to change your sign-in details', 401);
    }
    return token;
  }

  private async kuwhoAccessTokenForActor(actor: RequestActor): Promise<string | undefined> {
    const session = await this.sessions.findById(new Types.ObjectId(actor.sessionId));
    if (!session) return undefined;
    return this.kuwhoAccessTokenFor(session);
  }

  /** Cached Kuwho access token, refreshed through Kuwho when stale. */
  private async kuwhoAccessTokenFor(
    session: { _id: Types.ObjectId; kuwhoRefreshTokenEnc?: string; revokedAt?: Date; save: () => Promise<unknown> },
    opts?: { allowRevoked?: boolean },
  ): Promise<string | undefined> {
    if (session.revokedAt && !opts?.allowRevoked) return undefined;
    const key = String(session._id);
    const cached = this.kuwhoAccessCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.token;
    if (!session.kuwhoRefreshTokenEnc) return undefined;
    const refreshToken = this.decrypt(session.kuwhoRefreshTokenEnc);
    const fresh = await this.kuwho.post<KuwhoSession>('auth/customer/refresh', { refreshToken });
    session.kuwhoRefreshTokenEnc = this.encrypt(fresh.refreshToken);
    await session.save();
    this.kuwhoAccessCache.set(key, { token: fresh.accessToken, expiresAt: Date.now() + 10 * 60_000 });
    return fresh.accessToken;
  }

  private encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${enc.toString('base64url')}`;
  }

  private decrypt(payload: string): string {
    const [iv, tag, data] = payload.split('.');
    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
  }
}
