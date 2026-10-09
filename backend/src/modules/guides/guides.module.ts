import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Injectable,
  Module,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { InjectModel, MongooseModule, Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { QueryFilter, HydratedDocument, Model, Types } from 'mongoose';
import { CurrentActor, Realms, RequirePermissions, type RequestActor } from '../../common/auth/auth.decorators';
import { LocalizedTextDto, MediaItemDto, PaginationQueryDto } from '../../common/dto/common.dto';
import { EntityNotFoundException } from '../../common/exceptions/domain.exception';
import { LocalizedTextDocument, LocalizedTextSchema, MediaItemDocument, MediaItemSchema } from '../../common/schema/shared.schema';
import { containsRegex, toObjectId } from '../../common/utils/mongo';
import type { GuideDto, Paginated } from '../../contract/api';
import { AuditModule } from '../audit/audit.module';
import { AuditService } from '../audit/audit.service';
import { mediaToDocument, mediaToDto } from '../catalog/services/media-mapper';
import { IamModule } from '../iam/iam.module';
import { AdminService } from '../iam/services/admin.service';
import { ADMIN_PASSWORD_MAX_LENGTH, ADMIN_PASSWORD_MIN_LENGTH } from '../iam/password.policy';

// -------------------------------------------------------------------------------- Schema

@Schema({ collection: 'guides', timestamps: true })
export class Guide {
  @Prop({ type: String, required: true, trim: true }) firstName!: string;
  @Prop({ type: String, required: true, trim: true }) lastName!: string;
  @Prop({ type: MediaItemSchema }) photo?: MediaItemDocument;
  @Prop({ type: LocalizedTextSchema, default: {} }) bio!: LocalizedTextDocument;
  @Prop({ type: Number }) birthYear?: number;
  @Prop({ type: [String], default: ['en'] }) languages!: string[];
  @Prop({ type: String, trim: true }) phone?: string;
  @Prop({ type: String, trim: true, lowercase: true }) email?: string;
  @Prop({ type: Number }) yearsExperience?: number;
  @Prop({ type: [String], default: [] }) specialties!: string[];
  @Prop({ type: String, trim: true }) licenseNo?: string;
  @Prop({ type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', index: true }) status!: 'ACTIVE' | 'INACTIVE';
  @Prop({ type: Types.ObjectId }) adminId?: Types.ObjectId;
  createdAt!: Date;
  updatedAt!: Date;
}
export type GuideDocument = HydratedDocument<Guide>;
export const GuideSchema = SchemaFactory.createForClass(Guide);

// ---------------------------------------------------------------------------------- DTOs

export class GuideQueryDto extends PaginationQueryDto {
  @IsOptional() @IsIn(['ACTIVE', 'INACTIVE']) status?: 'ACTIVE' | 'INACTIVE';
}

class GuideAdminAccountDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(ADMIN_PASSWORD_MIN_LENGTH) @MaxLength(ADMIN_PASSWORD_MAX_LENGTH) password!: string;
}

export class CreateGuideDto {
  @IsString() @IsNotEmpty() @MaxLength(60) firstName!: string;
  @IsString() @IsNotEmpty() @MaxLength(60) lastName!: string;
  @IsOptional() @ValidateNested() @Type(() => MediaItemDto) photo?: MediaItemDto | null;
  @IsOptional() @ValidateNested() @Type(() => LocalizedTextDto) bio?: LocalizedTextDto;
  @IsOptional() @IsInt() @Min(1930) @Max(2015) birthYear?: number;
  @IsArray() @IsString({ each: true }) languages!: string[];
  @IsOptional() @IsString() @MaxLength(32) phone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsInt() @Min(0) @Max(70) yearsExperience?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) specialties?: string[];
  @IsOptional() @IsString() @MaxLength(40) licenseNo?: string;
  @IsOptional() @IsIn(['ACTIVE', 'INACTIVE']) status?: 'ACTIVE' | 'INACTIVE';
  /** Optionally open a Tour Guide admin login for this person in the same call. */
  @IsOptional() @ValidateNested() @Type(() => GuideAdminAccountDto) adminAccount?: GuideAdminAccountDto;
}

export class UpdateGuideDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(60) firstName?: string;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(60) lastName?: string;
  @IsOptional() @ValidateNested() @Type(() => MediaItemDto) photo?: MediaItemDto | null;
  @IsOptional() @ValidateNested() @Type(() => LocalizedTextDto) bio?: LocalizedTextDto;
  @IsOptional() @IsInt() @Min(1930) @Max(2015) birthYear?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) languages?: string[];
  @IsOptional() @IsString() @MaxLength(32) phone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsInt() @Min(0) @Max(70) yearsExperience?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) specialties?: string[];
  @IsOptional() @IsString() @MaxLength(40) licenseNo?: string;
  @IsOptional() @IsIn(['ACTIVE', 'INACTIVE']) status?: 'ACTIVE' | 'INACTIVE';
  @IsOptional() @ValidateNested() @Type(() => GuideAdminAccountDto) adminAccount?: GuideAdminAccountDto;
}

// ------------------------------------------------------------------------------- Service

@Injectable()
export class GuideService {
  constructor(
    @InjectModel(Guide.name) private readonly guides: Model<Guide>,
    private readonly admins: AdminService,
    private readonly audit: AuditService,
  ) {}

