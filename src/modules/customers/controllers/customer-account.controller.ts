import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentActor, Realms, type RequestActor } from '../../../common/auth/auth.decorators';
import { AttachPhoneDto, UpdateCustomerProfileDto, VerifyAttachedPhoneDto } from '../dto/customer.dto';
import { CustomerAuthService } from '../services/customer-auth.service';
import { CustomerService } from '../services/customer.service';

@ApiTags('customers/me')
@Controller('customers/me')
@Realms('CUSTOMER')
export class CustomerAccountController {
  constructor(
    private readonly auth: CustomerAuthService,
    private readonly customers: CustomerService,
  ) {}

  @Get()
  async me(@CurrentActor() actor: RequestActor) {
    return this.customers.toDto(await this.customers.getById(actor.id));
  }

  @Post('sync')
  @HttpCode(HttpStatus.OK)
  async sync(@CurrentActor() actor: RequestActor) {
    return this.customers.toDto(await this.auth.syncProfile(actor));
  }

  @Patch()
  async update(@CurrentActor() actor: RequestActor, @Body() dto: UpdateCustomerProfileDto) {
    return this.customers.toDto(await this.auth.updateProfile(actor, dto));
  }

  @Post('phone/request')
  @HttpCode(HttpStatus.OK)
  requestPhone(@CurrentActor() actor: RequestActor, @Body() dto: AttachPhoneDto) {
    return this.auth.requestPhoneAttachment(actor, dto.phone);
  }

  @Post('phone/verify')
  @HttpCode(HttpStatus.OK)
  async verifyPhone(@CurrentActor() actor: RequestActor, @Body() dto: VerifyAttachedPhoneDto) {
    return this.customers.toDto(await this.auth.verifyPhoneAttachment(actor, dto.phone, dto.code));
  }

  @Get('sessions')
  sessions(@CurrentActor() actor: RequestActor) {
    return this.auth.listSessions(actor);
  }

  @Delete('sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  revokeSession(@CurrentActor() actor: RequestActor, @Param('id') id: string) {
    return this.auth.revokeSession(actor, id);
  }
}
