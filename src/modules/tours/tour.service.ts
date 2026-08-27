import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { QueryFilter, Model, Types } from 'mongoose';
import type { RequestActor } from '../../common/auth/auth.decorators';
import { ConflictActionException, DomainException, EntityNotFoundException, ForbiddenActionException } from '../../common/exceptions/domain.exception';
import { iso, toObjectId } from '../../common/utils/mongo';
import { addMinutes, istanbulLocalToDate } from '../../common/utils/time';
import type { Paginated, TourDetailDto, TourDto, TourListItemDto, TourSummaryDto, TourTemplateDto } from '../../contract/api';
import { AuditService } from '../audit/audit.service';
import { seatLabels } from '../fleet/seat-map';
import { VehicleService } from '../fleet/fleet.module';
import type { VehicleDocument } from '../fleet/vehicle.schema';
import { GuideService, type GuideDocument } from '../guides/guides.module';
import { RouteService } from '../routes/route.service';
import type { RouteDocument } from '../routes/schemas/route.schema';
import { ACTIVE_BOOKING_STATUSES, Booking } from '../bookings/booking.schema';
import {
  CreateFromTemplateDto,
  CreateTemplateDto,
  CreateTourDto,
  DuplicateTourDto,
  SaveTemplateDto,
  TourCoreDto,
  TourQueryDto,
  UpdateTemplateDto,
  UpdateTourDto,
} from './dto/tour.dto';
import { Tour, TourDocument, TourTemplate, TourTemplateDocument } from './schemas/tour.schema';
import { TourCoreFields } from './schemas/tour-core.schema';
import { SeatAvailabilityService, type SeatAvailability } from './seat-availability.service';

export interface TourRelations {
  routes: Map<string, RouteDocument>;
  guides: Map<string, GuideDocument>;
  vehicles: Map<string, VehicleDocument>;
}

@Injectable()
export class TourService {
  constructor(
    @InjectModel(Tour.name) private readonly tours: Model<Tour>,
    @InjectModel(TourTemplate.name) private readonly templates: Model<TourTemplate>,
    @InjectModel(Booking.name) private readonly bookings: Model<Booking>,
    private readonly routes: RouteService,
    private readonly guides: GuideService,
    private readonly vehicles: VehicleService,
    private readonly availability: SeatAvailabilityService,
    private readonly audit: AuditService,
  ) {}

  // ------------------------------------------------------------------ reads

