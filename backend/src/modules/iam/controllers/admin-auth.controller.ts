import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentActor, Public, Realms, type RequestActor } from '../../../common/auth/auth.decorators';
import { AdminLoginDto, ChangePasswordDto, RefreshTokenDto, UpdateOwnProfileDto } from '../dto/iam.dto';
import { AdminAuthService } from '../services/admin-auth.service';

function originOf(request: Request) {
  const agent = request.headers['user-agent'];
  return { ip: request.ip, userAgent: typeof agent === 'string' ? agent.slice(0, 200) : undefined };
}

@ApiTags('admin/auth')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly auth: AdminAuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign in with email and password' })
  login(@Body() dto: AdminLoginDto, @Req() request: Request) {
    return this.auth.login(dto.email, dto.password, originOf(request));
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate the refresh token and mint a new access token' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Realms('ADMIN')
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@CurrentActor() actor: RequestActor) {
    return this.auth.logout(actor.sessionId);
  }

  @Realms('ADMIN')
  @Get('me')
  @ApiOperation({ summary: 'The signed-in admin and their effective permissions' })
  me(@CurrentActor() actor: RequestActor) {
    return this.auth.me(actor);
  }

  @Realms('ADMIN')
  @Patch('me')
  updateProfile(@CurrentActor() actor: RequestActor, @Body() dto: UpdateOwnProfileDto) {
    return this.auth.updateProfile(actor, dto);
  }

  @Realms('ADMIN')
  @Post('me/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  changePassword(@CurrentActor() actor: RequestActor, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(actor, dto);
  }
}