  async list(query: GuideQueryDto): Promise<Paginated<GuideDto>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const filter: QueryFilter<Guide> = {};
    if (query.status) filter.status = query.status;
    if (query.q) {
      const rx = containsRegex(query.q);
      filter.$or = [{ firstName: rx }, { lastName: rx }, { email: rx }, { phone: rx }];
    }
    const [items, total] = await Promise.all([
      this.guides.find(filter).sort({ status: 1, firstName: 1 }).skip((page - 1) * pageSize).limit(pageSize),
      this.guides.countDocuments(filter),
    ]);
    return { items: items.map((g) => this.toDto(g)), total, page, pageSize };
  }

  async getById(id: string): Promise<GuideDocument> {
    const doc = await this.guides.findById(toObjectId(id, 'guideId'));
    if (!doc) throw new EntityNotFoundException('Guide', id);
    return doc;
  }

  async findByIds(ids: (string | Types.ObjectId)[]): Promise<Map<string, GuideDocument>> {
    if (!ids.length) return new Map();
    const docs = await this.guides.find({ _id: { $in: ids.map((i) => new Types.ObjectId(String(i))) } });
    return new Map(docs.map((d) => [String(d._id), d]));
  }

  async create(actor: RequestActor | undefined, dto: CreateGuideDto): Promise<GuideDocument> {
    const { adminAccount, photo, ...rest } = dto;
    const doc = await this.guides.create({ ...rest, photo: photo ? mediaToDocument([photo])[0] : undefined });
    if (adminAccount) await this.attachAdminAccount(doc, adminAccount);
    await this.audit.record(actor, 'guide.create', 'guide', String(doc._id), `${doc.firstName} ${doc.lastName}`);
    return doc;
  }

  async update(actor: RequestActor, id: string, dto: UpdateGuideDto): Promise<GuideDocument> {
    const doc = await this.getById(id);
    const { adminAccount, photo, ...rest } = dto;
    Object.assign(doc, rest);
    if (photo !== undefined) doc.photo = photo ? mediaToDocument([photo])[0] : undefined;
    await doc.save();
    if (adminAccount) await this.attachAdminAccount(doc, adminAccount);
    await this.audit.record(actor, 'guide.update', 'guide', String(doc._id), `${doc.firstName} ${doc.lastName}`, {
      fields: Object.keys(dto),
    });
    return doc;
  }

  async remove(actor: RequestActor, id: string): Promise<void> {
    const doc = await this.getById(id);
    await doc.deleteOne();
    await this.audit.record(actor, 'guide.delete', 'guide', id, `${doc.firstName} ${doc.lastName}`);
  }

  async upsertByEmail(input: CreateGuideDto & { email: string }): Promise<GuideDocument> {
    const existing = await this.guides.findOne({ email: input.email.toLowerCase() });
    if (existing) {
      const { adminAccount, photo, ...rest } = input;
      Object.assign(existing, rest, { photo: photo ? mediaToDocument([photo])[0] : existing.photo });
      await existing.save();
      if (adminAccount) await this.attachAdminAccount(existing, adminAccount);
      return existing;
    }
    return this.create(undefined, input);
  }

  private async attachAdminAccount(guide: GuideDocument, account: { email: string; password: string }) {
    const admin = await this.admins.upsertByEmail({
      email: account.email,
      password: account.password,
      name: `${guide.firstName} ${guide.lastName}`,
      phone: guide.phone,
      roleKey: 'tour_guide',
      guideId: guide._id,
    });
    if (!admin.guideId || String(admin.guideId) !== String(guide._id)) {
      admin.guideId = guide._id;
      await admin.save();
    }
    guide.adminId = admin._id;
    await guide.save();
  }

  toDto(doc: GuideDocument): GuideDto {
    return {
      id: String(doc._id),
      firstName: doc.firstName,
      lastName: doc.lastName,
      displayName: `${doc.firstName} ${doc.lastName}`,
      photo: mediaToDto(doc.photo),
      bio: doc.bio ?? {},
      birthYear: doc.birthYear,
      languages: doc.languages,
      phone: doc.phone,
      email: doc.email,
      yearsExperience: doc.yearsExperience,
      specialties: doc.specialties,
      licenseNo: doc.licenseNo,
      status: doc.status,
      adminId: doc.adminId ? String(doc.adminId) : undefined,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    };
  }
}

// ---------------------------------------------------------------------------- Controller

@ApiTags('admin/guides')
@Controller('admin/guides')
@Realms('ADMIN')
class AdminGuidesController {
  constructor(private readonly guides: GuideService) {}

  @Get()
  @RequirePermissions('GUIDES_READ')
  list(@Query() query: GuideQueryDto) {
    return this.guides.list(query);
  }

  @Get(':id')
  @RequirePermissions('GUIDES_READ')
  async get(@Param('id') id: string) {
    return this.guides.toDto(await this.guides.getById(id));
  }

  @Post()
  @RequirePermissions('GUIDES_WRITE')
  async create(@CurrentActor() actor: RequestActor, @Body() dto: CreateGuideDto) {
    return this.guides.toDto(await this.guides.create(actor, dto));
  }

  @Patch(':id')
  @RequirePermissions('GUIDES_WRITE')
  async update(@CurrentActor() actor: RequestActor, @Param('id') id: string, @Body() dto: UpdateGuideDto) {
    return this.guides.toDto(await this.guides.update(actor, id, dto));
  }

  @Delete(':id')
  @RequirePermissions('GUIDES_WRITE')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentActor() actor: RequestActor, @Param('id') id: string) {
    return this.guides.remove(actor, id);
  }
}

@Module({
  imports: [MongooseModule.forFeature([{ name: Guide.name, schema: GuideSchema }]), IamModule, AuditModule],
  controllers: [AdminGuidesController],
  providers: [GuideService],
  exports: [GuideService],
})
export class GuidesModule {}
