import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { DirectoryStatus } from '../../../generated/prisma/client';

/**
 * Payload for updating a tenant directory profile.
 */
export class UpdateDirectoryProfileDto {
  @ApiPropertyOptional({ enum: DirectoryStatus })
  @IsOptional()
  @IsEnum(DirectoryStatus)
  directory_status?: DirectoryStatus;

  @ApiPropertyOptional({ example: 'Hania Market' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  display_name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  logo_url?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cover_url?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  area_id?: number;

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
