import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const ADMIN_DIRECTORY_AREA_KINDS = ['main', 'sub'] as const;
export const ADMIN_DIRECTORY_AREA_STATUSES = ['active', 'inactive'] as const;
export const ADMIN_DIRECTORY_AREA_ATTENTION = [
  'any',
  'main_without_active_children',
  'missing_english',
  'missing_location',
  'orphaned_child',
] as const;

export type AdminDirectoryAreaAttention =
  (typeof ADMIN_DIRECTORY_AREA_ATTENTION)[number];

/** Validated server-side filters for paginated area administration. */
export class AdminDirectoryAreasQueryDto {
  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ example: 'أكتوبر' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ enum: ADMIN_DIRECTORY_AREA_KINDS })
  @IsOptional()
  @IsIn(ADMIN_DIRECTORY_AREA_KINDS)
  kind?: (typeof ADMIN_DIRECTORY_AREA_KINDS)[number];

  @ApiPropertyOptional({ example: 6 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  parentId?: number;

  @ApiPropertyOptional({ enum: ADMIN_DIRECTORY_AREA_STATUSES })
  @IsOptional()
  @IsIn(ADMIN_DIRECTORY_AREA_STATUSES)
  status?: (typeof ADMIN_DIRECTORY_AREA_STATUSES)[number];

  @ApiPropertyOptional({ example: 'الجيزة' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  governorate?: string;

  @ApiPropertyOptional({ example: '٦ أكتوبر' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @ApiPropertyOptional({ enum: ADMIN_DIRECTORY_AREA_ATTENTION })
  @IsOptional()
  @IsIn(ADMIN_DIRECTORY_AREA_ATTENTION)
  attention?: AdminDirectoryAreaAttention;
}

/**
 * Payload for creating a directory area.
 */
export class CreateDirectoryAreaDto {
  @ApiProperty({ example: 'الشيخ زايد' })
  @IsString()
  @MaxLength(120)
  name_ar: string;

  @ApiPropertyOptional({ example: 'Sheikh Zayed' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name_en?: string;

  @ApiProperty({ example: 'sheikh-zayed' })
  @IsString()
  @MaxLength(120)
  slug: string;

  @ApiPropertyOptional({ example: null, nullable: true, type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  parent_area_id?: number | null;

  @ApiPropertyOptional({ example: 'Giza' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @ApiPropertyOptional({ example: 'Giza' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  governorate?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sort_order?: number;

  @ApiPropertyOptional({ example: 30.0444 })
  @IsOptional()
  @Type(() => Number)
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ example: 31.2357 })
  @IsOptional()
  @Type(() => Number)
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(180)
  seo_title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  seo_description?: string;
}

/**
 * Payload for updating a directory area.
 */
export class UpdateDirectoryAreaDto extends PartialType(
  CreateDirectoryAreaDto,
) {}
