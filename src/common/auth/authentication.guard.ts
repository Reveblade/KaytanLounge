import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedRequest, IS_PUBLIC_KEY } from './auth.decorators';
import { SessionAccessService } from './session-access.service';
import { TokenService, type AccessClaims } from './token.service';

/**
 * Verifies the bearer token and attaches the resolved caller to the request.
 * Registered globally: a route is protected unless it opts out with `@Public()`.
 * A well-formed JWT is not enough after logout — the session row must still be live.
 */
@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly sessions: SessionAccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) {
      if (isPublic) return true;
      throw new UnauthorizedException({
        code: 'MISSING_ACCESS_TOKEN',
        message: 'An access token is required for this endpoint',
      });
    }

    let claims: AccessClaims;
    try {
      claims = this.tokens.verifyAccess(authorization.slice(7));
    } catch {
      if (isPublic) return true;
      throw new UnauthorizedException({
        code: 'INVALID_ACCESS_TOKEN',
        message: 'The access token is expired or malformed',
      });
    }

    if (!(await this.sessions.isLive(claims))) {
      // Public catalog still works when a revoked cookie is attached; the BFF
      // then fails the silent refresh and drops the cookies.
      if (isPublic) return true;
      throw new UnauthorizedException({
        code: 'SESSION_REVOKED',
        message: 'This session was signed out',
      });
    }

    request.actor = {
      id: claims.sub,
      realm: claims.realm,
      sessionId: claims.sessionId,
      displayName: claims.name,
      isOwner: claims.isOwner,
      tier: claims.tier,
      roleKey: claims.roleKey,
      permissions: claims.permissions ?? [],
      guideId: claims.guideId,
      kuwhoCustomerId: claims.kuwhoCustomerId,
      phoneVerified: claims.phoneVerified,
    };
    return true;
  }
}
