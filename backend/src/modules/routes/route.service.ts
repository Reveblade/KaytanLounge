import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { QueryFilter, Model, Types } from 'mongoose';
import type { RequestActor } from '../../common/auth/auth.decorators';
import { ConflictActionException, DomainException, EntityNotFoundException } from '../../common/exceptions/domain.exception';
import { containsRegex, toObjectId } from '../../common/utils/mongo';
import { slugify } from '../../common/utils/text';
import type { AttractionDto, BusinessDto, GeoPoint, Paginated, RouteCardDto, RouteDto, RouteNodeResolvedDto } from '../../contract/api';
import { AuditService } from '../audit/audit.service';
import { mediaToDocument, mediaToDto } from '../catalog/services/media-mapper';
import { AttractionService } from '../catalog/services/attraction.service';
import { BusinessService } from '../catalog/services/business.service';
import { CreateRouteDto, RouteNodeInputDto, RouteQueryDto, UpdateRouteDto } from './dto/route.dto';
import { RoutingService } from './routing.service';
import { Route, RouteDocument, RouteNodeDocument } from './schemas/route.schema';

export interface ResolvedPlaces {
  attractions: Map<string, AttractionDto>;
  businesses: Map<string, BusinessDto>;
}

@Injectable()
export class RouteService {
  constructor(
    @InjectModel(Route.name) private readonly routes: Model<Route>,
    private readonly attractions: AttractionService,
    private readonly businesses: BusinessService,
    private readonly routing: RoutingService,
    private readonly audit: AuditService,
  ) {}

