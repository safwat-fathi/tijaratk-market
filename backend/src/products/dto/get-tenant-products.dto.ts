import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { parseBooleanLike } from '../utils/parse-boolean-like';
import { ProductStatus } from 'src/common/enums/product-status.enum';

export class GetTenantProductsDto {
  @ApiPropertyOptional({
    description: 'Search products by name (min 2 chars)',
    example: 'لبن',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter products by category',
    example: 'أرز ومكرونة',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  category?: string;

  @ApiPropertyOptional({
    description:
      'When true, keeps all matched-scope products and orders by similarity score without similarity cutoff filtering',
    example: true,
    default: false,
  })
  @IsOptional()
  @Transform(
    ({ obj, value }: { obj?: Record<string, unknown>; value: unknown }) => {
      const fromRawObject = parseBooleanLike(obj?.rank_all);
      if (fromRawObject !== undefined) {
        return fromRawObject;
      }
      const parsedValue = parseBooleanLike(value);
      return parsedValue !== undefined ? parsedValue : value;
    },
    { toClassOnly: true },
  )
  @IsBoolean()
  rank_all?: boolean = false;

  @ApiPropertyOptional({
    description: 'Comma-separated product IDs to exclude from results',
    example: '12,15,22',
  })
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => {
      if (typeof value !== 'string' && !Array.isArray(value)) {
        return undefined;
      }

      const rawValue = Array.isArray(value)
        ? value
            .filter((item): item is string => typeof item === 'string')
            .join(',')
        : value;

      const parsedIds = rawValue
        .split(',')
        .map((item) => Number(item.trim()))
        .filter((id) => Number.isInteger(id) && id > 0);

      if (parsedIds.length === 0) {
        return undefined;
      }

      return Array.from(new Set(parsedIds));
    },
    { toClassOnly: true },
  )
  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  exclude_product_ids?: number[];

  @ApiPropertyOptional({
    description: 'Dashboard product lifecycle status',
    enum: ProductStatus,
    default: ProductStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus = ProductStatus.ACTIVE;

  @ApiPropertyOptional({
    description: 'Page number for search results',
    example: 1,
    default: 1,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Page size for search results',
    example: 20,
    default: 20,
    maximum: 50,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}