  async list(actor: RequestActor | undefined, query: TourQueryDto): Promise<Paginated<TourListItemDto>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const filter: QueryFilter<Tour> = {};
    if (query.status) filter.status = query.status;
    if (query.routeId) filter.routeId = toObjectId(query.routeId, 'routeId');
    if (query.guideId) filter.guideId = toObjectId(query.guideId, 'guideId');
    if (query.vehicleId) filter.vehicleId = toObjectId(query.vehicleId, 'vehicleId');
    if (query.mine) {
      if (!actor?.guideId) return { items: [], total: 0, page, pageSize };
      filter.guideId = new Types.ObjectId(actor.guideId);
    }
    if (query.from || query.to) {
      filter.startsAt = {};
      if (query.from) filter.startsAt.$gte = new Date(query.from);
      if (query.to) filter.startsAt.$lte = new Date(query.to);
    }
    const [docs, total] = await Promise.all([
      this.tours.find(filter).sort({ startsAt: 1 }).skip((page - 1) * pageSize).limit(pageSize),
      this.tours.countDocuments(filter),
    ]);
    const relations = await this.loadRelations(docs);
    const avail = await this.availability.forTours(docs, relations.vehicles);
    return { items: docs.map((t) => this.toListItem(t, relations, avail.get(String(t._id)))), total, page, pageSize };
  }

  async getById(id: string): Promise<TourDocument> {
    const doc = await this.tours.findById(toObjectId(id, 'tourId'));
    if (!doc) throw new EntityNotFoundException('Tour', id);
    return doc;
  }

  async getDetail(id: string, opts?: { publicOnly?: boolean }): Promise<TourDetailDto> {
    const tour = await this.getById(id);
    if (opts?.publicOnly && tour.status !== 'PUBLISHED') throw new EntityNotFoundException('Tour', id);
    const relations = await this.loadRelations([tour]);
    const route = relations.routes.get(String(tour.routeId));
    const guide = relations.guides.get(String(tour.guideId));
    const vehicle = relations.vehicles.get(String(tour.vehicleId));
    if (!route || !guide || !vehicle) throw new DomainException('TOUR_INCOMPLETE', 'Tour references a missing route, guide or vehicle', 500);
    const avail = await this.availability.forTour(tour, vehicle);
    return {
      ...this.toDto(tour, avail),
      route: this.routes.toDto(route),
      guide: this.guides.toDto(guide),
      vehicle: this.vehicles.toDto(vehicle),
      seatsLeft: avail.seatsLeft,
      unavailableSeats: avail.unavailableSeats,
    };
  }

  /** Published future departures for the website, grouped by route. */
  async upcomingByRoute(routeIds: Types.ObjectId[]): Promise<Map<string, TourSummaryDto[]>> {
    const docs = await this.tours
      .find({ routeId: { $in: routeIds }, status: 'PUBLISHED', startsAt: { $gte: new Date() } })
      .sort({ startsAt: 1 })
      .limit(400);
    const relations = await this.loadRelations(docs);
    const avail = await this.availability.forTours(docs, relations.vehicles);
    const out = new Map<string, TourSummaryDto[]>();
    for (const tour of docs) {
      const guide = relations.guides.get(String(tour.guideId));
      const vehicle = relations.vehicles.get(String(tour.vehicleId));
      if (!guide || !vehicle) continue;
      const list = out.get(String(tour.routeId)) ?? [];
      list.push(this.toSummary(tour, guide, vehicle, avail.get(String(tour._id))!));
      out.set(String(tour.routeId), list);
    }
    return out;
  }

  async loadRelations(tours: TourCoreFields[]): Promise<TourRelations> {
    const [routes, guides, vehicles] = await Promise.all([
      this.routes.findByIds([...new Set(tours.map((t) => String(t.routeId)))]),
      this.guides.findByIds([...new Set(tours.map((t) => String(t.guideId)))]),
      this.vehicles.findByIds([...new Set(tours.map((t) => String(t.vehicleId)))]),
    ]);
    return { routes, guides, vehicles };
  }

  // ----------------------------------------------------------------- writes

  async create(actor: RequestActor | undefined, dto: CreateTourDto): Promise<TourDocument> {
    let core: TourCoreDto = dto;
    if (dto.templateId) {
      const template = await this.getTemplate(dto.templateId);
      core = { ...this.templateCore(template), ...stripUndefined(dto) };
    }
    const { route, vehicle } = await this.validateCore(core);
    const startsAt = new Date(dto.startsAt);
    const endsAt = addMinutes(startsAt, core.durationMinutes ?? route.durationMinutes);
    if (!dto.force) await this.assertNoConflict(core.guideId, core.vehicleId, startsAt, endsAt);
    const doc = await this.tours.create({
      ...this.coreToDocument(core),
      startsAt,
      endsAt,
      status: dto.status ?? 'DRAFT',
      publishedAt: dto.status === 'PUBLISHED' ? new Date() : undefined,
      templateId: dto.templateId ? new Types.ObjectId(dto.templateId) : undefined,
      seatCount: seatLabels(vehicle.seatMap).length,
    });
    await this.audit.record(actor, 'tour.create', 'tour', String(doc._id), `${route.slug} ${startsAt.toISOString()}`);
    return doc;
  }

  async update(actor: RequestActor, id: string, dto: UpdateTourDto): Promise<TourDocument> {
    const doc = await this.getById(id);
    if (doc.status === 'COMPLETED') throw new ForbiddenActionException('TOUR_LOCKED', 'Completed tours cannot be edited');
    const { startsAt, force, ...patch } = dto;
    const merged: TourCoreDto = { ...this.documentCore(doc), ...stripUndefined(patch) };
    const { route, vehicle } = await this.validateCore(merged);
    if (patch.vehicleId && patch.vehicleId !== String(doc.vehicleId)) await this.assertSeatsFit(doc, vehicle);
    if (patch.blockedSeats) await this.assertBlockedSeatsFree(doc, patch.blockedSeats);
    const nextStart = startsAt ? new Date(startsAt) : doc.startsAt;
    const nextEnd = addMinutes(nextStart, merged.durationMinutes ?? route.durationMinutes);
    if (!force) await this.assertNoConflict(merged.guideId, merged.vehicleId, nextStart, nextEnd, doc._id);
    Object.assign(doc, this.coreToDocument(merged), { startsAt: nextStart, endsAt: nextEnd, seatCount: seatLabels(vehicle.seatMap).length });
    await doc.save();
    await this.audit.record(actor, 'tour.update', 'tour', String(doc._id), undefined, { fields: Object.keys(dto) });
    return doc;
  }

  async setStatus(actor: RequestActor, id: string, status: Tour['status'], reason?: string): Promise<TourDocument> {
    const doc = await this.getById(id);
    if (doc.status === status) return doc;
    if (status === 'PUBLISHED') {
      if (doc.status === 'CANCELLED' || doc.status === 'COMPLETED') {
        throw new ForbiddenActionException('TOUR_STATUS_INVALID', `A ${doc.status.toLowerCase()} tour cannot be published`);
      }
      doc.publishedAt = new Date();
    }
    if (status === 'DRAFT') {
      const active = await this.bookings.countDocuments({ tourId: doc._id, status: { $in: ACTIVE_BOOKING_STATUSES } });
      if (active > 0) throw new ConflictActionException('TOUR_HAS_BOOKINGS', 'Cancel the bookings before unpublishing', { active });
    }
    if (status === 'CANCELLED') {
      doc.cancelledAt = new Date();
      doc.cancellationReason = reason;
    }
    doc.status = status;
    await doc.save();
    await this.audit.record(actor, `tour.${status.toLowerCase()}`, 'tour', String(doc._id), reason);
    return doc;
  }

  async duplicate(actor: RequestActor, id: string, dto: DuplicateTourDto): Promise<TourDocument> {
    const source = await this.getById(id);
    const core = { ...this.documentCore(source), guideId: dto.guideId ?? String(source.guideId), vehicleId: dto.vehicleId ?? String(source.vehicleId) };
    const created = await this.create(actor, { ...core, startsAt: dto.startsAt, status: 'DRAFT', force: dto.force });
    await this.audit.record(actor, 'tour.duplicate', 'tour', String(created._id), `from ${id}`);
    return created;
  }

  async remove(actor: RequestActor, id: string): Promise<void> {
    const doc = await this.getById(id);
    const any = await this.bookings.countDocuments({ tourId: doc._id });
    if (any > 0) throw new ConflictActionException('TOUR_HAS_BOOKINGS', 'Tours with bookings are cancelled, not deleted');
    await doc.deleteOne();
    await this.audit.record(actor, 'tour.delete', 'tour', id);
  }

  // -------------------------------------------------------------- templates

  async listTemplates(): Promise<TourTemplateDto[]> {
    const docs = await this.templates.find().sort({ name: 1 });
    return docs.map((t) => this.templateToDto(t));
  }

  async getTemplate(id: string): Promise<TourTemplateDocument> {
    const doc = await this.templates.findById(toObjectId(id, 'templateId'));
    if (!doc) throw new EntityNotFoundException('Template', id);
    return doc;
  }

  async createTemplate(actor: RequestActor | undefined, dto: CreateTemplateDto): Promise<TourTemplateDocument> {
    await this.validateCore(dto);
    const doc = await this.templates.create({ ...this.coreToDocument(dto), name: dto.name, defaultStartTime: dto.defaultStartTime ?? '09:00' });
    await this.audit.record(actor, 'template.create', 'tour_template', String(doc._id), doc.name);
    return doc;
  }

  async updateTemplate(actor: RequestActor, id: string, dto: UpdateTemplateDto): Promise<TourTemplateDocument> {
    const doc = await this.getTemplate(id);
    const { name, defaultStartTime, ...patch } = dto;
    const merged: TourCoreDto = { ...this.templateCore(doc), ...stripUndefined(patch) };
    await this.validateCore(merged);
    Object.assign(doc, this.coreToDocument(merged));
    if (name) doc.name = name;
    if (defaultStartTime) doc.defaultStartTime = defaultStartTime;
    await doc.save();
    await this.audit.record(actor, 'template.update', 'tour_template', String(doc._id), doc.name);
    return doc;
  }

  async removeTemplate(actor: RequestActor, id: string): Promise<void> {
    const doc = await this.getTemplate(id);
    await doc.deleteOne();
    await this.audit.record(actor, 'template.delete', 'tour_template', id, doc.name);
  }

  async saveAsTemplate(actor: RequestActor, tourId: string, dto: SaveTemplateDto): Promise<TourTemplateDocument> {
    const tour = await this.getById(tourId);
    const time = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(tour.startsAt);
    return this.createTemplate(actor, { ...this.documentCore(tour), name: dto.name, defaultStartTime: time });
  }

  /** One departure per date, all from the same template. Returns the created tours. */
  /**
   * A season is rolled out in one call, so one clashing day must not abort the run and
   * leave half a month created with nothing said about it. Each date is attempted on its
   * own and a date the guide or the vehicle cannot take is reported back, not thrown.
   */
  async createFromTemplate(
    actor: RequestActor | undefined,
    dto: CreateFromTemplateDto,
  ): Promise<{ created: TourDocument[]; skipped: { date: string; reason: string }[] }> {
    const template = await this.getTemplate(dto.templateId);
    const core = { ...this.templateCore(template), guideId: dto.guideId ?? String(template.guideId), vehicleId: dto.vehicleId ?? String(template.vehicleId) };
    const created: TourDocument[] = [];
    const skipped: { date: string; reason: string }[] = [];
    for (const day of dto.dates) {
      const startsAt = istanbulLocalToDate(day, dto.startTime ?? template.defaultStartTime);
      try {
        created.push(
          await this.create(actor, { ...core, startsAt: startsAt.toISOString(), templateId: dto.templateId, status: dto.status ?? 'DRAFT', force: dto.force }),
        );
      } catch (error) {
        // A clash is an expected outcome for one day of a batch; anything else is a real fault.
        if (!(error instanceof ConflictActionException)) throw error;
        skipped.push({ date: day, reason: error.message });
      }
    }
    return { created, skipped };
  }

  // ----------------------------------------------------------------- mappers

  toDto(doc: TourDocument, avail?: SeatAvailability): TourDto {
    return {
      id: String(doc._id),
      ...this.coreToDto(doc),
      startsAt: doc.startsAt.toISOString(),
      endsAt: doc.endsAt.toISOString(),
      status: doc.status,
      templateId: doc.templateId ? String(doc.templateId) : undefined,
      seatCount: avail?.seatCount ?? doc.seatCount,
      bookedSeats: avail?.bookedSeats.length ?? 0,
      publishedAt: iso(doc.publishedAt),
      cancelledAt: iso(doc.cancelledAt),
      cancellationReason: doc.cancellationReason,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    };
  }

  toListItem(doc: TourDocument, relations: TourRelations, avail?: SeatAvailability): TourListItemDto {
    const route = relations.routes.get(String(doc.routeId));
    const guide = relations.guides.get(String(doc.guideId));
    const vehicle = relations.vehicles.get(String(doc.vehicleId));
    return {
      ...this.toDto(doc, avail),
      routeName: route?.name ?? {},
      routeSlug: route?.slug ?? '',
      guideName: guide ? `${guide.firstName} ${guide.lastName}` : '',
      vehicleName: vehicle?.name ?? '',
      pendingApprovals: avail?.pendingApprovals ?? 0,
    };
  }

  toSummary(doc: TourDocument, guide: GuideDocument, vehicle: VehicleDocument, avail: SeatAvailability): TourSummaryDto {
    const g = this.guides.toDto(guide);
    const v = this.vehicles.toDto(vehicle);
    return {
      id: String(doc._id),
      startsAt: doc.startsAt.toISOString(),
      endsAt: doc.endsAt.toISOString(),
      status: doc.status,
      languages: doc.languages,
      pricing: this.coreToDto(doc).pricing,
      seatCount: avail.seatCount,
      seatsLeft: avail.seatsLeft,
      guide: { id: g.id, displayName: g.displayName, photo: g.photo, languages: g.languages, yearsExperience: g.yearsExperience },
      vehicle: { id: v.id, name: v.name, type: v.type, seatCount: v.seatCount, media: v.media, amenities: v.amenities },
    };
  }

  templateToDto(doc: TourTemplateDocument): TourTemplateDto {
    return {
      id: String(doc._id),
      name: doc.name,
      defaultStartTime: doc.defaultStartTime,
      ...this.coreToDto(doc),
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    };
  }

  private coreToDto(doc: TourCoreFields) {
    return {
      routeId: String(doc.routeId),
      vehicleId: String(doc.vehicleId),
      guideId: String(doc.guideId),
      meetingPoint: {
        name: doc.meetingPoint.name,
        address: doc.meetingPoint.address,
        location: { lat: doc.meetingPoint.location.lat, lng: doc.meetingPoint.location.lng },
        instructions: doc.meetingPoint.instructions,
      },
      languages: doc.languages,
      pricing: {
        currency: doc.pricing.currency,
        tiers: doc.pricing.tiers.map((t) => ({ key: t.key, label: t.label, amount: t.amount, minAge: t.minAge, maxAge: t.maxAge })),
        premiumSeatSurcharge: doc.pricing.premiumSeatSurcharge,
      },
      inclusions: doc.inclusions ?? {},
      exclusions: doc.exclusions ?? {},
      contactPhone: doc.contactPhone,
      whatsapp: doc.whatsapp,
      cancellationPolicy: doc.cancellationPolicy ?? {},
      blockedSeats: doc.blockedSeats,
      minPassengers: doc.minPassengers,
      durationMinutes: doc.durationMinutes,
      internalNotes: doc.internalNotes,
    };
  }

  private documentCore(doc: TourCoreFields): TourCoreDto {
    return this.coreToDto(doc);
  }

  private templateCore(doc: TourTemplateDocument): TourCoreDto {
    return this.coreToDto(doc);
  }

  private coreToDocument(core: TourCoreDto) {
    return {
      routeId: new Types.ObjectId(core.routeId),
      vehicleId: new Types.ObjectId(core.vehicleId),
      guideId: new Types.ObjectId(core.guideId),
      meetingPoint: core.meetingPoint,
      languages: core.languages,
      pricing: { ...core.pricing, premiumSeatSurcharge: core.pricing.premiumSeatSurcharge ?? 0 },
      inclusions: core.inclusions ?? {},
      exclusions: core.exclusions ?? {},
      contactPhone: core.contactPhone,
      whatsapp: core.whatsapp,
      cancellationPolicy: core.cancellationPolicy ?? {},
      blockedSeats: core.blockedSeats ?? [],
      minPassengers: core.minPassengers,
      durationMinutes: core.durationMinutes,
      internalNotes: core.internalNotes,
    };
  }

  // ------------------------------------------------------------ validation

  private async validateCore(core: TourCoreDto) {
    const [route, vehicle, guide] = await Promise.all([
      this.routes.getById(core.routeId),
      this.vehicles.getById(core.vehicleId),
      this.guides.getById(core.guideId),
    ]);
    const labels = new Set(seatLabels(vehicle.seatMap));
    const unknown = (core.blockedSeats ?? []).filter((s) => !labels.has(s));
    if (unknown.length) throw new DomainException('SEATS_UNKNOWN', `Seats ${unknown.join(', ')} are not on ${vehicle.name}`, 400);
    const keys = new Set<string>();
    for (const tier of core.pricing.tiers) {
      if (keys.has(tier.key)) throw new DomainException('PRICING_INVALID', `Tier ${tier.key} appears twice`, 400);
      keys.add(tier.key);
    }
    if (!keys.has('ADULT')) throw new DomainException('PRICING_INVALID', 'An ADULT tier is required', 400);
    return { route, vehicle, guide };
  }

  private async assertNoConflict(guideId: string, vehicleId: string, startsAt: Date, endsAt: Date, excludeId?: Types.ObjectId) {
    const overlap: QueryFilter<Tour> = {
      status: { $in: ['DRAFT', 'PUBLISHED'] },
      startsAt: { $lt: endsAt },
      endsAt: { $gt: startsAt },
      $or: [{ guideId: new Types.ObjectId(guideId) }, { vehicleId: new Types.ObjectId(vehicleId) }],
    };
    if (excludeId) overlap._id = { $ne: excludeId };
    const clash = await this.tours.findOne(overlap);
    if (clash) {
      const what = String(clash.guideId) === guideId ? 'guide' : 'vehicle';
      throw new ConflictActionException('SCHEDULE_CONFLICT', `The ${what} is already on another departure at that time`, {
        conflictingTourId: String(clash._id),
        resource: what,
      });
    }
  }

  private async assertSeatsFit(tour: TourDocument, vehicle: VehicleDocument) {
    const labels = new Set(seatLabels(vehicle.seatMap));
    const active = await this.bookings.find({ tourId: tour._id, status: { $in: ACTIVE_BOOKING_STATUSES } }).select('passengers.seatLabel').lean();
    const missing = active.flatMap((b) => b.passengers.map((p) => p.seatLabel)).filter((s) => !labels.has(s));
    if (missing.length) {
      throw new ConflictActionException('SEATS_NOT_ON_VEHICLE', `Booked seats ${[...new Set(missing)].join(', ')} do not exist on ${vehicle.name}`);
    }
  }

  private async assertBlockedSeatsFree(tour: TourDocument, blocked: string[]) {
    const active = await this.bookings.find({ tourId: tour._id, status: { $in: ACTIVE_BOOKING_STATUSES } }).select('passengers.seatLabel').lean();
    const taken = new Set(active.flatMap((b) => b.passengers.map((p) => p.seatLabel)));
    const clash = blocked.filter((s) => taken.has(s));
    if (clash.length) throw new ConflictActionException('SEATS_ALREADY_BOOKED', `Seats ${clash.join(', ')} are already sold`);
  }
}

function stripUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>;
}
