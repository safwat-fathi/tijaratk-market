import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsBoolean,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  CATALOG_SOURCE_CHEFAA,
  CATALOG_SOURCE_TALABAT,
} from 'src/products/catalog-source-policy';
import { ProductStatus } from 'src/common/enums/product-status.enum';

const ADMIN_CATALOG_SOURCES = [
  CATALOG_SOURCE_TALABAT,
  CATALOG_SOURCE_CHEFAA,
] as const;

const ADMIN_CATALOG_ITEM_STATUSES = ['all', 'active', 'inactive'] as const;

/**
 * Query parameters for source-scoped admin catalog item listing.
 */
export class GetAdminCatalogItemsDto {
  @ApiProperty({
    enum: ADMIN_CATALOG_SOURCES,
    description: 'Catalog source to manage',
  })
  @IsIn(ADMIN_CATALOG_SOURCES)
  source!: (typeof ADMIN_CATALOG_SOURCES)[number];

  @ApiPropertyOptional({
    description: 'Filter items by normalized category',
    example: 'أدوية',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  category?: string;

  @ApiPropertyOptional({
    description: 'Search items by name',
    example: 'بنادول',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({
    enum: ADMIN_CATALOG_ITEM_STATUSES,
    description: 'Filter items by activity status',
    default: 'all',
  })
  @IsOptional()
  @IsIn(ADMIN_CATALOG_ITEM_STATUSES)
  status?: (typeof ADMIN_CATALOG_ITEM_STATUSES)[number] = 'all';

  @ApiPropertyOptional({
    description: 'Page number',
    default: 1,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Page size',
    default: 20,
    maximum: 100,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

/**
 * Query parameters for source-scoped admin catalog category listing.
 */
export class GetAdminCatalogCategoriesDto {
  @ApiProperty({
    enum: ADMIN_CATALOG_SOURCES,
    description: 'Catalog source to inspect',
  })
  @IsIn(ADMIN_CATALOG_SOURCES)
  source!: (typeof ADMIN_CATALOG_SOURCES)[number];
}

export class CreateAdminCatalogCategoryDto {
  @ApiProperty({
    enum: ADMIN_CATALOG_SOURCES,
    description: 'Catalog source for the category',
  })
  @IsIn(ADMIN_CATALOG_SOURCES)
  source!: (typeof ADMIN_CATALOG_SOURCES)[number];

  @ApiProperty({ description: 'Normalized source category name' })
  @IsString()
  @MaxLength(64)
  name!: string;
}

export class UpdateAdminCatalogCategoryDto {
  @ApiProperty({ description: 'Normalized source category name' })
  @IsString()
  @MaxLength(64)
  name!: string;
}

export class CreateTenantProductCategoryDto {
  @ApiProperty({ description: 'Merchant product category name' })
  @IsString()
  @MaxLength(64)
  name!: string;
}

export class UpdateTenantProductCategoryDto {
  @ApiProperty({ description: 'Merchant product category name' })
  @IsString()
  @MaxLength(64)
  name!: string;
}

/**
 * Payload for creating global catalog items from the admin dashboard.
 */
export class CreateAdminCatalogItemDto {
  @ApiProperty({
    enum: ADMIN_CATALOG_SOURCES,
    description: 'Catalog source for the item',
  })
  @IsIn(ADMIN_CATALOG_SOURCES)
  source!: (typeof ADMIN_CATALOG_SOURCES)[number];

  @ApiProperty({ description: 'Catalog item name' })
  @IsString()
  @MaxLength(255)
  name!: string;

  @ApiProperty({ description: 'Normalized source category' })
  @IsString()
  @MaxLength(64)
  category!: string;

  @ApiPropertyOptional({ description: 'Item price' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price?: number | null;

  @ApiPropertyOptional({ description: 'Three-letter currency code' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({ description: 'Image URL if no file is uploaded' })
  @IsOptional()
  @IsString()
  image_url?: string | null;

  @ApiPropertyOptional({ description: 'External source identifier' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  external_id?: string | null;

  @ApiPropertyOptional({ description: 'Whether the item is active' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional({ description: 'Whether the item is curated essential' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  is_essential?: boolean;

  @ApiPropertyOptional({ description: 'Essential item sort order' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  essential_sort_order?: number | null;
}

/**
 * Payload for updating global catalog items from the admin dashboard.
 */
export class UpdateAdminCatalogItemDto {
  @ApiPropertyOptional({ description: 'Catalog item name' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ description: 'Normalized source category' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  category?: string;

  @ApiPropertyOptional({ description: 'Item price' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price?: number | null;

  @ApiPropertyOptional({ description: 'Three-letter currency code' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({ description: 'Image URL if no file is uploaded' })
  @IsOptional()
  @IsString()
  image_url?: string | null;

  @ApiPropertyOptional({ description: 'External source identifier' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  external_id?: string | null;

  @ApiPropertyOptional({ description: 'Whether the item is active' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional({ description: 'Whether the item is curated essential' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  is_essential?: boolean;

  @ApiPropertyOptional({ description: 'Essential item sort order' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  essential_sort_order?: number | null;
}

const normalizeBulkIds = (value: unknown): number[] => {
  if (!Array.isArray(value)) return value as number[];

  return Array.from(
    new Set(
      value
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0),
    ),
  );
};

export class BulkUpdateAdminCatalogItemsDto {
  @ApiProperty({ type: [Number], description: 'Catalog item IDs to update' })
  @Transform(({ value }) => normalizeBulkIds(value))
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @IsInt({ each: true })
  @Min(1, { each: true })
  ids!: number[];

  @ApiPropertyOptional({ description: 'Normalized source category' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  category?: string;

  @ApiPropertyOptional({ description: 'Whether selected items are active' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional({
    description: 'Whether selected items are curated essential rows',
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  is_essential?: boolean;
}

export class BulkUpdateAdminProductsDto {
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
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  is_available?: boolean;

  @ApiPropertyOptional({ enum: ProductStatus })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;
}
