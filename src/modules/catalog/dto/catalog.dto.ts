import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
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
import {
  GeoPointDto,
  LocalizedListDto,
  LocalizedTextDto,
  MediaItemDto,
  PaginationQueryDto,
} from '../../../common/dto/common.dto';
import {
  ATTRACTION_TYPES,
  BUSINESS_CATEGORIES,
  SPONSOR_TIERS,
  type AttractionType,
  type BusinessCategory,
  type PublishStatus,
  type SponsorTier,
} from '../../../contract/api';

export class AttractionQueryDto extends PaginationQueryDto {
  @IsOptional() @IsIn(ATTRACTION_TYPES) type?: AttractionType;
  @IsOptional() @IsIn(['DRAFT', 'PUBLISHED', 'ARCHIVED']) status?: PublishStatus;
  @IsOptional() @IsString() district?: string;
  @IsOptional() @Type(() => Boolean) @IsBoolean() featured?: boolean;
}

export class CreateAttractionDto {
  @IsOptional() @IsString() @MaxLength(80) slug?: string;
  @IsIn(ATTRACTION_TYPES) type!: AttractionType;
  @ValidateNested() @Type(() => LocalizedTextDto) name!: LocalizedTextDto;
  @IsOptional() @ValidateNested() @Type(() => LocalizedTextDto) summary?: LocalizedTextDto;
  @IsOptional() @ValidateNested() @Type(() => LocalizedTextDto) description?: LocalizedTextDto;
  @IsOptional() @ValidateNested() @Type(() => LocalizedTextDto) tips?: LocalizedTextDto;
  @IsString() @IsNotEmpty() @MaxLength(80) district!: string;
  @IsOptional() @IsString() @MaxLength(300) address?: string;
  @ValidateNested() @Type(() => GeoPointDto) location!: GeoPointDto;
  @IsOptional() @IsString() @MaxLength(200) openingHours?: string;
  @IsOptional() @ValidateNested() @Type(() => LocalizedTextDto) ticket?: LocalizedTextDto;
  @IsOptional() @IsInt() @Min(5) @Max(600) visitMinutes?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => MediaItemDto) media?: MediaItemDto[];
  @IsOptional() @IsBoolean() featured?: boolean;
  @IsOptional() @IsIn(['DRAFT', 'PUBLISHED', 'ARCHIVED']) status?: PublishStatus;
}

export class UpdateAttractionDto {
  @IsOptional() @IsString() @MaxLength(80) slug?: string;
  @IsOptional() @IsIn(ATTRACTION_TYPES) type?: AttractionType;
  @IsOptional() @ValidateNested() @Type(() => LocalizedTextDto) name?: LocalizedTextDto;
  @IsOptional() @ValidateNested() @Type(() => LocalizedTextDto) summary?: LocalizedTextDto;
  @IsOptional() @ValidateNested() @Type(() => LocalizedTextDto) description?: LocalizedTextDto;
  @IsOptional() @ValidateNested() @Type(() => LocalizedTextDto) tips?: LocalizedTextDto;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(80) district?: string;
  @IsOptional() @IsString() @MaxLength(300) address?: string;
  @IsOptional() @ValidateNested() @Type(() => GeoPointDto) location?: GeoPointDto;
  @IsOptional() @IsString() @MaxLength(200) openingHours?: string;
  @IsOptional() @ValidateNested() @Type(() => LocalizedTextDto) ticket?: LocalizedTextDto;
  @IsOptional() @IsInt() @Min(5) @Max(600) visitMinutes?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => MediaItemDto) media?: MediaItemDto[];
  @IsOptional() @IsBoolean() featured?: boolean;
  @IsOptional() @IsIn(['DRAFT', 'PUBLISHED', 'ARCHIVED']) status?: PublishStatus;
}

export class BusinessContactDto {
  @IsOptional() @IsString() @MaxLength(32) phone?: string;
  @IsOptional() @IsString() @MaxLength(32) whatsapp?: string;
  @IsOptional() @IsString() @MaxLength(80) instagram?: string;
  @IsOptional() @IsString() @MaxLength(200) website?: string;
  @IsOptional() @IsEmail() email?: string;
}

