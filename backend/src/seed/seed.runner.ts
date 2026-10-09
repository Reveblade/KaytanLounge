import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { INestApplicationContext, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getConnectionToken } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
import type { MediaItemDto } from '../common/dto/common.dto';
import { addDays, istanbulLocalToDate } from '../common/utils/time';
import type { AuthConfig } from '../config/configuration';
import { AttractionService } from '../modules/catalog/services/attraction.service';
import { BusinessService } from '../modules/catalog/services/business.service';
import { mediaListToDto } from '../modules/catalog/services/media-mapper';
import { CustomerService } from '../modules/customers/services/customer.service';
import { VehicleService } from '../modules/fleet/fleet.module';
import { generateSeatMap } from '../modules/fleet/seat-map';
import { GuideService } from '../modules/guides/guides.module';
import { AdminService } from '../modules/iam/services/admin.service';
import { RoleService } from '../modules/iam/services/role.service';
import { MediaService } from '../modules/media/media.module';
import { RouteService } from '../modules/routes/route.service';
import { SettingsService } from '../modules/settings/settings.module';
import { TourService } from '../modules/tours/tour.service';
import { BookingService } from '../modules/bookings/booking.service';
import { loadAttractions, loadBusinesses, loadVehicleImages, loadVenuePhotos, wikimediaThumb, type SeedBusiness, type SeedLocalPhoto, type SeedMedia } from './content';
import { SEED_ADMINS, SEED_ADMIN_PASSWORD, SEED_GUIDES, SEED_VEHICLES } from './data/fleet-and-guides';
import { SEED_ROUTES, SEED_SCHEDULE, type SeedRoute } from './data/routes';
import type { RequestActor } from '../common/auth/auth.decorators';

interface SeedOptions {
  reset: boolean;
  importMedia: boolean;
}

const SEED_ACTOR: RequestActor = { id: 'seed', realm: 'ADMIN', sessionId: 'seed', displayName: 'Seed', isOwner: true, tier: 'OWNER', roleKey: 'owner', permissions: [] };

/** Partner marks shipped with the repo, relative to the backend working directory. */
const LOGO_BY_SLUG: Record<string, string> = {
  'kaytan-lounge': '../website/public/partners/kaytan-lounge.png',
  'green-corner': '../website/public/partners/green-corner.png',
};

export class SeedRunner {
  constructor(
    private readonly app: INestApplicationContext,
    private readonly logger: Logger,
  ) {}

  private get<T>(token: new (...args: never[]) => T): T {
    return this.app.get(token, { strict: false });
  }

  async run(options: SeedOptions): Promise<void> {
    const connection = this.app.get<Connection>(getConnectionToken(), { strict: false });
    if (options.importMedia) await this.indexHostedMedia(connection);
    if (options.reset) {
      for (const name of ['attractions', 'businesses', 'routes', 'vehicles', 'guides', 'tours', 'tour_templates', 'bookings', 'customers', 'customer_sessions', 'audit_logs']) {
        await connection.db?.collection(name).deleteMany({});
      }
      this.logger.warn('reset: cleared content, fleet, tours, bookings and customers (admins kept)');
    }

    await this.roles();
    const owner = await this.owner();
    await this.admins();
    await this.settings();
    const media = this.get(MediaService);
    const attractions = await this.attractions(options.importMedia ? media : undefined);
    const businesses = await this.businesses(options.importMedia ? media : undefined);
    const vehicles = await this.vehicles(options.importMedia ? media : undefined);
    const guides = await this.guides();
    const routes = await this.routes(attractions, businesses);
    await this.toursAndTemplates(routes, vehicles, guides, businesses);
    await this.demoBookings(String(owner._id));

    this.logger.log('----------------------------------------------------------');
    this.logger.log(`Owner: ${owner.email} (password from OWNER_PASSWORD in .env)`);
    this.logger.log(`Other admins + guides: password "${SEED_ADMIN_PASSWORD}"`);
    this.logger.log('Seed complete.');
  }

  // ------------------------------------------------------------------ IAM

  private async roles() {
    await this.get(RoleService).ensureSystemRoles();
    this.logger.log('roles: system and preset roles ensured');
  }

