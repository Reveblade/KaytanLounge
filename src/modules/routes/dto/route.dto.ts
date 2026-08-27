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
import { LocalizedListDto, LocalizedTextDto, MediaItemDto, PaginationQueryDto } from '../../../common/dto/common.dto';
import { ROUTE_THEMES, type PublishStatus, type RouteNodeKind, type RoutePace, type RouteTheme } from '../../../contract/api';

export class RouteNodeInputDto {
  @IsIn(['ATTRACTION', 'BUSINESS']) kind!: RouteNodeKind;
  @IsString() @IsNotEmpty() refId!: string;
  @IsInt() @Min(0) @Max(600) stayMinutes!: number;
  @IsOptional() @ValidateNested() @Type(() => LocalizedTextDto) note?: LocalizedTextDto;
}

export class RouteQueryDto extends PaginationQueryDto {
  @IsOptional() @IsIn(['DRAFT', 'PUBLISHED', 'ARCHIVED']) status?: PublishStatus;
  @IsOptional() @IsIn(ROUTE_THEMES) theme?: RouteTheme;
}

export class CreateRouteDto {
  @IsOptional() @IsString() @MaxLength(80) slug?: string;
  @ValidateNested() @Type(() => LocalizedTextDto) name!: LocalizedTextDto;
  @IsOptional() @ValidateNested() @Type(() => LocalizedTextDto) tagline?: LocalizedTextDto;
  @IsOptional() @ValidateNested() @Type(() => LocalizedTextDto) description?: LocalizedTextDto;
  @IsOptional() @ValidateNested() @Type(() => LocalizedListDto) highlights?: LocalizedListDto;
  @IsOptional() @IsIn(ROUTE_THEMES) theme?: RouteTheme;
  @IsOptional() @IsIn(['RELAXED', 'BALANCED', 'FULL']) pace?: RoutePace;
  @IsArray() @ArrayMinSize(2) @ValidateNested({ each: true }) @Type(() => RouteNodeInputDto) nodes!: RouteNodeInputDto[];
  @IsOptional() @ValidateNested() @Type(() => MediaItemDto) cover?: MediaItemDto | null;
  @IsOptional() @IsBoolean() featured?: boolean;
  @IsOptional() @IsIn(['DRAFT', 'PUBLISHED', 'ARCHIVED']) status?: PublishStatus;
}

export class UpdateRouteDto {
  @IsOptional() @IsString() @MaxLength(80) slug?: string;
  @IsOptional() @ValidateNested() @Type(() => LocalizedTextDto) name?: LocalizedTextDto;
  @IsOptional() @ValidateNested() @Type(() => LocalizedTextDto) tagline?: LocalizedTextDto;
  @IsOptional() @ValidateNested() @Type(() => LocalizedTextDto) description?: LocalizedTextDto;
  @IsOptional() @ValidateNested() @Type(() => LocalizedListDto) highlights?: LocalizedListDto;
  @IsOptional() @IsIn(ROUTE_THEMES) theme?: RouteTheme;
  @IsOptional() @IsIn(['RELAXED', 'BALANCED', 'FULL']) pace?: RoutePace;
  @IsOptional() @IsArray() @ArrayMinSize(2) @ValidateNested({ each: true }) @Type(() => RouteNodeInputDto) nodes?: RouteNodeInputDto[];
  @IsOptional() @ValidateNested() @Type(() => MediaItemDto) cover?: MediaItemDto | null;
  @IsOptional() @IsBoolean() featured?: boolean;
  @IsOptional() @IsIn(['DRAFT', 'PUBLISHED', 'ARCHIVED']) status?: PublishStatus;
}

export class PreviewPathDto {
  @IsArray() @ArrayMinSize(2) @ValidateNested({ each: true }) @Type(() => RouteNodeInputDto) nodes!: RouteNodeInputDto[];
}
