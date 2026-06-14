import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

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

  @ApiPropertyOptional({ example: null })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  parent_area_id?: number;

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
