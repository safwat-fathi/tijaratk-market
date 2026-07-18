import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { TenantCategory } from '../../../generated/prisma/client';
import { OrderStatus } from 'src/common/enums/order-status.enum';

const ZONE_TENANT_CATEGORIES = [
  TenantCategory.grocery,
  TenantCategory.pharmacy,
] as const;

/** Creates one public zone and its internal operator tenant. */
export class CreateZoneStorefrontDto {
  @ApiProperty({ example: 'تجارة الشيخ زايد' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @ApiProperty({ example: 'sheikh-zayed' })
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MaxLength(120)
  slug: string;

  @ApiProperty({ example: 12 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  area_id: number;

  @ApiProperty({ enum: ZONE_TENANT_CATEGORIES })
  @IsIn(ZONE_TENANT_CATEGORIES)
  category: TenantCategory;

  @ApiProperty({ example: '01000000000' })
  @IsString()
  @MinLength(8)
  @MaxLength(32)
  operations_phone: string;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  delivery_fee?: number;
}

/** Enables or disables new public ordering for a configured zone. */
export class UpdateZoneStorefrontActivationDto {
  @ApiProperty()
  @IsBoolean()
  is_active: boolean;
}

/** Stores the trusted fee for one direct child of a zone storefront area. */
export class ZoneDeliveryAreaFeeDto {
  @ApiProperty({ example: 42 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  area_id: number;

  @ApiProperty({ example: 25 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  delivery_fee: number;
}

/** Replaces the complete child-area fee configuration for one zone. */
export class UpdateZoneDeliveryFeesDto {
  @ApiProperty({ type: [ZoneDeliveryAreaFeeDto] })
  @IsArray()
  @ArrayUnique((entry: ZoneDeliveryAreaFeeDto) => entry.area_id)
  @ValidateNested({ each: true })
  @Type(() => ZoneDeliveryAreaFeeDto)
  delivery_areas: ZoneDeliveryAreaFeeDto[];
}

/** Creates or updates a non-destructive zone merchant membership. */
export class UpsertZoneStorefrontMerchantDto {
  @ApiProperty({ example: 42 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  tenant_id: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  priority?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

/** Assigns or reassigns a pending dispatch with optimistic concurrency. */
export class AssignOrderDispatchDto {
  @ApiProperty({ example: 7 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  target_tenant_id: number;

  @ApiProperty({ example: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  expected_version: number;

  @ApiPropertyOptional({ example: 'المتجر الأقرب للعنوان' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  internal_notes?: string;
}

/** Cancels an active dispatch and its operator-owned order. */
export class CancelOrderDispatchDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  expected_version: number;

  @ApiProperty({ example: 'تعذر توفير الطلب من المتاجر المتاحة' })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason: string;
}

/** Stores one assignment-scoped quote line before merchant acceptance. */
export class UpdateDispatchQuoteLineDto {
  @ApiProperty({ example: 92 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  total_price: number;

  @ApiProperty({ example: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  expected_version: number;
}

/** Accepts the current assignment and atomically locks quoted pricing. */
export class AcceptOrderDispatchDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  expected_version: number;
}

/** Rejects the current assignment without mutating the original order. */
export class RejectOrderDispatchDto extends AcceptOrderDispatchDto {
  @ApiProperty({ example: 'بعض الأصناف غير متوفرة' })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason: string;
}

/** Progresses an accepted assigned order through fulfillment-only states. */
export class UpdateAssignedOrderStatusDto {
  @ApiProperty({
    enum: [OrderStatus.OUT_FOR_DELIVERY, OrderStatus.COMPLETED],
  })
  @IsIn([OrderStatus.OUT_FOR_DELIVERY, OrderStatus.COMPLETED])
  status: OrderStatus;
}

/** Proposes or clears a replacement on an accepted assigned order. */
export class UpdateAssignedOrderReplacementDto {
  @ApiPropertyOptional({ nullable: true, example: 55 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  replacement_product_id?: number | null;
}
