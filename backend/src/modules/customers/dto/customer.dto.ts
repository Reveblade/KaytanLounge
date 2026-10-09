import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { LOCALES, type Locale } from '../../../contract/api';

export class RequestPhoneCodeDto {
  @IsString() @IsNotEmpty() phone!: string;
}

export class VerifyPhoneCodeDto {
  @IsString() @IsNotEmpty() phone!: string;
  @Length(6, 6) code!: string;
  @IsOptional() @IsString() @MaxLength(80) displayName?: string;
}

export class RequestEmailCodeDto {
  @IsEmail() email!: string;
}

export class VerifyEmailCodeDto {
  @IsEmail() email!: string;
  @Length(6, 6) code!: string;
  @IsOptional() @IsString() @MaxLength(80) displayName?: string;
  @IsOptional() @IsString() phone?: string;
}

export class GoogleLoginDto {
  @IsString() @IsNotEmpty() idToken!: string;
}

export class MetaLoginDto {
  @IsString() @IsNotEmpty() accessToken!: string;
}

export class ConfirmChallengeDto {
  @IsString() @IsNotEmpty() challengeId!: string;
  @IsString() @IsNotEmpty() code!: string;
}

export class ExchangeKuwhoDto {
  @IsString() @IsNotEmpty() accessToken!: string;
  @IsString() @IsNotEmpty() refreshToken!: string;
}

export class RefreshCustomerDto {
  @IsString() @IsNotEmpty() refreshToken!: string;
}

export class UpdateCustomerProfileDto {
  @IsOptional() @IsString() @MaxLength(60) firstName?: string;
  @IsOptional() @IsString() @MaxLength(60) lastName?: string;
  @IsOptional() @IsString() @MaxLength(80) displayName?: string;
  @IsOptional() @IsEnum(LOCALES) preferredLocale?: Locale;
}

export class AttachPhoneDto {
  @IsString() @IsNotEmpty() phone!: string;
}

export class VerifyAttachedPhoneDto {
  @IsString() @IsNotEmpty() phone!: string;
  @Length(6, 6) code!: string;
}

export class CustomerNotesDto {
  @IsOptional() @IsString() @MaxLength(4000) adminNotes?: string;
}
