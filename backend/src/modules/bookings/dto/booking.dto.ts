import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/common.dto';
import {
  LOCALES,
  PAYMENT_PROVIDERS,
  PRICE_TIER_KEYS,
  type BookingStatus,
  type Locale,
  type PaymentProvider,
  type PriceTierKey,
} from '../../../contract/api';

export class BookingPassengerInputDto {
  @IsString() @IsNotEmpty() @MaxLength(6) seatLabel!: string;
  @IsString() @IsNotEmpty() @MaxLength(80) fullName!: string;
  @IsIn(PRICE_TIER_KEYS) tierKey!: PriceTierKey;
}

export class BookingContactDto {
  @IsString() @IsNotEmpty() @MaxLength(80) fullName!: string;
  @IsString() @IsNotEmpty() @MaxLength(32) phone!: string;
  @IsOptional() @IsEmail() email?: string;
}

export class QuoteDto {
  @IsString() @IsNotEmpty() tourId!: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => BookingPassengerInputDto)
  passengers!: BookingPassengerInputDto[];
}

export class CreateBookingDto extends QuoteDto {
  @ValidateNested() @Type(() => BookingContactDto) contact!: BookingContactDto;
  @IsIn(PAYMENT_PROVIDERS) paymentProvider!: PaymentProvider;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
  @IsOptional() @IsEnum(LOCALES) locale?: Locale;
}

export class AdminCreateBookingDto extends CreateBookingDto {
  @IsOptional() @IsString() customerId?: string;
  /** Record the money as already received (cash at the desk, transfer seen). */
  @IsOptional() @IsBoolean() markPaid?: boolean;
  @IsOptional() @IsString() @MaxLength(120) paymentReference?: string;
}

export class BookingQueryDto extends PaginationQueryDto {
  @IsOptional() @IsIn(['PENDING_PAYMENT', 'AWAITING_APPROVAL', 'CONFIRMED', 'CANCELLED', 'REFUNDED', 'EXPIRED'])
  status?: BookingStatus;
  @IsOptional() @IsString() tourId?: string;
  @IsOptional() @IsString() customerId?: string;
  @IsOptional() @IsISO8601() from?: string;
  @IsOptional() @IsISO8601() to?: string;
}

export class ApprovePaymentDto {
  @IsOptional() @IsString() @MaxLength(120) reference?: string;
  @IsOptional() @IsIn(PAYMENT_PROVIDERS) provider?: PaymentProvider;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class RejectPaymentDto {
  @IsString() @IsNotEmpty() @MaxLength(500) reason!: string;
}

export class RefundDto {
  @IsOptional() @IsInt() @Min(1) amount?: number;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class CancelBookingDto {
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

export class CheckInDto {
  /** Omit to check in every passenger on the booking. */
  @IsOptional() @IsArray() @IsString({ each: true }) seatLabels?: string[];
  @IsOptional() @IsBoolean() undo?: boolean;
}

export class UpdatePassengersDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => BookingPassengerInputDto)
  passengers!: BookingPassengerInputDto[];
  @IsOptional() @ValidateNested() @Type(() => BookingContactDto) contact?: BookingContactDto;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}