  async list(query: RouteQueryDto): Promise<Paginated<RouteDto>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const filter: QueryFilter<Route> = {};
    if (query.status) filter.status = query.status;
    if (query.theme) filter.theme = query.theme;
    if (query.q) {
      const rx = containsRegex(query.q);
      filter.$or = [{ 'name.tr': rx }, { 'name.en': rx }, { slug: rx }];
    }
    const [items, total] = await Promise.all([
      this.routes.find(filter).sort({ featured: -1, createdAt: 1 }).skip((page - 1) * pageSize).limit(pageSize),
      this.routes.countDocuments(filter),
    ]);
    return { items: items.map((r) => this.toDto(r)), total, page, pageSize };
  }

  async listPublished(): Promise<RouteDocument[]> {
    return this.routes.find({ status: 'PUBLISHED' }).sort({ featured: -1, createdAt: 1 });
  }

  async getById(id: string): Promise<RouteDocument> {
    const doc = await this.routes.findById(toObjectId(id, 'routeId'));
    if (!doc) throw new EntityNotFoundException('Route', id);
    return doc;
  }

  async findByIds(ids: (string | Types.ObjectId)[]): Promise<Map<string, RouteDocument>> {
    if (!ids.length) return new Map();
    const docs = await this.routes.find({ _id: { $in: ids.map((i) => new Types.ObjectId(String(i))) } });
    return new Map(docs.map((d) => [String(d._id), d]));
  }

  async findBySlug(slug: string): Promise<RouteDocument | null> {
    return this.routes.findOne({ slug });
  }

  /** Published routes that stop at the given place. */
  async findPublishedByPlace(refId: string | Types.ObjectId): Promise<RouteDocument[]> {
    return this.routes.find({ status: 'PUBLISHED', 'nodes.refId': new Types.ObjectId(String(refId)) }).sort({ featured: -1, createdAt: 1 });
  }

  async create(actor: RequestActor | undefined, dto: CreateRouteDto): Promise<RouteDocument> {
    const slug = await this.uniqueSlug(dto.slug ?? dto.name.en ?? dto.name.tr ?? 'route');
    const computed = await this.buildNodes(dto.nodes);
    const { cover, nodes: _nodes, ...rest } = dto;
    const doc = await this.routes.create({
      ...rest,
      slug,
      ...computed,
      cover: cover ? mediaToDocument([cover])[0] : undefined,
      status: dto.status ?? 'DRAFT',
    });
    await this.audit.record(actor, 'route.create', 'route', String(doc._id), doc.name.en ?? doc.slug);
    return doc;
  }

  async update(actor: RequestActor, id: string, dto: UpdateRouteDto): Promise<RouteDocument> {
    const doc = await this.getById(id);
    if (dto.slug && dto.slug !== doc.slug) doc.slug = await this.uniqueSlug(dto.slug, doc._id);
    const { slug: _slug, cover, nodes, ...rest } = dto;
    Object.assign(doc, rest);
    if (cover !== undefined) doc.cover = cover ? mediaToDocument([cover])[0] : undefined;
    if (nodes) Object.assign(doc, await this.buildNodes(nodes));
    await doc.save();
    await this.audit.record(actor, 'route.update', 'route', String(doc._id), doc.name.en ?? doc.slug, {
      fields: Object.keys(dto),
    });
    return doc;
  }

  /** Re-runs the routing provider; useful after a place moved on the map. */
  async recompute(actor: RequestActor | undefined, id: string): Promise<RouteDocument> {
    const doc = await this.getById(id);
    Object.assign(
      doc,
      await this.buildNodes(
        doc.nodes.map((n) => ({ kind: n.kind, refId: String(n.refId), stayMinutes: n.stayMinutes, note: n.note })),
      ),
    );
    await doc.save();
    await this.audit.record(actor, 'route.recompute', 'route', String(doc._id));
    return doc;
  }

  async remove(actor: RequestActor, id: string): Promise<void> {
    const doc = await this.getById(id);
    await doc.deleteOne();
    await this.audit.record(actor, 'route.delete', 'route', id, doc.name.en ?? doc.slug);
  }

  async upsertBySlug(input: CreateRouteDto & { slug: string }): Promise<RouteDocument> {
    const existing = await this.findBySlug(input.slug);
    const computed = await this.buildNodes(input.nodes);
    const { cover, nodes: _nodes, ...rest } = input;
    if (existing) {
      Object.assign(existing, rest, computed, { cover: cover ? mediaToDocument([cover])[0] : existing.cover });
      return existing.save();
    }
    return this.routes.create({
      ...rest,
      ...computed,
      cover: cover ? mediaToDocument([cover])[0] : undefined,
      status: input.status ?? 'PUBLISHED',
    });
  }

  /** Path + legs for the admin builder without saving anything. */
  async preview(nodes: RouteNodeInputDto[]) {
    const built = await this.buildNodes(nodes);
    return { nodes: built.nodes.map((n) => this.nodeToDto(n)), path: built.path, distanceKm: built.distanceKm, durationMinutes: built.durationMinutes };
  }

  /** Loads every place referenced by the given routes in two queries. */
  async resolvePlaces(routes: RouteDocument[]): Promise<ResolvedPlaces> {
    const attractionIds = new Set<string>();
    const businessIds = new Set<string>();
    for (const route of routes) {
      for (const node of route.nodes) {
        (node.kind === 'ATTRACTION' ? attractionIds : businessIds).add(String(node.refId));
      }
    }
    const [a, b] = await Promise.all([
      this.attractions.findByIds([...attractionIds]),
      this.businesses.findByIds([...businessIds]),
    ]);
    return {
      attractions: new Map([...a].map(([id, doc]) => [id, this.attractions.toDto(doc)])),
      businesses: new Map([...b].map(([id, doc]) => [id, this.businesses.toDto(doc)])),
    };
  }

  resolveNodes(route: RouteDocument, places: ResolvedPlaces): RouteNodeResolvedDto[] {
    let clock = 0;
    const out: RouteNodeResolvedDto[] = [];
    for (const node of [...route.nodes].sort((x, y) => x.order - y.order)) {
      const place =
        node.kind === 'ATTRACTION'
          ? places.attractions.get(String(node.refId))
          : places.businesses.get(String(node.refId));
      if (!place) continue;
      clock += node.travelMinutes;
      out.push({ ...this.nodeToDto(node), place, arrivalOffsetMinutes: clock });
      clock += node.stayMinutes;
    }
    return out;
  }

  toCard(route: RouteDocument, places: ResolvedPlaces, extra: Pick<RouteCardDto, 'nextTourAt' | 'upcomingTours' | 'priceFrom'>): RouteCardDto {
    const resolved = this.resolveNodes(route, places);
    return {
      id: String(route._id),
      slug: route.slug,
      name: route.name,
      tagline: route.tagline,
      theme: route.theme,
      pace: route.pace,
      cover: mediaToDto(route.cover) ?? resolved.find((n) => n.place.media.length)?.place.media[0],
      nodeCount: route.nodes.length,
      distanceKm: route.distanceKm,
      durationMinutes: route.durationMinutes,
      nodePreviews: resolved.slice(0, 6).map((n) => ({ name: n.place.name, media: n.place.media[0], kind: n.kind, slug: n.place.slug })),
      ...extra,
    };
  }

  toDto(doc: RouteDocument): RouteDto {
    return {
      id: String(doc._id),
      slug: doc.slug,
      name: doc.name,
      tagline: doc.tagline,
      description: doc.description,
      highlights: doc.highlights ?? {},
      theme: doc.theme,
      pace: doc.pace,
      nodes: [...doc.nodes].sort((a, b) => a.order - b.order).map((n) => this.nodeToDto(n)),
      path: doc.path ? { type: 'LineString', coordinates: doc.path.coordinates } : undefined,
      distanceKm: doc.distanceKm,
      durationMinutes: doc.durationMinutes,
      cover: mediaToDto(doc.cover),
      featured: doc.featured,
      status: doc.status,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    };
  }

  private nodeToDto(n: RouteNodeDocument) {
    return {
      kind: n.kind,
      refId: String(n.refId),
      order: n.order,
      stayMinutes: n.stayMinutes,
      travelMinutes: n.travelMinutes,
      travelKm: n.travelKm,
      note: n.note,
    };
  }

  private async buildNodes(inputs: RouteNodeInputDto[]) {
    const attractionIds = inputs.filter((n) => n.kind === 'ATTRACTION').map((n) => n.refId);
    const businessIds = inputs.filter((n) => n.kind === 'BUSINESS').map((n) => n.refId);
    const [attractions, businesses] = await Promise.all([
      this.attractions.findByIds(attractionIds),
      this.businesses.findByIds(businessIds),
    ]);
    const points: GeoPoint[] = [];
    for (const input of inputs) {
      const place = input.kind === 'ATTRACTION' ? attractions.get(input.refId) : businesses.get(input.refId);
      if (!place) {
        throw new DomainException('NODE_NOT_FOUND', `Route node ${input.kind} ${input.refId} does not exist`, 400);
      }
      points.push({ lat: place.location.lat, lng: place.location.lng });
    }
    const computed = await this.routing.compute(points);
    const nodes: RouteNodeDocument[] = inputs.map((input, index) => ({
      kind: input.kind,
      refId: new Types.ObjectId(input.refId),
      order: index,
      stayMinutes: input.stayMinutes,
      travelMinutes: index === 0 ? 0 : (computed.legs[index - 1]?.durationMinutes ?? 0),
      travelKm: index === 0 ? 0 : (computed.legs[index - 1]?.distanceKm ?? 0),
      note: input.note,
    }));
    const distanceKm = Math.round(nodes.reduce((s, n) => s + n.travelKm, 0) * 10) / 10;
    const durationMinutes = nodes.reduce((s, n) => s + n.travelMinutes + n.stayMinutes, 0);
    return {
      nodes,
      path: { type: 'LineString' as const, coordinates: computed.coordinates },
      distanceKm,
      durationMinutes,
    };
  }

  private async uniqueSlug(base: string, excludeId?: Types.ObjectId): Promise<string> {
    const root = slugify(base) || 'route';
    let candidate = root;
    for (let i = 2; i < 50; i += 1) {
      const clash = await this.routes.exists(excludeId ? { slug: candidate, _id: { $ne: excludeId } } : { slug: candidate });
      if (!clash) return candidate;
      candidate = `${root}-${i}`;
    }
    throw new ConflictActionException('SLUG_TAKEN', 'Could not find a free slug');
  }
}
