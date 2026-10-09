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
import { InjectModel, MongooseModule } from '@nestjs/mongoose';
import { ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { QueryFilter, Model, Types } from 'mongoose';
import { CurrentActor, Realms, RequirePermissions, type RequestActor } from '../../common/auth/auth.decorators';
import { LocalizedTextDto, MediaItemDto, PaginationQueryDto } from '../../common/dto/common.dto';
import { EntityNotFoundException } from '../../common/exceptions/domain.exception';
import { containsRegex, toObjectId } from '../../common/utils/mongo';
import type { Paginated, SeatCellKind, SeatMap, VehicleDto, VehicleStatus, VehicleType } from '../../contract/api';
import { AuditModule } from '../audit/audit.module';
import { AuditService } from '../audit/audit.service';
import { mediaListToDto, mediaToDocument } from '../catalog/services/media-mapper';
import { generateSeatMap, seatLabels, validateSeatMap } from './seat-map';
import { SeatMapDocument, Vehicle, VehicleDocument, VehicleSchema } from './vehicle.schema';

// ---------------------------------------------------------------------------------- DTOs

class SeatCellDto {
  @IsInt() @Min(0) row!: number;
  @IsInt() @Min(0) col!: number;
  @IsIn(['SEAT', 'DRIVER', 'GUIDE', 'AISLE', 'EMPTY', 'DOOR', 'TABLE']) kind!: SeatCellKind;
  @IsOptional() @IsString() @MaxLength(6) label?: string;
  @IsOptional() @IsBoolean() premium?: boolean;
}

class SeatMapDto {
  @IsInt() @Min(1) @Max(40) rows!: number;
  @IsInt() @Min(1) @Max(12) cols!: number;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => SeatCellDto) cells!: SeatCellDto[];
}

export class VehicleQueryDto extends PaginationQueryDto {
  @IsOptional() @IsIn(['ACTIVE', 'MAINTENANCE', 'RETIRED']) status?: VehicleStatus;
}

export class CreateVehicleDto {
  @IsString() @IsNotEmpty() @MaxLength(80) name!: string;
  @IsIn(['MINIBUS', 'BUS', 'VAN', 'BOAT', 'YACHT', 'CAR']) type!: VehicleType;
  @IsOptional() @IsString() @MaxLength(60) make?: string;
  @IsOptional() @IsString() @MaxLength(60) model?: string;
  @IsOptional() @IsInt() @Min(1980) @Max(2100) year?: number;
  @IsOptional() @IsString() @MaxLength(20) plate?: string;
  @ValidateNested() @Type(() => SeatMapDto) seatMap!: SeatMapDto;
  @IsOptional() @IsArray() @IsString({ each: true }) amenities?: string[];
  @IsOptional() @ValidateNested() @Type(() => LocalizedTextDto) description?: LocalizedTextDto;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => MediaItemDto) media?: MediaItemDto[];
  @IsOptional() @IsIn(['ACTIVE', 'MAINTENANCE', 'RETIRED']) status?: VehicleStatus;
}

export class UpdateVehicleDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(80) name?: string;
  @IsOptional() @IsIn(['MINIBUS', 'BUS', 'VAN', 'BOAT', 'YACHT', 'CAR']) type?: VehicleType;
  @IsOptional() @IsString() @MaxLength(60) make?: string;
  @IsOptional() @IsString() @MaxLength(60) model?: string;
  @IsOptional() @IsInt() @Min(1980) @Max(2100) year?: number;
  @IsOptional() @IsString() @MaxLength(20) plate?: string;
  @IsOptional() @ValidateNested() @Type(() => SeatMapDto) seatMap?: SeatMapDto;
  @IsOptional() @IsArray() @IsString({ each: true }) amenities?: string[];
  @IsOptional() @ValidateNested() @Type(() => LocalizedTextDto) description?: LocalizedTextDto;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => MediaItemDto) media?: MediaItemDto[];
  @IsOptional() @IsIn(['ACTIVE', 'MAINTENANCE', 'RETIRED']) status?: VehicleStatus;
}

export class GenerateSeatMapDto {
  @IsInt() @Min(1) @Max(30) rows!: number;
  @IsInt() @Min(0) @Max(4) left!: number;
  @IsInt() @Min(0) @Max(4) right!: number;
  @IsOptional() @IsBoolean() fullBackRow?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(10) premiumRows?: number;
  @IsOptional() @IsBoolean() withDriverRow?: boolean;
}

// ------------------------------------------------------------------------------- Service

/**
 * Mongoose subdocuments do not spread into plain objects: `{ ...cell }` copies the
 * document internals, not the schema fields, and the seat plan reaches the client as
 * junk. Every field is therefore read explicitly.
 */
export function seatMapToDto(map: SeatMapDocument): SeatMap {
  return {
    rows: map.rows,
    cols: map.cols,
    cells: map.cells.map((cell) => ({
      row: cell.row,
      col: cell.col,
      kind: cell.kind,
      ...(cell.label ? { label: cell.label } : {}),
      ...(cell.premium ? { premium: true } : {}),
    })),
  };
}

@Injectable()
export class VehicleService {
  constructor(
    @InjectModel(Vehicle.name) private readonly vehicles: Model<Vehicle>,
    private readonly audit: AuditService,
  ) {}

