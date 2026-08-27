import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AuthenticationGuard } from './authentication.guard';
import { AuthorizationGuard } from './authorization.guard';
import { TokenService } from './token.service';

/** Token signing and the two global guards, shared by every realm. */
@Global()
@Module({
  imports: [JwtModule.register({})],
  providers: [
    TokenService,
    { provide: APP_GUARD, useClass: AuthenticationGuard },
    { provide: APP_GUARD, useClass: AuthorizationGuard },
  ],
  exports: [TokenService, JwtModule],
})
export class AuthCoreModule {}
