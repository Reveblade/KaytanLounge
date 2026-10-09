import { createHmac } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { QueryFilter, Model, Types } from 'mongoose';
import * as QRCode from 'qrcode';
import type { RequestActor } from '../../common/auth/auth.decorators';
import {
  ConflictActionException,
  DomainException,
  EntityNotFoundException,
  ForbiddenActionException,
} from '../../common/exceptions/domain.exception';
import { containsRegex, iso, toObjectId } from '../../common/utils/mongo';
import { normalizePhone, ticketCode } from '../../common/utils/text';
import { addMinutes } from '../../common/utils/time';
import type { AppConfig, AuthConfig, BookingConfig } from '../../config/configuration';
import type { BookingDetailDto, BookingDto, Paginated, PaymentProvider, TicketDto } from '../../contract/api';
import { AuditService } from '../audit/audit.service';
import { mediaToDto } from '../catalog/services/media-mapper';
import { CustomerService } from '../customers/services/customer.service';
import { premiumSeatLabels, seatLabels } from '../fleet/seat-map';
import { SettingsService } from '../settings/settings.module';
import type { TourDocument } from '../tours/schemas/tour.schema';
import { SeatAvailabilityService } from '../tours/seat-availability.service';
import { TourService, type TourRelations } from '../tours/tour.service';
import { ACTIVE_BOOKING_STATUSES, Booking, BookingDocument } from './booking.schema';
import {
  AdminCreateBookingDto,
  ApprovePaymentDto,
  BookingPassengerInputDto,
  BookingQueryDto,
  CheckInDto,
  CreateBookingDto,
  QuoteDto,
  RefundDto,
  UpdatePassengersDto,
} from './dto/booking.dto';
import { PaymentsService } from './payments.service';

export interface Quote {
  currency: BookingDto['currency'];
  passengers: { seatLabel: string; fullName: string; tierKey: BookingDto['passengers'][number]['tierKey']; amount: number }[];
  subtotal: number;
  discount: number;
  total: number;
}

@Injectable()
export class BookingService {
  private readonly logger = new Logger(BookingService.name);
  private readonly bookingConfig: BookingConfig;
  private readonly signingSecret: string;
  private readonly websiteOrigin: string;

  constructor(
    @InjectModel(Booking.name) private readonly bookings: Model<Booking>,
    private readonly tours: TourService,
    private readonly availability: SeatAvailabilityService,
    private readonly customers: CustomerService,
    private readonly settings: SettingsService,
    private readonly payments: PaymentsService,
    private readonly audit: AuditService,
    configService: ConfigService,
  ) {
    this.bookingConfig = configService.getOrThrow<BookingConfig>('booking');
    this.signingSecret = configService.getOrThrow<AuthConfig>('auth').refreshSecret;
    this.websiteOrigin = configService.getOrThrow<AppConfig>('app').websiteOrigin;
  }

  // ----------------------------------------------------------------- quotes

  async quote(dto: QuoteDto): Promise<Quote & { tourId: string }> {
    const tour = await this.tours.getById(dto.tourId);
    const relations = await this.tours.loadRelations([tour]);
    const vehicle = relations.vehicles.get(String(tour.vehicleId));
    if (!vehicle) throw new DomainException('TOUR_INCOMPLETE', 'Tour has no vehicle', 500);
    return { tourId: String(tour._id), ...this.price(tour, premiumSeatLabels(vehicle.seatMap), dto.passengers) };
  }

  private price(tour: TourDocument, premium: Set<string>, passengers: BookingPassengerInputDto[]): Quote {
    const tiers = new Map(tour.pricing.tiers.map((t) => [t.key, t.amount]));
    const priced = passengers.map((p) => {
      const base = tiers.get(p.tierKey);
      if (base === undefined) throw new DomainException('TIER_NOT_OFFERED', `This departure has no ${p.tierKey} fare`, 400);
      const surcharge = premium.has(p.seatLabel) ? tour.pricing.premiumSeatSurcharge : 0;
      return { seatLabel: p.seatLabel, fullName: p.fullName.trim(), tierKey: p.tierKey, amount: base + surcharge };
    });
    const subtotal = priced.reduce((s, p) => s + p.amount, 0);
    return { currency: tour.pricing.currency, passengers: priced, subtotal, discount: 0, total: subtotal };
  }

  // ---------------------------------------------------------------- creates