  private async owner() {
    const auth = this.get(ConfigService).getOrThrow<AuthConfig>('auth');
    // `OWNER_PASSWORD_RESET=1 npm run seed` forces the owner's password back to
    // OWNER_PASSWORD and signs their sessions out. The only recovery path there is.
    const resetPassword = process.env.OWNER_PASSWORD_RESET === '1';
    const owner = await this.get(AdminService).ensureOwner({ ...auth.owner, resetPassword });
    this.logger.log(`owner: ${owner.email}${resetPassword ? ' (password reset from OWNER_PASSWORD)' : ''}`);
    return owner;
  }

  private async admins() {
    const admins = this.get(AdminService);
    for (const seed of SEED_ADMINS) {
      await admins.upsertByEmail({ ...seed, password: SEED_ADMIN_PASSWORD });
    }
    this.logger.log(`admins: ${SEED_ADMINS.length} preset accounts ensured`);
  }

  private async settings() {
    const settings = this.get(SettingsService);
    const current = await settings.document();
    if (!current.phone) {
      await settings.update(undefined, {
        brandName: 'Başka İstanbul Yok',
        tagline: { tr: 'Şehri bir günde, bir rota ile.', en: 'The whole city, one route, one day.' },
        email: 'hello@baskaistanbulyok.com',
        instagram: 'baskaistanbulyok',
        address: 'Kaytan Lounge, İstanbul',
        defaultCurrency: 'EUR',
        bankHolder: 'Kaytan Lounge Turizm',
        featuredRouteSlugs: SEED_ROUTES.filter((r) => r.featured).map((r) => r.slug),
      });
    }
    this.logger.log('settings: ensured');
  }

  // -------------------------------------------------------------- content

  /**
   * Photos already re-hosted in an earlier run, keyed by the source page they came from.
   * Wikimedia rate limits hard and the seed is meant to be re-runnable, so a second run
   * downloads only the photos that are genuinely new.
   */
  private readonly hostedBySource = new Map<string, MediaItemDto>();

  private async indexHostedMedia(connection: Connection): Promise<void> {
    for (const name of ['attractions', 'businesses', 'vehicles', 'guides']) {
      const docs = await connection.db?.collection(name).find({}, { projection: { media: 1 } }).toArray();
      for (const doc of docs ?? []) {
        for (const item of ((doc.media ?? []) as MediaItemDto[])) {
          // EXTERNAL means the earlier import failed and left the origin URL behind: retry those.
          if (item.sourceUrl && item.provider !== 'EXTERNAL') this.hostedBySource.set(item.sourceUrl, item);
        }
      }
    }
    if (this.hostedBySource.size) this.logger.log(`media: ${this.hostedBySource.size} photos already hosted, reusing`);
  }

  private async mediaItems(items: SeedMedia[], media: MediaService | undefined, folder: string): Promise<MediaItemDto[]> {
    const out: MediaItemDto[] = [];
    for (const item of items) {
      const credits = { alt: item.alt, credit: item.credit, license: item.license, sourceUrl: item.source };
      if (media) {
        const cached = item.source ? this.hostedBySource.get(item.source) : undefined;
        if (cached) {
          out.push({ ...cached, ...credits });
          continue;
        }
        const hosted = await media.importFromUrl(item.url, folder);
        if (hosted) {
          const dto: MediaItemDto = { ...hosted, ...credits };
          if (item.source) this.hostedBySource.set(item.source, dto);
          out.push(dto);
          continue;
        }
      }
      out.push({ kind: 'IMAGE', url: item.url, thumbnailUrl: wikimediaThumb(item.url, 640), provider: 'EXTERNAL', ...credits });
    }
    return out;
  }

  private async attractions(media?: MediaService) {
    const service = this.get(AttractionService);
    const bySlug = new Map<string, Awaited<ReturnType<AttractionService['upsertBySlug']>>>();
    const content = loadAttractions();
    for (const a of content) {
      const doc = await service.upsertBySlug({
        slug: a.slug,
        type: a.type,
        name: a.name,
        summary: a.summary,
        description: a.description,
        tips: a.tips,
        district: a.district,
        address: a.address,
        location: a.location,
        openingHours: a.openingHours,
        ticket: a.ticket,
        visitMinutes: a.visitMinutes,
        tags: a.tags ?? [],
        media: await this.mediaItems(a.media, media, 'attractions'),
        featured: false,
        status: 'PUBLISHED',
      });
      bySlug.set(a.slug, doc);
    }
    this.logger.log(`attractions: ${content.length} upserted`);
    return bySlug;
  }

