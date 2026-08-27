import {
  ArrayUnique,
  IsArray,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PERMISSIONS, type Permission } from '../../../contract/api';
import { ADMIN_PASSWORD_MAX_LENGTH, ADMIN_PASSWORD_MIN_LENGTH } from '../password.policy';

export class AdminLoginDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(ADMIN_PASSWORD_MIN_LENGTH) password!: string;
}

export class RefreshTokenDto {
  @IsString() @IsNotEmpty() refreshToken!: string;
}

export class ChangePasswordDto {
  @IsString() @MinLength(ADMIN_PASSWORD_MIN_LENGTH) currentPassword!: string;
  @IsString() @MinLength(ADMIN_PASSWORD_MIN_LENGTH) @MaxLength(ADMIN_PASSWORD_MAX_LENGTH) newPassword!: string;
}

export class UpdateOwnProfileDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(80) name?: string;
  @IsOptional() @IsString() @MaxLength(32) phone?: string;
}

export class CreateAdminDto {
  @IsEmail() email!: string;
  @IsString() @IsNotEmpty() @MaxLength(80) name!: string;
  @IsOptional() @IsString() @MaxLength(32) phone?: string;
  @IsString() @MinLength(ADMIN_PASSWORD_MIN_LENGTH) @MaxLength(ADMIN_PASSWORD_MAX_LENGTH) password!: string;
  @IsString() @IsNotEmpty() roleId!: string;
  @IsOptional() @IsString() guideId?: string;
}

export class UpdateAdminDto {
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(80) name?: string;
  @IsOptional() @IsString() @MaxLength(32) phone?: string;
  @IsOptional() @IsString() roleId?: string;
  @IsOptional() @IsString() guideId?: string | null;
  @IsOptional() @IsIn(['ACTIVE', 'SUSPENDED']) status?: 'ACTIVE' | 'SUSPENDED';
}

export class ResetAdminPasswordDto {
  @IsString() @MinLength(ADMIN_PASSWORD_MIN_LENGTH) @MaxLength(ADMIN_PASSWORD_MAX_LENGTH) newPassword!: string;
}

export class CreateRoleDto {
  @Matches(/^[a-z0-9_]{2,40}$/, { message: 'key must be lowercase letters, digits and underscores' })
  key!: string;

  @IsString() @IsNotEmpty() @MaxLength(60) name!: string;
  @IsOptional() @IsString() @MaxLength(300) description?: string;

  @IsArray() @ArrayUnique() @IsIn(PERMISSIONS, { each: true })
  permissions!: Permission[];
}

export class UpdateRoleDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(60) name?: string;
  @IsOptional() @IsString() @MaxLength(300) description?: string;
  @IsOptional() @IsArray() @ArrayUnique() @IsIn(PERMISSIONS, { each: true })
  permissions?: Permission[];
}
