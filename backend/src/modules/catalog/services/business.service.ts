import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { QueryFilter, Model, Types } from 'mongoose';
import type { RequestActor } from '../../../common/auth/auth.decorators';
import { ConflictActionException, EntityNotFoundException } from '../../../common/exceptions/domain.exception';
import { containsRegex, toObjectId } from '../../../common/utils/mongo';
import { slugify } from '../../../common/utils/text';
import type { BusinessDto, Paginated } from '../../../contract/api';
import { AuditService } from '../../audit/audit.service';
import { BusinessQueryDto, CreateBusinessDto, UpdateBusinessDto } from '../dto/catalog.dto';
import { Business, BusinessDocument } from '../schemas/business.schema';
import { mediaListToDto, mediaToDocument, mediaToDto } from './media-mapper';

@Injectable()
export class BusinessService {
  constructor(
    @InjectModel(Business.name) private readonly businesses: Model<Business>,
    private readonly audit: AuditService,
  ) {}

  async list(query: BusinessQueryDto): Promise<Paginated<BusinessDto>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const filter: QueryFilter<Business> = {};
    if (query.category) filter.category = query.category;
    if (query.sponsorTier) filter.sponsorTier = query.sponsorTier;
    if (query.status) filter.status = query.status;
    if (query.q) {
      const rx = containsRegex(query.q);
      filter.$or = [{ 'name.tr': rx }, { 'name.en': rx }, { slug: rx }, { district: rx }];
    }
    const [items, total] = await Promise.all([
      this.businesses.find(filter).sort({ sponsorTier: 1, 'name.en': 1 }).skip((page - 1) * pageSize).limit(pageSize),
      this.businesses.countDocuments(filter),
    ]);
    return { items: items.map((b) => this.toDto(b)), total, page, pageSize };
  }

  async listPublished(): Promise<BusinessDocument[]> {
    return this.businesses.find({ status: 'PUBLISHED' }).sort({ sponsorTier: 1, 'name.en': 1 });
  }

  async sponsors(): Promise<BusinessDocument[]> {
    const order = { TITLE: 0, PARTNER: 1, STANDARD: 2 } as const;
    const docs = await this.businesses.find({ status: 'PUBLISHED', sponsorTier: { $in: ['TITLE', 'PARTNER'] } });
    return docs.sort((a, b) => order[a.sponsorTier] - order[b.sponsorTier]);
  }

  async getById(id: string): Promise<BusinessDocument> {
    const doc = await this.businesses.findById(toObjectId(id, 'businessId'));
    if (!doc) throw new EntityNotFoundException('Business', id);
    return doc;
  }

  async findBySlug(slug: string): Promise<BusinessDocument | null> {
    return this.businesses.findOne({ slug });
  }

  async findByIds(ids: (string | Types.ObjectId)[]): Promise<Map<string, BusinessDocument>> {
    if (!ids.length) return new Map();
    const docs = await this.businesses.find({ _id: { $in: ids.map((i) => new Types.ObjectId(String(i))) } });
    return new Map(docs.map((d) => [String(d._id), d]));
  }

  async create(actor: RequestActor | undefined, dto: CreateBusinessDto): Promise<BusinessDocument> {
    const slug = await this.uniqueSlug(dto.slug ?? dto.name.en ?? dto.name.tr ?? 'venue');
    const { logo, media, ...rest } = dto;
    const doc = await this.businesses.create({
      ...rest,
      slug,
      media: mediaToDocument(media),
      logo: logo ? mediaToDocument([logo])[0] : undefined,
      status: dto.status ?? 'DRAFT',
      visitMinutes: dto.visitMinutes ?? 90,
    });
    await this.audit.record(actor, 'business.create', 'business', String(doc._id), doc.name.en ?? doc.slug);
    return doc;
  }

  async update(actor: RequestActor, id: string, dto: UpdateBusinessDto): Promise<BusinessDocument> {
    const doc = await this.getById(id);
    if (dto.slug && dto.slug !== doc.slug) doc.slug = await this.uniqueSlug(dto.slug, doc._id);
    const { slug: _slug, media, logo, ...rest } = dto;
    Object.assign(doc, rest);
    if (media) doc.media = mediaToDocument(media);
    if (logo !== undefined) doc.logo = logo ? mediaToDocument([logo])[0] : undefined;
    await doc.save();
    await this.audit.record(actor, 'business.update', 'business', String(doc._id), doc.name.en ?? doc.slug, {
      fields: Object.keys(dto),
    });
    return doc;
  }

  async remove(actor: RequestActor, id: string): Promise<void> {
    const doc = await this.getById(id);
    await doc.deleteOne();
    await this.audit.record(actor, 'business.delete', 'business', id, doc.name.en ?? doc.slug);
  }

  async upsertBySlug(input: CreateBusinessDto & { slug: string }): Promise<BusinessDocument> {
    const existing = await this.findBySlug(input.slug);
    const { logo, media, ...rest } = input;
    if (existing) {
      Object.assign(existing, rest, {
        media: mediaToDocument(media),
        logo: logo ? mediaToDocument([logo])[0] : existing.logo,
      });
      return existing.save();
    }
    return this.businesses.create({
      ...rest,
      media: mediaToDocument(media),
      logo: logo ? mediaToDocument([logo])[0] : undefined,
      status: input.status ?? 'PUBLISHED',
    });
  }

  private async uniqueSlug(base: string, excludeId?: Types.ObjectId): Promise<string> {
    const root = slugify(base) || 'venue';
    let candidate = root;
    for (let i = 2; i < 50; i += 1) {
      const clash = await this.businesses.exists(excludeId ? { slug: candidate, _id: { $ne: excludeId } } : { slug: candidate });
      if (!clash) return candidate;
      candidate = `${root}-${i}`;
    }
    throw new ConflictActionException('SLUG_TAKEN', 'Could not find a free slug');
  }

  toDto(doc: BusinessDocument): BusinessDto {
    return {
      id: String(doc._id),
      slug: doc.slug,
      category: doc.category,
      sponsorTier: doc.sponsorTier,
      name: doc.name,
      summary: doc.summary,
      description: doc.description,
      district: doc.district,
      address: doc.address,
      location: { lat: doc.location.lat, lng: doc.location.lng },
      contact: {
        phone: doc.contact?.phone,
        whatsapp: doc.contact?.whatsapp,
        instagram: doc.contact?.instagram,
        website: doc.contact?.website,
        email: doc.contact?.email,
      },
      openingHours: doc.openingHours,
      cuisine: doc.cuisine,
      features: doc.features ?? {},
      offer: doc.offer,
      visitMinutes: doc.visitMinutes,
      media: mediaListToDto(doc.media),
      logo: mediaToDto(doc.logo),
      featured: doc.featured,
      status: doc.status,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    };
  }
}