  private async businesses(media?: MediaService) {
    const service = this.get(BusinessService);
    const bySlug = new Map<string, Awaited<ReturnType<BusinessService['upsertBySlug']>>>();
    for (const b of loadBusinesses()) {
      const isTitle = b.sponsorTier === 'TITLE';
      const doc = await service.upsertBySlug({
        slug: b.slug,
        category: b.category,
        sponsorTier: b.sponsorTier,
        name: b.name,
        summary: b.summary,
        description: b.description,
        district: b.district,
        address: b.address,
        location: b.location,
        contact: b.contact,
        openingHours: b.openingHours,
        cuisine: b.cuisine ?? [],
        features: b.features,
        offer: isTitle
          ? { tr: 'Bilet sahiplerine hoş geldin çayı ve Boğaz terasında öncelikli masa.', en: 'A welcome tea for ticket holders and priority seating on the Bosphorus terrace.' }
          : { tr: 'Bilet sahiplerine günün tatlısı ikramı.', en: 'Dessert of the day, on the house, for ticket holders.' },
        visitMinutes: b.visitMinutes ?? 90,
        media: await this.venueMedia(b, media),
        logo: await this.logoFor(b.slug, media),
        featured: true,
        status: 'PUBLISHED',
      });
      bySlug.set(b.slug, doc);
    }
    this.logger.log(`businesses: ${bySlug.size} upserted`);
    return bySlug;
  }

  /**
   * Partner logotypes ship with the repo as trimmed PNGs. They are re-hosted through
   * MediaService like every other image, so both clients get one absolute URL that
   * does not depend on which origin happens to serve the website.
   */
  /**
   * Which photographs a partner venue ends up with, in order of authority:
   *
   * 1. Files the operator dropped into `seed-content/venues/<slug>/` — the venue's own
   *    photography, and the reason that folder exists.
   * 2. Whatever an admin has already curated on the record. A re-seed must never wipe
   *    photographs someone uploaded through the panel.
   * 3. The stand-in photography listed in businesses.json.
   */
  private async venueMedia(b: SeedBusiness, media?: MediaService): Promise<MediaItemDto[]> {
    const own = loadVenuePhotos(b.slug);
    if (own.length) return this.localPhotos(own, media, 'partners');

    const service = this.get(BusinessService);
    const existing = await service.findBySlug(b.slug);
    if (existing?.media?.length) return mediaListToDto(existing.media);

    return this.mediaItems(b.media, media, 'businesses');
  }

  /** Photographs supplied as files rather than URLs; re-hosted the same way as any other. */
  private async localPhotos(items: SeedLocalPhoto[], media: MediaService | undefined, folder: string): Promise<MediaItemDto[]> {
    const out: MediaItemDto[] = [];
    for (const item of items) {
      const credits = { alt: item.alt, credit: item.credit, license: item.license, sourceUrl: item.source };
      const hosted = media ? await media.importFromFile(item.path, folder) : undefined;
      if (hosted) out.push({ ...hosted, ...credits });
      else this.logger.warn(`venue photo skipped (run with SEED_MEDIA=import): ${item.path}`);
    }
    return out;
  }

  private async logoFor(slug: string, media: MediaService | undefined): Promise<MediaItemDto | undefined> {
    const file = LOGO_BY_SLUG[slug];
    if (!file) return undefined;
    const path = resolve(process.cwd(), file);
    if (!existsSync(path)) {
      this.logger.warn(`logo missing for ${slug}: ${path}`);
      return undefined;
    }
    const service = media ?? this.get(MediaService);
    const hosted = await service.importFromFile(path, 'partners');
    return hosted ? { ...hosted } : undefined;
  }

  // --------------------------------------------------------------- fleet

