import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Permission } from '../../contract/api';
import {
  ActorRealm,
  AuthenticatedRequest,
  IS_PUBLIC_KEY,
  PERMISSIONS_KEY,
  REALMS_KEY,
} from './auth.decorators';

/** Enforces `@Realms` and `@RequirePermissions` after authentication resolved the actor. */
@Injectable()
export class AuthorizationGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets);
    const realms = this.reflector.getAllAndOverride<ActorRealm[] | undefined>(REALMS_KEY, targets);
    const permissions = this.reflector.getAllAndOverride<Permission[] | undefined>(
      PERMISSIONS_KEY,
      targets,
    );

    if (isPublic && !realms && !permissions) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const actor = request.actor;
    if (!actor) {
      if (isPublic) return true;
      throw new ForbiddenException({ code: 'PERMISSION_DENIED', message: 'No actor on request' });
    }

    if (realms && !realms.includes(actor.realm)) {
      throw new ForbiddenException({
        code: 'REALM_NOT_ALLOWED',
        message: `This endpoint is not available to ${actor.realm.toLowerCase()} sessions`,
      });
    }

    if (permissions?.length && actor.realm === 'ADMIN' && !actor.isOwner) {
      const missing = permissions.filter((p) => !actor.permissions.includes(p));
      if (missing.length) {
        throw new ForbiddenException({
          code: 'PERMISSION_DENIED',
          message: `Missing permission: ${missing.join(', ')}`,
          details: { missing },
        });
      }
    }
    return true;
  }
}
