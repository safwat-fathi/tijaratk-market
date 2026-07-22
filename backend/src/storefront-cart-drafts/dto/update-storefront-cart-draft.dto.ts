import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { OrderItemSelectionMode } from 'src/common/enums/order-item-selection-mode.enum';
import { UnavailableItemAction } from 'src/common/enums/unavailable-item-action.enum';
import { OrderSource } from '../../../generated/prisma/client';

/** One customer-selected product configuration stored in a cart draft. */
export class StorefrontCartDraftItemDto {
  @ApiProperty({ example: 42 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  product_id: number;

  @ApiProperty({ enum: OrderItemSelectionMode })
  @IsEnum(OrderItemSelectionMode)
  selection_mode: OrderItemSelectionMode;

  @ApiPropertyOptional()
  @ValidateIf((value: StorefrontCartDraftItemDto) =>
    value.selection_mode === OrderItemSelectionMode.QUANTITY,
  )
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  selection_quantity?: number;

  @ApiPropertyOptional()
  @ValidateIf((value: StorefrontCartDraftItemDto) =>
    value.selection_mode === OrderItemSelectionMode.WEIGHT,
  )
  @Type(() => Number)
  @IsInt()
  @Min(1)
  selection_grams?: number;

  @ApiPropertyOptional()
  @ValidateIf((value: StorefrontCartDraftItemDto) =>
    value.selection_mode === OrderItemSelectionMode.PRICE,
  )
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  selection_amount_egp?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  unit_option_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  item_note?: string;
}

/** Complete serializable portion of a storefront cart draft. */
export class UpdateStorefrontCartDraftDto {
  @ApiProperty({ type: [StorefrontCartDraftItemDto] })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => StorefrontCartDraftItemDto)
  items: StorefrontCartDraftItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  free_text_payload?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  delivery_area_id?: number;

  @ApiPropertyOptional({ enum: UnavailableItemAction })
  @IsOptional()
  @IsEnum(UnavailableItemAction)
  unavailable_item_action?: UnavailableItemAction;

  @ApiPropertyOptional({
    enum: [OrderSource.storefront, OrderSource.directory],
  })
  @IsOptional()
  @IsIn([OrderSource.storefront, OrderSource.directory])
  order_source?: OrderSource;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  source_metadata?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  prescription_unavailability_action?: string;
}