  async list(query: VehicleQueryDto): Promise<Paginated<VehicleDto>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const filter: QueryFilter<Vehicle> = {};
    if (query.status) filter.status = query.status;
    if (query.q) {
      const rx = containsRegex(query.q);
      filter.$or = [{ name: rx }, { plate: rx }, { model: rx }, { make: rx }];
    }
    const [items, total] = await Promise.all([
      this.vehicles.find(filter).sort({ status: 1, name: 1 }).skip((page - 1) * pageSize).limit(pageSize),
      this.vehicles.countDocuments(filter),
    ]);
    return { items: items.map((v) => this.toDto(v)), total, page, pageSize };
  }

  async getById(id: string): Promise<VehicleDocument> {
    const doc = await this.vehicles.findById(toObjectId(id, 'vehicleId'));
    if (!doc) throw new EntityNotFoundException('Vehicle', id);
    return doc;
  }

  async findByIds(ids: (string | Types.ObjectId)[]): Promise<Map<string, VehicleDocument>> {
    if (!ids.length) return new Map();
    const docs = await this.vehicles.find({ _id: { $in: ids.map((i) => new Types.ObjectId(String(i))) } });
    return new Map(docs.map((d) => [String(d._id), d]));
  }

  async create(actor: RequestActor | undefined, dto: CreateVehicleDto): Promise<VehicleDocument> {
    validateSeatMap(dto.seatMap);
    const doc = await this.vehicles.create({
      ...dto,
      media: mediaToDocument(dto.media),
      seatCount: seatLabels(dto.seatMap).length,
      status: dto.status ?? 'ACTIVE',
    });
    await this.audit.record(actor, 'vehicle.create', 'vehicle', String(doc._id), doc.name);
    return doc;
  }

  async update(actor: RequestActor, id: string, dto: UpdateVehicleDto): Promise<VehicleDocument> {
    const doc = await this.getById(id);
    const { media, seatMap, ...rest } = dto;
    Object.assign(doc, rest);
    if (seatMap) {
      validateSeatMap(seatMap);
      doc.seatMap = seatMap;
      doc.seatCount = seatLabels(seatMap).length;
    }
    if (media) doc.media = mediaToDocument(media);
    await doc.save();
    await this.audit.record(actor, 'vehicle.update', 'vehicle', String(doc._id), doc.name, { fields: Object.keys(dto) });
    return doc;
  }

  async remove(actor: RequestActor, id: string): Promise<void> {
    const doc = await this.getById(id);
    await doc.deleteOne();
    await this.audit.record(actor, 'vehicle.delete', 'vehicle', id, doc.name);
  }

  async upsertByName(input: CreateVehicleDto): Promise<VehicleDocument> {
    const existing = await this.vehicles.findOne({ name: input.name });
    if (existing) {
      Object.assign(existing, input, { media: mediaToDocument(input.media), seatCount: seatLabels(input.seatMap).length });
      return existing.save();
    }
    return this.create(undefined, input);
  }

  toDto(doc: VehicleDocument): VehicleDto {
    return {
      id: String(doc._id),
      name: doc.name,
      type: doc.type,
      make: doc.make,
      // `model` collides with Mongoose's Document.model(), so the linter reads this as an
      // unbound method. The schema path wins at runtime — verified: the API serves the
      // string — and the type resolves to string too.
      // eslint-disable-next-line @typescript-eslint/unbound-method
      model: doc.model,
      year: doc.year,
      plate: doc.plate,
      seatMap: seatMapToDto(doc.seatMap),
      seatCount: doc.seatCount,
      amenities: doc.amenities,
      description: doc.description ?? {},
      media: mediaListToDto(doc.media),
      status: doc.status,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    };
  }
}

// ---------------------------------------------------------------------------- Controller

@ApiTags('admin/vehicles')
@Controller('admin/vehicles')
@Realms('ADMIN')
class AdminVehiclesController {
  constructor(private readonly vehicles: VehicleService) {}

  @Get()
  @RequirePermissions('FLEET_READ')
  list(@Query() query: VehicleQueryDto) {
    return this.vehicles.list(query);
  }

  @Get(':id')
  @RequirePermissions('FLEET_READ')
  async get(@Param('id') id: string) {
    return this.vehicles.toDto(await this.vehicles.getById(id));
  }

  @Post('seat-map/generate')
  @RequirePermissions('FLEET_READ')
  @HttpCode(HttpStatus.OK)
  generate(@Body() dto: GenerateSeatMapDto) {
    return generateSeatMap({
      rows: dto.rows,
      layout: [dto.left, dto.right],
      fullBackRow: dto.fullBackRow,
      premiumRows: dto.premiumRows,
      withDriverRow: dto.withDriverRow ?? true,
    });
  }

  @Post()
  @RequirePermissions('FLEET_WRITE')
  async create(@CurrentActor() actor: RequestActor, @Body() dto: CreateVehicleDto) {
    return this.vehicles.toDto(await this.vehicles.create(actor, dto));
  }

  @Patch(':id')
  @RequirePermissions('FLEET_WRITE')
  async update(@CurrentActor() actor: RequestActor, @Param('id') id: string, @Body() dto: UpdateVehicleDto) {
    return this.vehicles.toDto(await this.vehicles.update(actor, id, dto));
  }

  @Delete(':id')
  @RequirePermissions('FLEET_WRITE')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentActor() actor: RequestActor, @Param('id') id: string) {
    return this.vehicles.remove(actor, id);
  }
}

@Module({
  imports: [MongooseModule.forFeature([{ name: Vehicle.name, schema: VehicleSchema }]), AuditModule],
  controllers: [AdminVehiclesController],
  providers: [VehicleService],
  exports: [VehicleService],
})
export class FleetModule {}