  private async vehicles(media?: MediaService) {
    const service = this.get(VehicleService);
    const images = loadVehicleImages();
    const byKey = new Map<string, Awaited<ReturnType<VehicleService['upsertByName']>>>();
    for (const v of SEED_VEHICLES) {
      const doc = await service.upsertByName({
        name: v.name,
        type: v.type,
        make: v.make,
        model: v.model,
        year: v.year,
        plate: v.plate,
        seatMap: generateSeatMap(v.seatMap),
        amenities: v.amenities,
        description: v.description,
        media: await this.mediaItems(images[v.key] ?? [], media, 'vehicles'),
        status: 'ACTIVE',
      });
      byKey.set(v.key, doc);
    }
    this.logger.log(`vehicles: ${byKey.size} upserted`);
    return byKey;
  }

  private async guides() {
    const service = this.get(GuideService);
    const docs = [];
    for (const g of SEED_GUIDES) {
      docs.push(
        await service.upsertByEmail({
          firstName: g.firstName,
          lastName: g.lastName,
          email: g.email,
          phone: g.phone,
          birthYear: g.birthYear,
          languages: g.languages,
          yearsExperience: g.yearsExperience,
          specialties: g.specialties,
          licenseNo: g.licenseNo,
          bio: g.bio,
          status: 'ACTIVE',
          adminAccount: { email: g.email, password: SEED_ADMIN_PASSWORD },
        }),
      );
    }
    this.logger.log(`guides: ${docs.length} upserted (each with a tour_guide login)`);
    return docs;
  }

  // -------------------------------------------------------------- routes

  private async routes(
    attractions: Map<string, { _id: unknown; media: unknown[] }>,
    businesses: Map<string, { _id: unknown; media: unknown[] }>,
  ) {
    const service = this.get(RouteService);
    const created = new Map<string, Awaited<ReturnType<RouteService['upsertBySlug']>>>();
    for (const route of SEED_ROUTES) {
      const nodes = [];
      let missing = false;
      for (const stop of route.stops) {
        const place = stop.kind === 'BUSINESS' ? businesses.get(stop.slug) : attractions.get(stop.slug);
        if (!place) {
          this.logger.warn(`route ${route.slug}: missing ${stop.kind.toLowerCase()} "${stop.slug}", skipping stop`);
          missing = true;
          continue;
        }
        nodes.push({ kind: stop.kind, refId: String(place._id), stayMinutes: stop.stayMinutes, note: stop.note });
      }
      if (nodes.length < 2) {
        this.logger.error(`route ${route.slug}: fewer than two resolvable stops, skipped`);
        continue;
      }
      const doc = await service.upsertBySlug({
        slug: route.slug,
        name: route.name,
        tagline: route.tagline,
        description: route.description,
        highlights: route.highlights,
        theme: route.theme,
        pace: route.pace,
        nodes,
        cover: this.coverFor(route, attractions, businesses),
        featured: route.featured,
        status: 'PUBLISHED',
      });
      created.set(route.slug, doc);
      this.logger.log(`route ${route.slug}: ${nodes.length} stops, ${doc.durationMinutes} min, ${doc.distanceKm} km${missing ? ' (some stops missing)' : ''}`);
    }
    return created;
  }

  private coverFor(route: SeedRoute, attractions: Map<string, { media: unknown[] }>, businesses: Map<string, { media: unknown[] }>): MediaItemDto | undefined {
    const source = route.coverFrom ?? route.stops.find((s) => s.kind === 'ATTRACTION')?.slug;
    if (!source) return undefined;
    const place = attractions.get(source) ?? businesses.get(source);
    const first = place?.media?.[0] as { url?: string; thumbnailUrl?: string; provider?: string; credit?: string; license?: string; sourceUrl?: string } | undefined;
    if (!first?.url) return undefined;
    return { kind: 'IMAGE', url: first.url, thumbnailUrl: first.thumbnailUrl, provider: (first.provider as MediaItemDto['provider']) ?? 'EXTERNAL', credit: first.credit, license: first.license, sourceUrl: first.sourceUrl };
  }

  // ---------------------------------------------------------------- tours

