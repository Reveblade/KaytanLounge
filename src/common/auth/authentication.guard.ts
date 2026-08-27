import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedRequest, IS_PUBLIC_KEY } from './auth.decorators';
import { TokenService } from './token.service';

/**
 * Verifies the bearer token and attaches the resolved caller to the request.
 * Registered globally: a route is protected unless it opts out with `@Public()`.
 */
@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
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

    try {
      const claims = this.tokens.verifyAccess(authorization.slice(7));
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
    } catch {
      if (isPublic) return true;
      throw new UnauthorizedException({
        code: 'INVALID_ACCESS_TOKEN',
        message: 'The access token is expired or malformed',
      });
    }
  }
}
