import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { CustomerSession, CustomerSessionSchema } from '../../modules/customers/schemas/customer-session.schema';
import { AdminSession, AdminSessionSchema } from '../../modules/iam/schemas/admin-session.schema';
import { AuthenticationGuard } from './authentication.guard';
import { AuthorizationGuard } from './authorization.guard';
import { SessionAccessService } from './session-access.service';
import { TokenService } from './token.service';

/** Token signing and the two global guards, shared by every realm. */
@Global()
@Module({
  imports: [
    JwtModule.register({}),
    MongooseModule.forFeature([
      { name: CustomerSession.name, schema: CustomerSessionSchema },
      { name: AdminSession.name, schema: AdminSessionSchema },
    ]),
  ],
  providers: [
    TokenService,
    SessionAccessService,
    { provide: APP_GUARD, useClass: AuthenticationGuard },
    { provide: APP_GUARD, useClass: AuthorizationGuard },
  ],
  exports: [TokenService, JwtModule],
})
export class AuthCoreModule {}