  private async toursAndTemplates(
    routes: Map<string, { _id: unknown; slug: string; durationMinutes: number }>,
    vehicles: Map<string, { _id: unknown }>,
    guides: { _id: unknown }[],
    businesses: Map<string, { _id: unknown; location: { lat: number; lng: number }; address?: string }>,
  ) {
    const tours = this.get(TourService);
    const existingTemplates = await tours.listTemplates();
    const kaytan = businesses.get('kaytan-lounge');
    const meetingAtKaytan = kaytan
      ? {
          name: { tr: 'Kaytan Lounge', en: 'Kaytan Lounge' },
          address: kaytan.address,
          location: { lat: kaytan.location.lat, lng: kaytan.location.lng },
          instructions: { tr: 'Resepsiyonda "Başka İstanbul Yok" deyin; çayınız hazır olacak.', en: 'Tell the front desk you are with Başka İstanbul Yok; your tea will be waiting.' },
        }
      : {
          name: { tr: 'Sultanahmet Meydanı', en: 'Sultanahmet Square' },
          location: { lat: 41.0058, lng: 28.9768 },
          instructions: { tr: 'Alman Çeşmesi önünde buluşuyoruz.', en: 'We meet in front of the German Fountain.' },
        };

    let createdTours = 0;
    for (const seed of SEED_ROUTES) {
      const route = routes.get(seed.slug);
      if (!route) continue;
      const schedule = SEED_SCHEDULE[seed.slug];
      if (!schedule) continue;
      const vehicle = vehicles.get(schedule.vehicleKey);
      if (!vehicle) continue;
      const guide = guides[schedule.guideIndex % guides.length];
      const core = {
        routeId: String(route._id),
        vehicleId: String(vehicle._id),
        guideId: String(guide._id),
        meetingPoint: schedule.meetAtFirstStop && seed.stops[0] ? meetingAtKaytan : meetingAtKaytan,
        languages: schedule.languages,
        pricing: {
          currency: 'EUR' as const,
          tiers: [
            { key: 'ADULT' as const, label: { tr: 'Yetişkin', en: 'Adult' }, amount: schedule.adult },
            { key: 'CHILD' as const, label: { tr: 'Çocuk (6-12)', en: 'Child (6-12)' }, amount: Math.round(schedule.adult * 0.55), minAge: 6, maxAge: 12 },
            { key: 'INFANT' as const, label: { tr: 'Bebek (0-5)', en: 'Infant (0-5)' }, amount: 0, maxAge: 5 },
            { key: 'STUDENT' as const, label: { tr: 'Öğrenci', en: 'Student' }, amount: Math.round(schedule.adult * 0.8) },
          ],
          premiumSeatSurcharge: 1500,
        },
        inclusions: {
          tr: ['Lisanslı rehber', 'Özel araç ve şoför', 'Kaytan Lounge\'da hoş geldin çayı', 'Su ve ıslak mendil', 'Müze giriş biletleri programda belirtildiği kadarıyla'],
          en: ['Licensed guide', 'Private vehicle and driver', 'Welcome tea at Kaytan Lounge', 'Water and refreshments', 'Museum entries where the programme says so'],
        },
        exclusions: {
          tr: ['Öğle yemeği (menü önerisi rehberden)', 'Kişisel harcamalar', 'Bahşiş'],
          en: ['Lunch (the guide suggests where)', 'Personal spending', 'Gratuities'],
        },
        contactPhone: '+90 532 000 00 00',
        whatsapp: '+90 532 000 00 00',
        cancellationPolicy: {
          tr: 'Kalkıştan 48 saat öncesine kadar ücretsiz iptal. Daha sonrası için bilet başka bir tarihe taşınabilir.',
          en: 'Free cancellation up to 48 hours before departure. After that the ticket can be moved to another date.',
        },
        blockedSeats: [],
        minPassengers: 2,
        internalNotes: undefined,
      };

      const templateName = `${seed.name.en} · ${schedule.startTime}`;
      let template = existingTemplates.find((t) => t.name === templateName);
      if (!template) {
        template = tours.templateToDto(await tours.createTemplate(SEED_ACTOR, { ...core, name: templateName, defaultStartTime: schedule.startTime }));
      }

      // Departures for the next six weeks on the route's weekdays; guides rotate.
      const dates: string[] = [];
      const today = new Date();
      for (let i = 1; i <= 42; i += 1) {
        const day = addDays(today, i);
        const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Istanbul', weekday: 'short' }).format(day);
        if (!schedule.weekdays.includes(weekday)) continue;
        dates.push(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(day));
      }
      const existing = await tours.list(undefined, { routeId: String(route._id), pageSize: 200 });
      const existingStarts = new Set(existing.items.map((t) => t.startsAt));
      let index = 0;
      for (const day of dates) {
        const startsAt = istanbulLocalToDate(day, schedule.startTime).toISOString();
        if (existingStarts.has(startsAt)) continue;
        const rotatingGuide = guides[(schedule.guideIndex + index) % guides.length];
        index += 1;
        try {
          await tours.create(SEED_ACTOR, { ...core, guideId: String(rotatingGuide._id), startsAt, templateId: template.id, status: 'PUBLISHED', force: false });
          createdTours += 1;
        } catch (error) {
          // Guide or vehicle already busy at that time: try the next guide once, then skip.
          const fallback = guides[(schedule.guideIndex + index + 1) % guides.length];
          try {
            await tours.create(SEED_ACTOR, { ...core, guideId: String(fallback._id), startsAt, templateId: template.id, status: 'PUBLISHED', force: false });
            createdTours += 1;
          } catch {
            this.logger.debug(`tour ${seed.slug} ${day}: skipped (${String(error)})`);
          }
        }
      }
    }
    this.logger.log(`tours: ${createdTours} departures created`);
  }

