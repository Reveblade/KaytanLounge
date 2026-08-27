import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { QueryFilter, Model, Types } from 'mongoose';
import type { RequestActor } from '../../../common/auth/auth.decorators';
import { ConflictActionException, EntityNotFoundException } from '../../../common/exceptions/domain.exception';
import { containsRegex, toObjectId } from '../../../common/utils/mongo';
import { slugify } from '../../../common/utils/text';
import type { AttractionDto, Paginated } from '../../../contract/api';
import { AuditService } from '../../audit/audit.service';
import { AttractionQueryDto, CreateAttractionDto, UpdateAttractionDto } from '../dto/catalog.dto';
import { Attraction, AttractionDocument } from '../schemas/attraction.schema';
import { mediaListToDto, mediaToDocument } from './media-mapper';

@Injectable()
export class AttractionService {
  constructor(
    @InjectModel(Attraction.name) private readonly attractions: Model<Attraction>,
    private readonly audit: AuditService,
  ) {}

  async list(query: AttractionQueryDto): Promise<Paginated<AttractionDto>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const filter: QueryFilter<Attraction> = {};
    if (query.type) filter.type = query.type;
    if (query.status) filter.status = query.status;
    if (query.district) filter.district = query.district;
    if (query.featured !== undefined) filter.featured = query.featured;
    if (query.q) {
      const rx = containsRegex(query.q);
      filter.$or = [{ 'name.tr': rx }, { 'name.en': rx }, { slug: rx }, { district: rx }, { tags: rx }];
    }
    const [items, total] = await Promise.all([
      this.attractions.find(filter).sort({ featured: -1, 'name.en': 1 }).skip((page - 1) * pageSize).limit(pageSize),
      this.attractions.countDocuments(filter),
    ]);
    return { items: items.map((a) => this.toDto(a)), total, page, pageSize };
  }

  async listPublished(): Promise<AttractionDocument[]> {
    return this.attractions.find({ status: 'PUBLISHED' }).sort({ featured: -1, 'name.en': 1 });
  }

  async getById(id: string): Promise<AttractionDocument> {
    const doc = await this.attractions.findById(toObjectId(id, 'attractionId'));
    if (!doc) throw new EntityNotFoundException('Attraction', id);
    return doc;
  }

  async findBySlug(slug: string): Promise<AttractionDocument | null> {
    return this.attractions.findOne({ slug });
  }

  async findByIds(ids: (string | Types.ObjectId)[]): Promise<Map<string, AttractionDocument>> {
    if (!ids.length) return new Map();
    const docs = await this.attractions.find({ _id: { $in: ids.map((i) => new Types.ObjectId(String(i))) } });
    return new Map(docs.map((d) => [String(d._id), d]));
  }

  async create(actor: RequestActor | undefined, dto: CreateAttractionDto): Promise<AttractionDocument> {
    const slug = await this.uniqueSlug(dto.slug ?? dto.name.en ?? dto.name.tr ?? 'place');
    const doc = await this.attractions.create({
      ...dto,
      slug,
      media: mediaToDocument(dto.media),
      status: dto.status ?? 'DRAFT',
      visitMinutes: dto.visitMinutes ?? 60,
    });
    await this.audit.record(actor, 'attraction.create', 'attraction', String(doc._id), doc.name.en ?? doc.slug);
    return doc;
  }

  async update(actor: RequestActor, id: string, dto: UpdateAttractionDto): Promise<AttractionDocument> {
    const doc = await this.getById(id);
    if (dto.slug && dto.slug !== doc.slug) doc.slug = await this.uniqueSlug(dto.slug, doc._id);
    const { slug: _slug, media, ...rest } = dto;
    Object.assign(doc, rest);
    if (media) doc.media = mediaToDocument(media);
    await doc.save();
    await this.audit.record(actor, 'attraction.update', 'attraction', String(doc._id), doc.name.en ?? doc.slug, {
      fields: Object.keys(dto),
    });
    return doc;
  }

  async remove(actor: RequestActor, id: string): Promise<void> {
    const doc = await this.getById(id);
    await doc.deleteOne();
    await this.audit.record(actor, 'attraction.delete', 'attraction', id, doc.name.en ?? doc.slug);
  }

  async upsertBySlug(input: CreateAttractionDto & { slug: string }): Promise<AttractionDocument> {
    const existing = await this.findBySlug(input.slug);
    if (existing) {
      Object.assign(existing, { ...input, media: mediaToDocument(input.media) });
      return existing.save();
    }
    return this.attractions.create({ ...input, media: mediaToDocument(input.media), status: input.status ?? 'PUBLISHED' });
  }

  private async uniqueSlug(base: string, excludeId?: Types.ObjectId): Promise<string> {
    const root = slugify(base) || 'place';
    let candidate = root;
    for (let i = 2; i < 50; i += 1) {
      const clash = await this.attractions.exists(excludeId ? { slug: candidate, _id: { $ne: excludeId } } : { slug: candidate });
      if (!clash) return candidate;
      candidate = `${root}-${i}`;
    }
    throw new ConflictActionException('SLUG_TAKEN', 'Could not find a free slug');
  }

  toDto(doc: AttractionDocument): AttractionDto {
    return {
      id: String(doc._id),
      slug: doc.slug,
      type: doc.type,
      name: doc.name,
      summary: doc.summary,
      description: doc.description,
      tips: doc.tips,
      district: doc.district,
      address: doc.address,
      location: { lat: doc.location.lat, lng: doc.location.lng },
      openingHours: doc.openingHours,
      ticket: doc.ticket,
      visitMinutes: doc.visitMinutes,
      tags: doc.tags,
      media: mediaListToDto(doc.media),
      featured: doc.featured,
      status: doc.status,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    };
  }
}
