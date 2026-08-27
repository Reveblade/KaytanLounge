import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { LOCALES } from '../../contract/api';

export class LocalizedTextDto {
  @IsOptional() @IsString() @MaxLength(20000) tr?: string;
  @IsOptional() @IsString() @MaxLength(20000) en?: string;
  @IsOptional() @IsString() @MaxLength(20000) de?: string;
  @IsOptional() @IsString() @MaxLength(20000) ru?: string;
  @IsOptional() @IsString() @MaxLength(20000) ar?: string;
}

export class LocalizedListDto {
  @IsOptional() @IsArray() @IsString({ each: true }) tr?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) en?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) de?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) ru?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) ar?: string[];
}

export class GeoPointDto {
  @IsNumber() @Min(-90) @Max(90) lat!: number;
  @IsNumber() @Min(-180) @Max(180) lng!: number;
}

export class MediaItemDto {
  @IsOptional() @IsString() id?: string;
  @IsOptional() @IsIn(['IMAGE', 'VIDEO']) kind?: 'IMAGE' | 'VIDEO';
  @IsString() @IsUrl({ require_tld: false }) url!: string;
  @IsOptional() @IsString() thumbnailUrl?: string;
  @IsOptional() @IsIn(['EXTERNAL', 'CLOUDINARY', 'LOCAL']) provider?: 'EXTERNAL' | 'CLOUDINARY' | 'LOCAL';
  @IsOptional() @IsString() publicId?: string;
  @IsOptional() @IsInt() width?: number;
  @IsOptional() @IsInt() height?: number;
  @IsOptional() @ValidateNested() @Type(() => LocalizedTextDto) alt?: LocalizedTextDto;
  @IsOptional() @IsString() credit?: string;
  @IsOptional() @IsString() license?: string;
  @IsOptional() @IsString() sourceUrl?: string;
}

export class PaginationQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) pageSize?: number = 25;
  @IsOptional() @IsString() @MaxLength(120) q?: string;
}

export class LocaleQueryDto {
  @IsOptional() @IsEnum(LOCALES) locale?: (typeof LOCALES)[number];
}

export class StatusBodyDto {
  @IsIn(['DRAFT', 'PUBLISHED', 'ARCHIVED']) status!: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
}

export class FeaturedBodyDto {
  @IsBoolean() featured!: boolean;
}
