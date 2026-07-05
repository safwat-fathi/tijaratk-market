import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { ProductStatus } from 'src/common/enums/product-status.enum';
import { parseBooleanLike } from '../utils/parse-boolean-like';

const normalizeBulkIds = (value: unknown): number[] => {
  const rawIds = Array.isArray(value) ? value : String(value ?? '').split(',');

  return Array.from(
    new Set(
      rawIds
        .map((item) => Number(String(item).trim()))
        .filter((id) => Number.isInteger(id) && id > 0),
    ),
  );
};

export class BulkUpdateProductsDto {
  @ApiProperty({ type: [Number], description: 'Product IDs to update' })
  @Transform(({ value }) => normalizeBulkIds(value))
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @IsInt({ each: true })
  @Min(1, { each: true })
  ids!: number[];

  @ApiPropertyOptional({ description: 'Merchant product category' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  category?: string;

  @ApiPropertyOptional({ description: 'Whether selected products are available' })
  @IsOptional()
  @Transform(({ obj, value }: { obj?: Record<string, unknown>; value: unknown }) => {
    const fromRawObject = parseBooleanLike(obj?.is_available);
    if (fromRawObject !== undefined) {
      return fromRawObject;
    }

    const parsedValue = parseBooleanLike(value);
    return parsedValue !== undefined ? parsedValue : value;
  })
  @IsBoolean()
  is_available?: boolean;

  @ApiPropertyOptional({ enum: ProductStatus })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;
}
