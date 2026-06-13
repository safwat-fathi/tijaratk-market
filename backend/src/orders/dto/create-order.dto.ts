import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { OrderType } from 'src/common/enums/order-type.enum';
import { CreateCustomerDto } from 'src/customers/dto/create-customer.dto';
import { OrderItemSelectionMode } from 'src/common/enums/order-item-selection-mode.enum';
import { OrderSource } from '../../../generated/prisma/client';

const parseJsonIfString = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

export class CreateOrderItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  product_id?: number;

  @ApiPropertyOptional({ example: 'عيش بلدي' })
  @ValidateIf((dto: CreateOrderItemDto) => !dto.product_id)
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiProperty({ example: '2' })
  @IsString()
  @MaxLength(50)
  quantity: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  unit_price?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  total_price?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;

  @ApiPropertyOptional({ enum: OrderItemSelectionMode })
  @IsOptional()
  @IsEnum(OrderItemSelectionMode)
  selection_mode?: OrderItemSelectionMode;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  selection_quantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  selection_grams?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  selection_amount_egp?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  unit_option_id?: string;
}

export class CreateOrderDto {
  @ApiProperty()
  @Transform(parseJsonIfString)
  @ValidateNested()
  @Type(() => CreateCustomerDto)
  customer: CreateCustomerDto;

  @ApiPropertyOptional({ enum: OrderType })
  @IsOptional()
  @IsEnum(OrderType)
  order_type?: OrderType;

  @ApiPropertyOptional({ type: [CreateOrderItemDto] })
  @Transform(parseJsonIfString)
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items?: CreateOrderItemDto[];

  @ApiPropertyOptional()
  @Transform(parseJsonIfString)
  @IsOptional()
  @IsObject()
  free_text_payload?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  total?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  delivery_fee?: number;

  @ApiPropertyOptional({ enum: OrderSource, example: OrderSource.directory })
  @IsOptional()
  @IsEnum(OrderSource)
  order_source?: OrderSource;

  @ApiPropertyOptional({
    type: Object,
    example: { areaSlug: 'sheikh-zayed', categorySlug: 'supermarkets' },
  })
  @Transform(parseJsonIfString)
  @IsOptional()
  @IsObject()
  source_metadata?: Record<string, any>;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  delivery_area_id?: number;

  @ApiPropertyOptional({ example: 'sheikh-zayed' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  delivery_area_slug?: string;

  @ApiPropertyOptional({
    example: 'call',
    description: 'Customer preference if prescription items are unavailable',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  prescription_unavailability_action?: string;
}
