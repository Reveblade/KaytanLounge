import { Body, Controller, Get, HttpCode, HttpStatus, Injectable, Module, Param, Patch, Post, Query } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Cron } from '@nestjs/schedule';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentActor, Public, Realms, RequirePermissions, type RequestActor } from '../../common/auth/auth.decorators';
import { AuditModule } from '../audit/audit.module';
import { CustomersModule } from '../customers/customers.module';
import { SettingsModule } from '../settings/settings.module';
import { ToursModule } from '../tours/tours.module';
import { Booking, BookingSchema } from './booking.schema';
import { BookingService } from './booking.service';
import { DashboardService } from './dashboard.service';
import {
  AdminCreateBookingDto,
  ApprovePaymentDto,
  BookingQueryDto,
  CancelBookingDto,
  CheckInDto,
  CreateBookingDto,
  QuoteDto,
  RefundDto,
  RejectPaymentDto,
  UpdatePassengersDto,
} from './dto/booking.dto';
import { PaymentsService } from './payments.service';

@ApiTags('bookings')
@Controller('bookings')
export class CustomerBookingsController {
  constructor(private readonly bookings: BookingService) {}

  @Public()
  @Post('quote')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Price a seat selection before signing in' })
  quote(@Body() dto: QuoteDto) {
    return this.bookings.quote(dto);
  }

  @Realms('CUSTOMER')
  @Post()
  create(@CurrentActor() actor: RequestActor, @Body() dto: CreateBookingDto) {
    return this.bookings.createForCustomer(actor, dto);
  }

  @Realms('CUSTOMER')
  @Get()
  list(@CurrentActor() actor: RequestActor) {
    return this.bookings.listForCustomer(actor.id);
  }

  @Realms('CUSTOMER')
  @Get(':id')
  async get(@CurrentActor() actor: RequestActor, @Param('id') id: string) {
    return this.bookings.detail(await this.bookings.getForCustomer(actor, id));
  }

  @Realms('CUSTOMER')
  @Get(':id/ticket')
  async ticket(@CurrentActor() actor: RequestActor, @Param('id') id: string) {
    return this.bookings.ticket(await this.bookings.getForCustomer(actor, id));
  }

  @Realms('CUSTOMER')
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancel(@CurrentActor() actor: RequestActor, @Param('id') id: string, @Body() dto: CancelBookingDto) {
    return this.bookings.detail(await this.bookings.cancelByCustomer(actor, id, dto.reason));
  }
}

@ApiTags('tickets')
@Controller('tickets')
export class TicketsController {
  constructor(private readonly bookings: BookingService) {}

  @Public()
  @Get(':code')
  @ApiOperation({ summary: 'Resolve a scanned QR (code + signature) to the ticket' })
  verify(@Param('code') code: string, @Query('s') sig: string) {
    return this.bookings.verifyTicket(code.toUpperCase(), sig ?? '');
  }
}

@ApiTags('admin/bookings')
@Controller('admin/bookings')
@Realms('ADMIN')
export class AdminBookingsController {
  constructor(private readonly bookings: BookingService) {}

  @Get()
  @RequirePermissions('BOOKINGS_READ')
  list(@Query() query: BookingQueryDto) {
    return this.bookings.listAdmin(query);
  }

  @Get('ticket/:code')
  @RequirePermissions('BOOKINGS_READ')
  @ApiOperation({ summary: 'Look a ticket up by its code (guide check-in screen)' })
  async byCode(@Param('code') code: string) {
    return this.bookings.detail(await this.bookings.findByTicketCode(code));
  }

  @Get('tour/:tourId')
  @RequirePermissions('BOOKINGS_READ')
  forTour(@Param('tourId') tourId: string) {
    return this.bookings.listForTour(tourId);
  }

  @Get(':id')
  @RequirePermissions('BOOKINGS_READ')
  async get(@Param('id') id: string) {
    return this.bookings.detail(await this.bookings.getById(id));
  }

  @Get(':id/ticket')
  @RequirePermissions('BOOKINGS_READ')
  async ticket(@Param('id') id: string) {
    return this.bookings.ticket(await this.bookings.getById(id));
  }

  @Post()
  @RequirePermissions('BOOKINGS_WRITE')
  create(@CurrentActor() actor: RequestActor, @Body() dto: AdminCreateBookingDto) {
    return this.bookings.createManual(actor, dto);
  }

  @Patch(':id')
  @RequirePermissions('BOOKINGS_WRITE')
  async update(@CurrentActor() actor: RequestActor, @Param('id') id: string, @Body() dto: UpdatePassengersDto) {
    return this.bookings.detail(await this.bookings.updatePassengers(actor, id, dto));
  }

  @Post(':id/approve')
  @RequirePermissions('PAYMENTS_APPROVE')
  @HttpCode(HttpStatus.OK)
  async approve(@CurrentActor() actor: RequestActor, @Param('id') id: string, @Body() dto: ApprovePaymentDto) {
    return this.bookings.detail(await this.bookings.approvePayment(actor, id, dto));
  }

  @Post(':id/reject')
  @RequirePermissions('PAYMENTS_APPROVE')
  @HttpCode(HttpStatus.OK)
  async reject(@CurrentActor() actor: RequestActor, @Param('id') id: string, @Body() dto: RejectPaymentDto) {
    return this.bookings.detail(await this.bookings.rejectPayment(actor, id, dto.reason));
  }

  @Post(':id/refund')
  @RequirePermissions('PAYMENTS_REFUND')
  @HttpCode(HttpStatus.OK)
  async refund(@CurrentActor() actor: RequestActor, @Param('id') id: string, @Body() dto: RefundDto) {
    return this.bookings.detail(await this.bookings.refund(actor, id, dto));
  }

  @Post(':id/cancel')
  @RequirePermissions('BOOKINGS_WRITE')
  @HttpCode(HttpStatus.OK)
  async cancel(@CurrentActor() actor: RequestActor, @Param('id') id: string, @Body() dto: CancelBookingDto) {
    return this.bookings.detail(await this.bookings.cancel(actor, id, dto.reason));
  }

  @Post(':id/check-in')
  @RequirePermissions('BOOKINGS_CHECKIN')
  @HttpCode(HttpStatus.OK)
  async checkIn(@CurrentActor() actor: RequestActor, @Param('id') id: string, @Body() dto: CheckInDto) {
    return this.bookings.detail(await this.bookings.checkIn(actor, id, dto));
  }
}

@ApiTags('admin/dashboard')
@Controller('admin/dashboard')
@Realms('ADMIN')
export class AdminDashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  @RequirePermissions('REPORTS_READ')
  summary() {
    return this.dashboard.summary();
  }
}

@Injectable()
class BookingHoldJanitor {
  constructor(private readonly bookings: BookingService) {}

  @Cron('*/5 * * * *')
  async sweep() {
    await this.bookings.expireHolds();
  }
}

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Booking.name, schema: BookingSchema }]),
    ToursModule,
    CustomersModule,
    SettingsModule,
    AuditModule,
  ],
  controllers: [CustomerBookingsController, TicketsController, AdminBookingsController, AdminDashboardController],
  providers: [BookingService, PaymentsService, DashboardService, BookingHoldJanitor],
  exports: [BookingService, PaymentsService],
})
export class BookingsModule {}