  // ------------------------------------------------------------- bookings

  private async demoBookings(ownerId: string) {
    const customers = this.get(CustomerService);
    const bookings = this.get(BookingService);
    const tours = this.get(TourService);
    const demo = await customers.ensureLocal({ kuwhoCustomerId: 'seed-demo-customer', displayName: 'Ayşe Demirci', phone: '+905320000099', email: 'ayse.demirci@example.com', locale: 'tr' });
    const existing = await bookings.listForCustomer(String(demo._id));
    if (existing.length) return;
    const upcoming = await tours.list(undefined, { status: 'PUBLISHED', from: new Date().toISOString(), pageSize: 12 });
    const actor: RequestActor = { id: String(demo._id), realm: 'CUSTOMER', sessionId: 'seed', permissions: [] };

    /**
     * Enough bookings that the dashboard and the approval queue are worth looking at
     * straight after a seed: one confirmed party of two, and two payments waiting on an
     * admin. Every provider runs in manual mode this phase, so a new booking always lands
     * in AWAITING_APPROVAL; PENDING_PAYMENT only appears once a gateway goes live.
     */
    const plan = [
      { party: [['Ayşe Demirci', 'ADULT'], ['Kerem Demirci', 'ADULT']] as const, provider: 'BANK_TRANSFER' as const, approve: true },
      { party: [['Ayşe Demirci', 'ADULT'], ['Lale Demirci', 'CHILD']] as const, provider: 'IYZICO' as const, approve: false },
      { party: [['Ayşe Demirci', 'ADULT']] as const, provider: 'AT_VENUE' as const, approve: false },
    ];

    let made = 0;
    for (const tour of upcoming.items) {
      if (made === plan.length) break;
      const step = plan[made];
      try {
        const detail = await tours.getDetail(tour.id);
        // Seat labels differ per vehicle, so they are read off the plan rather than assumed.
        const free = detail.vehicle.seatMap.cells
          .filter((c) => c.kind === 'SEAT' && c.label && !detail.unavailableSeats.includes(c.label))
          .map((c) => c.label!);
        if (free.length < step.party.length) continue;
        const created = await bookings.createForCustomer(actor, {
          tourId: tour.id,
          passengers: step.party.map(([fullName, tierKey], seat) => ({ seatLabel: free[seat], fullName, tierKey })),
          contact: { fullName: 'Ayşe Demirci', phone: '+905320000099', email: 'ayse.demirci@example.com' },
          paymentProvider: step.provider,
          locale: 'tr',
        });
        made += 1;
        // Stamped with the owner's real id: the approval records who confirmed it, and
        // `SEED_ACTOR.id` is the string "seed", which is not a usable ObjectId.
        if (step.approve) {
          await bookings.approvePayment({ ...SEED_ACTOR, id: ownerId }, created.id, { reference: 'SEED-TRF-0001', note: 'Seed: transfer received' });
        }
      } catch (error) {
        this.logger.warn(`demo booking skipped: ${String(error)}`);
      }
    }
    this.logger.log(`bookings: ${made} demo bookings for ${demo.displayName}`);
  }
}