  async createForCustomer(actor: RequestActor, dto: CreateBookingDto): Promise<BookingDetailDto & { instructions: ReturnType<PaymentsService['instructions']>; checkout: Awaited<ReturnType<PaymentsService['createCheckout']>> }> {
    const customer = await this.customers.getById(actor.id);
    const booking = await this.createInternal({
      dto,
      customerId: customer._id,
      locale: dto.locale ?? customer.preferredLocale,
      actor,
    });
    return this.withInstructions(booking, dto.paymentProvider);
  }

  async createManual(actor: RequestActor, dto: AdminCreateBookingDto): Promise<BookingDetailDto> {
    const booking = await this.createInternal({
      dto,
      customerId: dto.customerId ? toObjectId(dto.customerId, 'customerId') : undefined,
      locale: dto.locale ?? 'tr',
      actor,
      createdByAdminId: new Types.ObjectId(actor.id),
      markPaid: dto.markPaid,
      paymentReference: dto.paymentReference,
    });
    return this.detail(booking);
  }

  private async createInternal(input: {
    dto: CreateBookingDto;
    customerId?: Types.ObjectId;
    locale: BookingDto['locale'];
    actor: RequestActor;
    createdByAdminId?: Types.ObjectId;
    markPaid?: boolean;
    paymentReference?: string;
  }): Promise<BookingDocument> {
    const { dto } = input;
    const tour = await this.tours.getById(dto.tourId);
    const isAdmin = input.actor.realm === 'ADMIN';
    if (tour.status !== 'PUBLISHED' && !isAdmin) throw new EntityNotFoundException('Tour', dto.tourId);
    if (tour.status === 'CANCELLED' || tour.status === 'COMPLETED') {
      throw new ConflictActionException('TOUR_NOT_BOOKABLE', 'This departure no longer takes bookings');
    }
    if (tour.startsAt < new Date() && !isAdmin) {
      throw new ConflictActionException('TOUR_DEPARTED', 'This departure has already left');
    }
    const settings = await this.settings.get();
    if (!this.payments.isEnabled(settings, dto.paymentProvider) && !isAdmin) {
      throw new DomainException('PAYMENT_PROVIDER_DISABLED', 'That payment method is not available', 400);
    }

    const relations = await this.tours.loadRelations([tour]);
    const vehicle = relations.vehicles.get(String(tour.vehicleId));
    if (!vehicle) throw new DomainException('TOUR_INCOMPLETE', 'Tour has no vehicle', 500);

    const wanted = dto.passengers.map((p) => p.seatLabel);
    if (new Set(wanted).size !== wanted.length) throw new DomainException('SEATS_DUPLICATED', 'A seat was chosen twice', 400);
    const labels = new Set(seatLabels(vehicle.seatMap));
    const unknown = wanted.filter((s) => !labels.has(s));
    if (unknown.length) throw new DomainException('SEATS_UNKNOWN', `Seats ${unknown.join(', ')} do not exist`, 400);

    const avail = await this.availability.forTour(tour, vehicle);
    const taken = new Set(avail.unavailableSeats);
    const clash = wanted.filter((s) => taken.has(s));
    if (clash.length) throw new ConflictActionException('SEATS_UNAVAILABLE', `Seats ${clash.join(', ')} were just taken`, { seats: clash });

    const quote = this.price(tour, premiumSeatLabels(vehicle.seatMap), dto.passengers);
    const mode = this.payments.modeFor(dto.paymentProvider);
    const now = new Date();
    const paid = Boolean(input.markPaid);
    const status = paid ? 'CONFIRMED' : mode === 'live' ? 'PENDING_PAYMENT' : 'AWAITING_APPROVAL';
    const holdExpiresAt = paid
      ? undefined
      : mode === 'live'
        ? addMinutes(now, this.bookingConfig.holdMinutes)
        : addMinutes(now, this.bookingConfig.approvalHours * 60);

    const booking = await this.bookings.create({
      ticketCode: await this.freshTicketCode(),
      customerId: input.customerId,
      tourId: tour._id,
      status,
      passengers: quote.passengers,
      contact: { fullName: dto.contact.fullName.trim(), phone: normalizePhone(dto.contact.phone), email: dto.contact.email?.trim() },
      subtotal: quote.subtotal,
      discount: quote.discount,
      total: quote.total,
      currency: quote.currency,
      payment: {
        provider: dto.paymentProvider,
        status: paid ? 'PAID' : mode === 'live' ? 'PENDING' : 'UNPAID',
        reference: input.paymentReference,
        approvedByAdminId: paid ? input.createdByAdminId : undefined,
        approvedAt: paid ? now : undefined,
      },
      locale: input.locale,
      notes: dto.notes,
      holdExpiresAt,
      confirmedAt: paid ? now : undefined,
      createdByAdminId: input.createdByAdminId,
    });
    await this.audit.record(input.actor, 'booking.create', 'booking', String(booking._id), `${booking.ticketCode} ${wanted.join(',')}`);
    return booking;
  }

