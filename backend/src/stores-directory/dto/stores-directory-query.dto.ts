import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Query parameters for area autocomplete.
 */
export class DirectoryAreasQueryDto {
  @ApiPropertyOptional({ example: 'sheikh' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}

/**
 * Query parameters for category store listing.
 */
export class DirectoryCategoryStoresQueryDto {
  @ApiPropertyOptional({
    example: 'el-hay-el-16',
    description:
      'Exact active child delivery-area slug required before store results are returned',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  delivery_area_slug?: string;

  @ApiPropertyOptional({ example: 'hania' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  open_now?: boolean;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
