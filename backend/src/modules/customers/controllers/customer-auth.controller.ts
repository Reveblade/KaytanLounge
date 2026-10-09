import { Body, Controller, HttpCode, HttpStatus, Ip, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentActor, Public, Realms, type RequestActor } from '../../../common/auth/auth.decorators';
import {
  ConfirmChallengeDto,
  ExchangeKuwhoDto,
  GoogleLoginDto,
  MetaLoginDto,
  RefreshCustomerDto,
  RequestEmailCodeDto,
  RequestPhoneCodeDto,
  VerifyEmailCodeDto,
  VerifyPhoneCodeDto,
} from '../dto/customer.dto';
import { CustomerAuthService } from '../services/customer-auth.service';

function originOf(request: Request) {
  const agent = request.headers['user-agent'];
  return { ip: request.ip, userAgent: typeof agent === 'string' ? agent.slice(0, 200) : undefined };
}

/**
 * Customer sign-in. Every route forwards to Kuwho and, on success, opens a local
 * session. Phone OTP, email OTP, Google and Meta all land here so the website only
 * ever talks to one API.
 */
@ApiTags('auth/customer')
@Controller('auth/customer')
export class CustomerAuthController {
  constructor(private readonly auth: CustomerAuthService) {}

  @Public()
  @Post('otp/request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a one time code to a phone (via Kuwho)' })
  requestOtp(@Body() dto: RequestPhoneCodeDto, @Ip() ip: string) {
    return this.auth.requestPhoneCode(dto.phone, ip);
  }

  @Public()
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  verifyOtp(@Body() dto: VerifyPhoneCodeDto, @Req() request: Request) {
    return this.auth.verifyPhoneCode(dto.phone, dto.code, dto.displayName, originOf(request));
  }

  @Public()
  @Post('email/otp/request')
  @HttpCode(HttpStatus.OK)
  requestEmailOtp(@Body() dto: RequestEmailCodeDto, @Ip() ip: string) {
    return this.auth.requestEmailCode(dto.email, ip);
  }

  @Public()
  @Post('email/otp/verify')
  @HttpCode(HttpStatus.OK)
  verifyEmailOtp(@Body() dto: VerifyEmailCodeDto, @Req() request: Request) {
    return this.auth.verifyEmailCode(
      dto.email,
      dto.code,
      { displayName: dto.displayName, phone: dto.phone },
      originOf(request),
    );
  }

  @Public()
  @Post('email/otp/adopt')
  @HttpCode(HttpStatus.OK)
  adoptPhone(@Body() dto: ConfirmChallengeDto, @Req() request: Request) {
    return this.auth.confirmPhoneAdoption(dto.challengeId, dto.code, originOf(request));
  }

  @Public()
  @Post('google')
  @HttpCode(HttpStatus.OK)
  google(@Body() dto: GoogleLoginDto, @Req() request: Request) {
    return this.auth.loginWithGoogle(dto.idToken, originOf(request));
  }

  @Public()
  @Post('meta')
  @HttpCode(HttpStatus.OK)
  meta(@Body() dto: MetaLoginDto, @Req() request: Request) {
    return this.auth.loginWithMeta(dto.accessToken, originOf(request));
  }

  @Public()
  @Post('link/confirm')
  @HttpCode(HttpStatus.OK)
  confirmLink(@Body() dto: ConfirmChallengeDto, @Req() request: Request) {
    return this.auth.confirmLinkChallenge(dto.challengeId, dto.code, originOf(request));
  }

  @Public()
  @Post('exchange')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trade an existing Kuwho session for a local one' })
  exchange(@Body() dto: ExchangeKuwhoDto, @Req() request: Request) {
    return this.auth.exchangeKuwhoTokens(dto.accessToken, dto.refreshToken, originOf(request));
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshCustomerDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Realms('CUSTOMER')
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@CurrentActor() actor: RequestActor) {
    return this.auth.logout(actor.sessionId);
  }

  @Realms('CUSTOMER')
  @Post('logout/all')
  @HttpCode(HttpStatus.NO_CONTENT)
  logoutAll(@CurrentActor() actor: RequestActor) {
    return this.auth.logoutEverywhere(actor.id);
  }
}
