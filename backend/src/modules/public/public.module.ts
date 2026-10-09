import { Controller, Get, Injectable, Module, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Types } from 'mongoose';
import { Public } from '../../common/auth/auth.decorators';
import { EntityNotFoundException } from '../../common/exceptions/domain.exception';
import type {
  AttractionDto,
  BusinessDto,
  Money,
  PublicBootstrapDto,
  PublicPlaceDto,
  RouteCardDto,
  RouteDetailDto,
  TourDetailDto,
  TourSummaryDto,
} from '../../contract/api';
import { BookingsModule } from '../bookings/bookings.module';
import { PaymentsService } from '../bookings/payments.service';
import { CatalogModule } from '../catalog/catalog.module';
import { AttractionService } from '../catalog/services/attraction.service';
import { BusinessService } from '../catalog/services/business.service';
import { RouteService } from '../routes/route.service';
import { RoutesModule } from '../routes/routes.module';
import { SettingsModule, SettingsService } from '../settings/settings.module';
import { TourService } from '../tours/tour.service';
import { ToursModule } from '../tours/tours.module';

/**
 * "From X" on a route card means the cheapest adult fare across its upcoming departures.
 * Child and infant tiers are deliberately ignored: a free infant seat would otherwise
 * advertise the whole route at zero.
 */
function cheapestAdultFare(tours: TourSummaryDto[]): Money | undefined {
  const fares = tours
    .map((t) => ({ amount: t.pricing.tiers.find((tier) => tier.key === 'ADULT')?.amount, currency: t.pricing.currency }))
    .filter((f): f is Money => typeof f.amount === 'number' && f.amount > 0);
  return fares.sort((a, b) => a.amount - b.amount)[0];
}

/** Read-only composites shaped for the website: no auth, cached briefly, never leaks drafts. */
@Injectable()
export class PublicService {
  constructor(
    private readonly routes: RouteService,
    private readonly tours: TourService,
    private readonly attractions: AttractionService,
    private readonly businesses: BusinessService,
    private readonly settings: SettingsService,
    private readonly payments: PaymentsService,
  ) {}

  async bootstrap(): Promise<PublicBootstrapDto> {
    const [settings, sponsors, cards, highlights] = await Promise.all([
      this.settings.get(),
      this.businesses.sponsors(),
      this.routeCards(),
      this.attractions.listPublished(),
    ]);
    const pinned = settings.featuredRouteSlugs;
    const featured = pinned.length
      ? pinned.map((slug) => cards.find((c) => c.slug === slug)).filter((c): c is RouteCardDto => Boolean(c))
      : cards.slice(0, 4);
    return {
      settings,
      sponsors: sponsors.map((b) => this.businesses.toDto(b)),
      featuredRoutes: featured,
      paymentOptions: this.payments.options(settings),
      highlights: highlights.filter((a) => a.media.length).slice(0, 12).map((a) => this.attractions.toDto(a)),
    };
  }

  async routeCards(): Promise<RouteCardDto[]> {
    const routes = await this.routes.listPublished();
    const [places, tours] = await Promise.all([
      this.routes.resolvePlaces(routes),
      this.tours.upcomingByRoute(routes.map((r) => r._id)),
    ]);
    return routes.map((route) => {
      const upcoming = tours.get(String(route._id)) ?? [];
      return this.routes.toCard(route, places, {
        nextTourAt: upcoming[0]?.startsAt,
        upcomingTours: upcoming.length,
        priceFrom: cheapestAdultFare(upcoming),
      });
    });
  }

  async routeDetail(slug: string): Promise<RouteDetailDto> {
    const route = await this.routes.findBySlug(slug);
    if (!route || route.status !== 'PUBLISHED') throw new EntityNotFoundException('Route', slug);
    const [places, tours] = await Promise.all([this.routes.resolvePlaces([route]), this.tours.upcomingByRoute([route._id])]);
    const { nodes: _nodes, ...rest } = this.routes.toDto(route);
    return { ...rest, nodes: this.routes.resolveNodes(route, places), tours: tours.get(String(route._id)) ?? [] };
  }

  async place(slug: string): Promise<PublicPlaceDto> {
    const attraction = await this.attractions.findBySlug(slug);
    if (attraction && attraction.status === 'PUBLISHED') {
      return { kind: 'ATTRACTION', place: this.attractions.toDto(attraction), routes: await this.routesThrough(attraction._id) };
    }
    const business = await this.businesses.findBySlug(slug);
    if (business && business.status === 'PUBLISHED') {
      return { kind: 'BUSINESS', place: this.businesses.toDto(business), routes: await this.routesThrough(business._id) };
    }
    throw new EntityNotFoundException('Place', slug);
  }

  private async routesThrough(refId: Types.ObjectId): Promise<RouteCardDto[]> {
    const routes = await this.routes.findPublishedByPlace(refId);
    if (!routes.length) return [];
    const [places, tours] = await Promise.all([this.routes.resolvePlaces(routes), this.tours.upcomingByRoute(routes.map((r) => r._id))]);
    return routes.map((route) => {
      const upcoming = tours.get(String(route._id)) ?? [];
      return this.routes.toCard(route, places, {
        nextTourAt: upcoming[0]?.startsAt,
        upcomingTours: upcoming.length,
        priceFrom: cheapestAdultFare(upcoming),
      });
    });
  }

  async places(): Promise<{ attractions: AttractionDto[]; businesses: BusinessDto[] }> {
    const [attractions, businesses] = await Promise.all([this.attractions.listPublished(), this.businesses.listPublished()]);
    return { attractions: attractions.map((a) => this.attractions.toDto(a)), businesses: businesses.map((b) => this.businesses.toDto(b)) };
  }

  tour(id: string): Promise<TourDetailDto> {
    return this.tours.getDetail(id, { publicOnly: true });
  }
}

@ApiTags('public')
@Controller('public')
@Public()
class PublicController {
  constructor(private readonly service: PublicService) {}

  @Get('bootstrap')
  @ApiOperation({ summary: 'Settings, sponsors, featured routes and landing highlights in one call' })
  bootstrap() {
    return this.service.bootstrap();
  }

  @Get('routes')
  routes() {
    return this.service.routeCards();
  }

  @Get('routes/:slug')
  route(@Param('slug') slug: string) {
    return this.service.routeDetail(slug);
  }

  @Get('places')
  places() {
    return this.service.places();
  }

  @Get('places/:slug')
  place(@Param('slug') slug: string) {
    return this.service.place(slug);
  }

  @Get('tours/:id')
  tour(@Param('id') id: string) {
    return this.service.tour(id);
  }
}

@Module({
  imports: [RoutesModule, ToursModule, CatalogModule, SettingsModule, BookingsModule],
  controllers: [PublicController],
  providers: [PublicService],
  exports: [PublicService],
})
export class PublicModule {}
