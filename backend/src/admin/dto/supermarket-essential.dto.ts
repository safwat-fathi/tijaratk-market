import { Type } from 'class-transformer';
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
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsInt()
  essential_sort_order?: number | null;
}
