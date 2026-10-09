import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';
import type { Permission, RoleTier } from '../../contract/api';

export type ActorRealm = 'ADMIN' | 'CUSTOMER';

/** The caller as the guards resolved them from the bearer token. */
export interface RequestActor {
  id: string;
  realm: ActorRealm;
  sessionId: string;
  displayName?: string;
  // ADMIN realm
  isOwner?: boolean;
  tier?: RoleTier;
  roleKey?: string;
  permissions: Permission[];
  guideId?: string;
  // CUSTOMER realm
  kuwhoCustomerId?: string;
  phoneVerified?: boolean;
}

export interface AuthenticatedRequest extends Request {
  actor?: RequestActor;
}

export const IS_PUBLIC_KEY = 'auth:public';
export const REALMS_KEY = 'auth:realms';
export const PERMISSIONS_KEY = 'auth:permissions';

/** No token needed; an attached token is still resolved when present. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Restrict a handler or controller to the given realms. */
export const Realms = (...realms: ActorRealm[]) => SetMetadata(REALMS_KEY, realms);

/** Admin handlers: every listed permission must be held (the owner always passes). */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

export const CurrentActor = createParamDecorator(
  (_data: unknown, context: ExecutionContext): RequestActor | undefined => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.actor;
  },
);