  private async withInstructions(booking: BookingDocument, provider: PaymentProvider) {
    const settings = await this.settings.get();
    const checkout = await this.payments.createCheckout(booking, provider);
    return { ...(await this.detail(booking)), instructions: this.payments.instructions(settings, provider, booking), checkout };
  }

  private async freshTicketCode(): Promise<string> {
    for (let i = 0; i < 5; i += 1) {
      const code = ticketCode();
      if (!(await this.bookings.exists({ ticketCode: code }))) return code;
    }
    throw new DomainException('TICKET_CODE_EXHAUSTED', 'Could not allocate a ticket code', 500);
  }

  // ------------------------------------------------------------------ reads

  async listAdmin(query: BookingQueryDto): Promise<Paginated<BookingDetailDto>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const filter: QueryFilter<Booking> = {};
    if (query.status) filter.status = query.status;
    if (query.tourId) filter.tourId = toObjectId(query.tourId, 'tourId');
    if (query.customerId) filter.customerId = toObjectId(query.customerId, 'customerId');
    if (query.from || query.to) {
      filter.createdAt = {};
      if (query.from) filter.createdAt.$gte = new Date(query.from);
      if (query.to) filter.createdAt.$lte = new Date(query.to);
    }
    if (query.q) {
      const rx = containsRegex(query.q);
      filter.$or = [{ ticketCode: rx }, { 'contact.fullName': rx }, { 'contact.phone': rx }, { 'contact.email': rx }, { 'passengers.fullName': rx }];
    }
    const [docs, total] = await Promise.all([
      this.bookings.find(filter).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize),
      this.bookings.countDocuments(filter),
    ]);
    return { items: await this.details(docs), total, page, pageSize };
  }

  async listForCustomer(customerId: string): Promise<BookingDetailDto[]> {
    const docs = await this.bookings.find({ customerId: new Types.ObjectId(customerId) }).sort({ createdAt: -1 }).limit(100);
    return this.details(docs);
  }

  async listForTour(tourId: string): Promise<BookingDetailDto[]> {
    const docs = await this.bookings.find({ tourId: toObjectId(tourId, 'tourId') }).sort({ createdAt: 1 });
    return this.details(docs);
  }

  async getById(id: string): Promise<BookingDocument> {
    const doc = await this.bookings.findById(toObjectId(id, 'bookingId'));
    if (!doc) throw new EntityNotFoundException('Booking', id);
    return doc;
  }

  async getForCustomer(actor: RequestActor, id: string): Promise<BookingDocument> {
    const doc = await this.getById(id);
    if (String(doc.customerId) !== actor.id) throw new EntityNotFoundException('Booking', id);
    return doc;
  }

  async findByTicketCode(code: string): Promise<BookingDocument> {
    const doc = await this.bookings.findOne({ ticketCode: code.trim().toUpperCase() });
    if (!doc) throw new EntityNotFoundException('Booking', code);
    return doc;
  }

  // ------------------------------------------------------------- lifecycle

  async cancelByCustomer(actor: RequestActor, id: string, reason?: string): Promise<BookingDocument> {
    const doc = await this.getForCustomer(actor, id);
    if (doc.status === 'CONFIRMED') {
      throw new ForbiddenActionException('CANCEL_VIA_SUPPORT', 'Confirmed tickets are cancelled through our team; call the number on your ticket');
    }
    if (!ACTIVE_BOOKING_STATUSES.includes(doc.status)) return doc;
    doc.status = 'CANCELLED';
    doc.cancelledAt = new Date();
    doc.cancellationReason = reason ?? 'Cancelled by customer';
    await doc.save();
    await this.audit.record(actor, 'booking.cancel', 'booking', String(doc._id), doc.ticketCode);
    return doc;
  }

  async cancel(actor: RequestActor, id: string, reason?: string): Promise<BookingDocument> {
    const doc = await this.getById(id);
    if (doc.status === 'CANCELLED' || doc.status === 'REFUNDED') return doc;
    doc.status = 'CANCELLED';
    doc.cancelledAt = new Date();
    doc.cancellationReason = reason;
    await doc.save();
    await this.audit.record(actor, 'booking.cancel', 'booking', String(doc._id), `${doc.ticketCode}: ${reason ?? ''}`);
    return doc;
  }

  async cancelForTour(actor: RequestActor, tourId: Types.ObjectId, reason: string): Promise<number> {
    const result = await this.bookings.updateMany(
      { tourId, status: { $in: ACTIVE_BOOKING_STATUSES } },
      { $set: { status: 'CANCELLED', cancelledAt: new Date(), cancellationReason: reason } },
    );
    await this.audit.record(actor, 'booking.cancel_bulk', 'tour', String(tourId), reason, { count: result.modifiedCount });
    return result.modifiedCount;
  }

  async approvePayment(actor: RequestActor, id: string, dto: ApprovePaymentDto): Promise<BookingDocument> {
    const doc = await this.getById(id);
    if (doc.status === 'CONFIRMED') return doc;
    if (doc.status !== 'AWAITING_APPROVAL' && doc.status !== 'PENDING_PAYMENT' && doc.status !== 'EXPIRED') {
      throw new ConflictActionException('BOOKING_NOT_APPROVABLE', `A ${doc.status.toLowerCase()} booking cannot be approved`);
    }
    // An expired hold can still be honoured if the seats are still free.
    const tour = await this.tours.getById(String(doc.tourId));
    const relations = await this.tours.loadRelations([tour]);
    const vehicle = relations.vehicles.get(String(tour.vehicleId))!;
    const avail = await this.availability.forTour(tour, vehicle);
    const mine = new Set(doc.status === 'EXPIRED' ? [] : doc.passengers.map((p) => p.seatLabel));
    const clash = doc.passengers.map((p) => p.seatLabel).filter((s) => avail.unavailableSeats.includes(s) && !mine.has(s));
    if (clash.length) throw new ConflictActionException('SEATS_UNAVAILABLE', `Seats ${clash.join(', ')} were sold to someone else`, { seats: clash });

    doc.status = 'CONFIRMED';
    doc.confirmedAt = new Date();
    doc.holdExpiresAt = undefined;
    doc.payment.status = 'PAID';
    doc.payment.reference = dto.reference ?? doc.payment.reference;
    if (dto.provider) doc.payment.provider = dto.provider;
    doc.payment.note = dto.note ?? doc.payment.note;
    doc.payment.approvedByAdminId = new Types.ObjectId(actor.id);
    doc.payment.approvedAt = new Date();
    await doc.save();
    await this.audit.record(actor, 'payment.approve', 'booking', String(doc._id), `${doc.ticketCode} ${dto.reference ?? ''}`);
    return doc;
  }

  async rejectPayment(actor: RequestActor, id: string, reason: string): Promise<BookingDocument> {
    const doc = await this.getById(id);
    doc.status = 'CANCELLED';
    doc.cancelledAt = new Date();
    doc.cancellationReason = reason;
    doc.payment.status = 'FAILED';
    doc.payment.note = reason;
    await doc.save();
    await this.audit.record(actor, 'payment.reject', 'booking', String(doc._id), `${doc.ticketCode}: ${reason}`);
    return doc;
  }

  async refund(actor: RequestActor, id: string, dto: RefundDto): Promise<BookingDocument> {
    const doc = await this.getById(id);
    if (doc.payment.status !== 'PAID') throw new ConflictActionException('NOT_PAID', 'Only paid bookings can be refunded');
    const amount = dto.amount ?? doc.total;
    if (amount > doc.total) throw new DomainException('REFUND_TOO_LARGE', 'Refund exceeds the amount paid', 400);
    doc.payment.status = 'REFUNDED';
    doc.payment.refundedAt = new Date();
    doc.payment.refundAmount = amount;
    doc.payment.note = dto.note ?? doc.payment.note;
    doc.status = 'REFUNDED';
    doc.cancelledAt = doc.cancelledAt ?? new Date();
    await doc.save();
    await this.audit.record(actor, 'payment.refund', 'booking', String(doc._id), `${doc.ticketCode} ${amount}`);
    return doc;
  }

  async checkIn(actor: RequestActor, id: string, dto: CheckInDto): Promise<BookingDocument> {
    const doc = await this.getById(id);
    if (doc.status !== 'CONFIRMED') throw new ConflictActionException('NOT_CONFIRMED', 'Only confirmed tickets can be checked in');
    if (actor.roleKey === 'tour_guide' && !actor.isOwner) {
      const tour = await this.tours.getById(String(doc.tourId));
      if (String(tour.guideId) !== actor.guideId) throw new ForbiddenActionException('NOT_YOUR_TOUR', 'This ticket belongs to another guide\'s departure');
    }
    const targets = new Set(dto.seatLabels ?? doc.passengers.map((p) => p.seatLabel));
    const now = new Date();
    for (const passenger of doc.passengers) {
      if (!targets.has(passenger.seatLabel)) continue;
      passenger.checkedInAt = dto.undo ? undefined : now;
    }
    doc.markModified('passengers');
    await doc.save();
    await this.audit.record(actor, dto.undo ? 'booking.checkin_undo' : 'booking.checkin', 'booking', String(doc._id), [...targets].join(','));
    return doc;
  }

  async updatePassengers(actor: RequestActor, id: string, dto: UpdatePassengersDto): Promise<BookingDocument> {
    const doc = await this.getById(id);
    if (!ACTIVE_BOOKING_STATUSES.includes(doc.status)) throw new ConflictActionException('BOOKING_LOCKED', 'This booking is closed');
    const tour = await this.tours.getById(String(doc.tourId));
    const relations = await this.tours.loadRelations([tour]);
    const vehicle = relations.vehicles.get(String(tour.vehicleId))!;
    const labels = new Set(seatLabels(vehicle.seatMap));
    const wanted = dto.passengers.map((p) => p.seatLabel);
    const unknown = wanted.filter((s) => !labels.has(s));
    if (unknown.length) throw new DomainException('SEATS_UNKNOWN', `Seats ${unknown.join(', ')} do not exist`, 400);
    const avail = await this.availability.forTour(tour, vehicle);
    const mine = new Set(doc.passengers.map((p) => p.seatLabel));
    const clash = wanted.filter((s) => avail.unavailableSeats.includes(s) && !mine.has(s));
    if (clash.length) throw new ConflictActionException('SEATS_UNAVAILABLE', `Seats ${clash.join(', ')} are taken`, { seats: clash });
    const quote = this.price(tour, premiumSeatLabels(vehicle.seatMap), dto.passengers);
    const checked = new Map(doc.passengers.map((p) => [p.seatLabel, p.checkedInAt]));
    doc.passengers = quote.passengers.map((p) => ({ ...p, checkedInAt: checked.get(p.seatLabel) }));
    doc.subtotal = quote.subtotal;
    doc.total = quote.total;
    if (dto.contact) doc.contact = { fullName: dto.contact.fullName, phone: normalizePhone(dto.contact.phone), email: dto.contact.email };
    if (dto.notes !== undefined) doc.notes = dto.notes;
    await doc.save();
    await this.audit.record(actor, 'booking.update', 'booking', String(doc._id), doc.ticketCode);
    return doc;
  }

  /** Runs every few minutes: unpaid holds past their deadline release their seats. */
  async expireHolds(): Promise<number> {
    const result = await this.bookings.updateMany(
      { status: { $in: ['PENDING_PAYMENT', 'AWAITING_APPROVAL'] }, holdExpiresAt: { $lt: new Date() } },
      { $set: { status: 'EXPIRED' } },
    );
    if (result.modifiedCount) this.logger.log(`expired ${result.modifiedCount} unpaid booking(s)`);
    return result.modifiedCount;
  }

  // ---------------------------------------------------------------- tickets

  signature(code: string): string {
    return createHmac('sha256', this.signingSecret).update(code).digest('base64url').slice(0, 12);
  }

  ticketUrl(code: string): string {
    return `${this.websiteOrigin}/t/${code}?s=${this.signature(code)}`;
  }

  async ticket(booking: BookingDocument): Promise<TicketDto> {
    const qrDataUrl = await QRCode.toDataURL(this.ticketUrl(booking.ticketCode), {
      margin: 1,
      width: 640,
      errorCorrectionLevel: 'M',
      color: { dark: '#0c0e14', light: '#ffffff' },
    });
    return { booking: await this.detail(booking), qrDataUrl };
  }

  /** Public ticket lookup by code + signature; the QR resolves here. */
  async verifyTicket(code: string, sig: string): Promise<BookingDetailDto> {
    if (this.signature(code) !== sig) throw new EntityNotFoundException('Ticket', code);
    return this.detail(await this.findByTicketCode(code));
  }

  // ---------------------------------------------------------------- mappers

  async detail(doc: BookingDocument): Promise<BookingDetailDto> {
    const [detail] = await this.details([doc]);
    return detail;
  }

  async details(docs: BookingDocument[]): Promise<BookingDetailDto[]> {
    if (!docs.length) return [];
    const tourIds = [...new Set(docs.map((d) => String(d.tourId)))];
    const tours = await Promise.all(tourIds.map((id) => this.tours.getById(id).catch(() => undefined)));
    const tourMap = new Map(tours.filter(Boolean).map((t) => [String(t!._id), t!]));
    const relations = await this.tours.loadRelations([...tourMap.values()]);
    const customerIds = docs.map((d) => d.customerId).filter(Boolean) as Types.ObjectId[];
    const customers = await this.customers.findByIds(customerIds);
    return docs.map((doc) => this.toDetail(doc, tourMap.get(String(doc.tourId)), relations, customers.get(String(doc.customerId))));
  }

  toDto(doc: BookingDocument): BookingDto {
    return {
      id: String(doc._id),
      ticketCode: doc.ticketCode,
      customerId: doc.customerId ? String(doc.customerId) : undefined,
      tourId: String(doc.tourId),
      status: doc.status,
      passengers: doc.passengers.map((p) => ({ seatLabel: p.seatLabel, fullName: p.fullName, tierKey: p.tierKey, amount: p.amount, checkedInAt: iso(p.checkedInAt) })),
      contact: { fullName: doc.contact.fullName, phone: doc.contact.phone, email: doc.contact.email },
      subtotal: doc.subtotal,
      discount: doc.discount,
      total: doc.total,
      currency: doc.currency,
      payment: {
        provider: doc.payment.provider,
        status: doc.payment.status,
        reference: doc.payment.reference,
        approvedByAdminId: doc.payment.approvedByAdminId ? String(doc.payment.approvedByAdminId) : undefined,
        approvedAt: iso(doc.payment.approvedAt),
        refundedAt: iso(doc.payment.refundedAt),
        refundAmount: doc.payment.refundAmount,
        note: doc.payment.note,
      },
      locale: doc.locale,
      notes: doc.notes,
      holdExpiresAt: iso(doc.holdExpiresAt),
      confirmedAt: iso(doc.confirmedAt),
      cancelledAt: iso(doc.cancelledAt),
      cancellationReason: doc.cancellationReason,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    };
  }

  private toDetail(
    doc: BookingDocument,
    tour: TourDocument | undefined,
    relations: TourRelations,
    customer?: { _id: Types.ObjectId; displayName: string; phone?: string; email?: string },
  ): BookingDetailDto {
    const route = tour ? relations.routes.get(String(tour.routeId)) : undefined;
    const guide = tour ? relations.guides.get(String(tour.guideId)) : undefined;
    const vehicle = tour ? relations.vehicles.get(String(tour.vehicleId)) : undefined;
    return {
      ...this.toDto(doc),
      customer: customer ? { id: String(customer._id), displayName: customer.displayName, phone: customer.phone, email: customer.email } : undefined,
      tour: {
        id: String(doc.tourId),
        startsAt: tour?.startsAt.toISOString() ?? '',
        endsAt: tour?.endsAt.toISOString() ?? '',
        status: tour?.status ?? 'CANCELLED',
        meetingPoint: tour
          ? { name: tour.meetingPoint.name, address: tour.meetingPoint.address, location: { lat: tour.meetingPoint.location.lat, lng: tour.meetingPoint.location.lng }, instructions: tour.meetingPoint.instructions }
          : { name: {}, location: { lat: 0, lng: 0 } },
        contactPhone: tour?.contactPhone ?? '',
        whatsapp: tour?.whatsapp,
        route: route
          ? { id: String(route._id), slug: route.slug, name: route.name, tagline: route.tagline, cover: mediaToDto(route.cover), durationMinutes: route.durationMinutes }
          : { id: '', slug: '', name: {}, tagline: {}, durationMinutes: 0 },
        guide: guide
          ? { id: String(guide._id), displayName: `${guide.firstName} ${guide.lastName}`, photo: mediaToDto(guide.photo), languages: guide.languages, phone: guide.phone }
          : { id: '', displayName: '', languages: [] },
        vehicle: vehicle ? { id: String(vehicle._id), name: vehicle.name, type: vehicle.type, plate: vehicle.plate } : { id: '', name: '', type: 'MINIBUS' },
      },
    };
  }
}