export class BusinessQueryDto extends PaginationQueryDto {
  @IsOptional() @IsIn(BUSINESS_CATEGORIES) category?: BusinessCategory;
  @IsOptional() @IsIn(SPONSOR_TIERS) sponsorTier?: SponsorTier;
  @IsOptional() @IsIn(['DRAFT', 'PUBLISHED', 'ARCHIVED']) status?: PublishStatus;
}

export class CreateBusinessDto {
  @IsOptional() @IsString() @MaxLength(80) slug?: string;
  @IsIn(BUSINESS_CATEGORIES) category!: BusinessCategory;
  @IsOptional() @IsIn(SPONSOR_TIERS) sponsorTier?: SponsorTier;
  @ValidateNested() @Type(() => LocalizedTextDto) name!: LocalizedTextDto;
  @IsOptional() @ValidateNested() @Type(() => LocalizedTextDto) summary?: LocalizedTextDto;
  @IsOptional() @ValidateNested() @Type(() => LocalizedTextDto) description?: LocalizedTextDto;
  @IsString() @IsNotEmpty() @MaxLength(80) district!: string;
  @IsOptional() @IsString() @MaxLength(300) address?: string;
  @ValidateNested() @Type(() => GeoPointDto) location!: GeoPointDto;
  @IsOptional() @ValidateNested() @Type(() => BusinessContactDto) contact?: BusinessContactDto;
  @IsOptional() @IsString() @MaxLength(200) openingHours?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) cuisine?: string[];
  @IsOptional() @ValidateNested() @Type(() => LocalizedListDto) features?: LocalizedListDto;
  @IsOptional() @ValidateNested() @Type(() => LocalizedTextDto) offer?: LocalizedTextDto;
  @IsOptional() @IsInt() @Min(5) @Max(600) visitMinutes?: number;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => MediaItemDto) media?: MediaItemDto[];
  @IsOptional() @ValidateNested() @Type(() => MediaItemDto) logo?: MediaItemDto | null;
  @IsOptional() @IsBoolean() featured?: boolean;
  @IsOptional() @IsIn(['DRAFT', 'PUBLISHED', 'ARCHIVED']) status?: PublishStatus;
}

export class UpdateBusinessDto {
  @IsOptional() @IsString() @MaxLength(80) slug?: string;
  @IsOptional() @IsIn(BUSINESS_CATEGORIES) category?: BusinessCategory;
  @IsOptional() @IsIn(SPONSOR_TIERS) sponsorTier?: SponsorTier;
  @IsOptional() @ValidateNested() @Type(() => LocalizedTextDto) name?: LocalizedTextDto;
  @IsOptional() @ValidateNested() @Type(() => LocalizedTextDto) summary?: LocalizedTextDto;
  @IsOptional() @ValidateNested() @Type(() => LocalizedTextDto) description?: LocalizedTextDto;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(80) district?: string;
  @IsOptional() @IsString() @MaxLength(300) address?: string;
  @IsOptional() @ValidateNested() @Type(() => GeoPointDto) location?: GeoPointDto;
  @IsOptional() @ValidateNested() @Type(() => BusinessContactDto) contact?: BusinessContactDto;
  @IsOptional() @IsString() @MaxLength(200) openingHours?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) cuisine?: string[];
  @IsOptional() @ValidateNested() @Type(() => LocalizedListDto) features?: LocalizedListDto;
  @IsOptional() @ValidateNested() @Type(() => LocalizedTextDto) offer?: LocalizedTextDto;
  @IsOptional() @IsInt() @Min(5) @Max(600) visitMinutes?: number;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => MediaItemDto) media?: MediaItemDto[];
  @IsOptional() @ValidateNested() @Type(() => MediaItemDto) logo?: MediaItemDto | null;
  @IsOptional() @IsBoolean() featured?: boolean;
  @IsOptional() @IsIn(['DRAFT', 'PUBLISHED', 'ARCHIVED']) status?: PublishStatus;
}
