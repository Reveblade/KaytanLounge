import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { GeoPointDto, LocalizedListDto, LocalizedTextDto, PaginationQueryDto } from '../../../common/dto/common.dto';
import { PRICE_TIER_KEYS, type CurrencyCode, type PriceTierKey, type TourStatus } from '../../../contract/api';

export class PriceTierDto {
  @IsIn(PRICE_TIER_KEYS) key!: PriceTierKey;
  @ValidateNested() @Type(() => LocalizedTextDto) label!: LocalizedTextDto;
  @IsInt() @Min(0) amount!: number;
  @IsOptional() @IsInt() @Min(0) minAge?: number;
  @IsOptional() @IsInt() @Min(0) maxAge?: number;
}

export class TourPricingDto {
  @IsIn(['TRY', 'EUR', 'USD', 'GBP']) currency!: CurrencyCode;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => PriceTierDto) tiers!: PriceTierDto[];
  @IsOptional() @IsInt() @Min(0) premiumSeatSurcharge?: number;
}

export class MeetingPointDto {
  @ValidateNested() @Type(() => LocalizedTextDto) name!: LocalizedTextDto;
  @IsOptional() @IsString() @MaxLength(300) address?: string;
  @ValidateNested() @Type(() => GeoPointDto) location!: GeoPointDto;
  @IsOptional() @ValidateNested() @Type(() => LocalizedTextDto) instructions?: LocalizedTextDto;
}

/** Everything a template and a departure share. */
export class TourCoreDto {
  @IsString() @IsNotEmpty() routeId!: string;
  @IsString() @IsNotEmpty() vehicleId!: string;
  @IsString() @IsNotEmpty() guideId!: string;
  @ValidateNested() @Type(() => MeetingPointDto) meetingPoint!: MeetingPointDto;
  @IsArray() @IsString({ each: true }) languages!: string[];
  @ValidateNested() @Type(() => TourPricingDto) pricing!: TourPricingDto;
  @IsOptional() @ValidateNested() @Type(() => LocalizedListDto) inclusions?: LocalizedListDto;
  @IsOptional() @ValidateNested() @Type(() => LocalizedListDto) exclusions?: LocalizedListDto;
  @IsString() @IsNotEmpty() @MaxLength(32) contactPhone!: string;
  @IsOptional() @IsString() @MaxLength(32) whatsapp?: string;
  @IsOptional() @ValidateNested() @Type(() => LocalizedTextDto) cancellationPolicy?: LocalizedTextDto;
  @IsOptional() @IsArray() @IsString({ each: true }) blockedSeats?: string[];
  @IsOptional() @IsInt() @Min(1) minPassengers?: number;
  @IsOptional() @IsInt() @Min(30) @Max(1440) durationMinutes?: number;
  @IsOptional() @IsString() @MaxLength(4000) internalNotes?: string;
}

export class TourCorePatchDto {
  @IsOptional() @IsString() @IsNotEmpty() routeId?: string;
  @IsOptional() @IsString() @IsNotEmpty() vehicleId?: string;
  @IsOptional() @IsString() @IsNotEmpty() guideId?: string;
  @IsOptional() @ValidateNested() @Type(() => MeetingPointDto) meetingPoint?: MeetingPointDto;
  @IsOptional() @IsArray() @IsString({ each: true }) languages?: string[];
  @IsOptional() @ValidateNested() @Type(() => TourPricingDto) pricing?: TourPricingDto;
  @IsOptional() @ValidateNested() @Type(() => LocalizedListDto) inclusions?: LocalizedListDto;
  @IsOptional() @ValidateNested() @Type(() => LocalizedListDto) exclusions?: LocalizedListDto;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(32) contactPhone?: string;
  @IsOptional() @IsString() @MaxLength(32) whatsapp?: string;
  @IsOptional() @ValidateNested() @Type(() => LocalizedTextDto) cancellationPolicy?: LocalizedTextDto;
  @IsOptional() @IsArray() @IsString({ each: true }) blockedSeats?: string[];
  @IsOptional() @IsInt() @Min(1) minPassengers?: number;
  @IsOptional() @IsInt() @Min(30) @Max(1440) durationMinutes?: number;
  @IsOptional() @IsString() @MaxLength(4000) internalNotes?: string;
}

export class CreateTourDto extends TourCoreDto {
  @IsISO8601() startsAt!: string;
  @IsOptional() @IsString() templateId?: string;
  @IsOptional() @IsIn(['DRAFT', 'PUBLISHED']) status?: 'DRAFT' | 'PUBLISHED';
  /** Skip the guide / vehicle double-booking check. */
  @IsOptional() @IsBoolean() force?: boolean;
}

export class UpdateTourDto extends TourCorePatchDto {
  @IsOptional() @IsISO8601() startsAt?: string;
  @IsOptional() @IsBoolean() force?: boolean;
}

export class TourQueryDto extends PaginationQueryDto {
  @IsOptional() @IsISO8601() from?: string;
  @IsOptional() @IsISO8601() to?: string;
  @IsOptional() @IsIn(['DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED']) status?: TourStatus;
  @IsOptional() @IsString() routeId?: string;
  @IsOptional() @IsString() guideId?: string;
  @IsOptional() @IsString() vehicleId?: string;
  /** Only departures led by the signed-in guide. */
  @IsOptional() @Type(() => Boolean) @IsBoolean() mine?: boolean;
}

export class TourStatusDto {
  @IsIn(['DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED']) status!: TourStatus;
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

export class DuplicateTourDto {
  @IsISO8601() startsAt!: string;
  @IsOptional() @IsString() guideId?: string;
  @IsOptional() @IsString() vehicleId?: string;
  @IsOptional() @IsBoolean() force?: boolean;
}

export class SaveTemplateDto {
  @IsString() @IsNotEmpty() @MaxLength(80) name!: string;
}

export class CreateTemplateDto extends TourCoreDto {
  @IsString() @IsNotEmpty() @MaxLength(80) name!: string;
  @IsOptional() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) defaultStartTime?: string;
}

export class UpdateTemplateDto extends TourCorePatchDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(80) name?: string;
  @IsOptional() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) defaultStartTime?: string;
}

export class CreateFromTemplateDto {
  @IsString() @IsNotEmpty() templateId!: string;
  /** Calendar days in Istanbul, "YYYY-MM-DD". */
  @IsArray() @ArrayMinSize(1) @Matches(/^\d{4}-\d{2}-\d{2}$/, { each: true }) dates!: string[];
  @IsOptional() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) startTime?: string;
  @IsOptional() @IsString() guideId?: string;
  @IsOptional() @IsString() vehicleId?: string;
  @IsOptional() @IsIn(['DRAFT', 'PUBLISHED']) status?: 'DRAFT' | 'PUBLISHED';
  @IsOptional() @IsBoolean() force?: boolean;
}
