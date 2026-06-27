import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateSupermarketEssentialDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  catalog_item_id?: number;

  @ValidateIf((dto: CreateSupermarketEssentialDto) => !dto.catalog_item_id)
  @IsString()
  name?: string;

  @ValidateIf((dto: CreateSupermarketEssentialDto) => !dto.catalog_item_id)
  @IsString()
  category?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsString()
  image_url?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  essential_sort_order?: number;
}

export class UpdateSupermarketEssentialDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price?: number | null;

  @IsOptional()
  @IsString()
  image_url?: string | null;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  essential_sort_order?: number | null;
}
