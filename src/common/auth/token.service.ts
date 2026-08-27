import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Permission, RoleTier } from '../../contract/api';
import type { AuthConfig } from '../../config/configuration';
import type { ActorRealm } from './auth.decorators';

export interface AccessClaims {
  sub: string;
  realm: ActorRealm;
  sessionId: string;
  name?: string;
  isOwner?: boolean;
  tier?: RoleTier;
  roleKey?: string;
  permissions?: Permission[];
  guideId?: string;
  kuwhoCustomerId?: string;
  phoneVerified?: boolean;
}

/**
 * Access tokens are short-lived JWTs. Refresh tokens are opaque random strings whose
 * SHA-256 lives on the session document, so a stolen database dump cannot mint sessions.
 */
@Injectable()
export class TokenService {
  private readonly config: AuthConfig;

  constructor(
    private readonly jwt: JwtService,
    configService: ConfigService,
  ) {
    this.config = configService.getOrThrow<AuthConfig>('auth');
  }

  signAccess(claims: AccessClaims): string {
    return this.jwt.sign(
      { ...claims },
      {
        secret: this.config.accessSecret,
        expiresIn: Math.floor(this.accessTtlMs() / 1000),
      },
    );
  }

  verifyAccess(token: string): AccessClaims {
    return this.jwt.verify<AccessClaims>(token, { secret: this.config.accessSecret });
  }

  issueRefreshToken(): { token: string; hash: string } {
    const token = randomBytes(48).toString('base64url');
    return { token, hash: this.hashRefresh(token) };
  }

  hashRefresh(token: string): string {
    return createHash('sha256').update(token + this.config.refreshSecret).digest('hex');
  }

  refreshTtlMs(): number {
    return parseDuration(this.config.refreshTtl);
  }

  accessTtlMs(): number {
    return parseDuration(this.config.accessTtl);
  }
}

/** "15m", "30d", "12h", "900s" → milliseconds. */
export function parseDuration(value: string): number {
  const match = /^(\d+)\s*([smhd])?$/.exec(value.trim());
  if (!match) return 15 * 60 * 1000;
  const amount = Number(match[1]);
  const unit = match[2] ?? 's';
  const factor = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit] ?? 1000;
  return amount * factor;
}
