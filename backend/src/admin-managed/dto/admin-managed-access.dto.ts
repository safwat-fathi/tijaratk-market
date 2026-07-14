import { Transform, Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ADMIN_MANAGED_PERMISSION_VALUES } from '../constants/admin-managed-permissions';

export class StartAdminManagementSessionDto {
  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  tenant_id: number;

  @ApiProperty({ minLength: 10, maxLength: 500 })
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  reason: string;
}

export class UpsertAdminTenantAccessDto {
  @ApiProperty({ type: [String], enum: ADMIN_MANAGED_PERMISSION_VALUES })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsIn(ADMIN_MANAGED_PERMISSION_VALUES, { each: true })
  permissions: string[];

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @IsOptional()
  @IsISO8601()
  expires_at?: string | null;
}

export class UpdateAdminActiveStatusDto {
  @ApiProperty()
  @IsBoolean()
  is_active: boolean;
}
