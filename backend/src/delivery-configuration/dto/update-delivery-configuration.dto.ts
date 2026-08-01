import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { DeliveryFeeMode } from '../../../generated/prisma/client';

export class DeliveryAreaFeeDto {
  @ApiProperty({ example: 12 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  area_id: number;

  @ApiProperty({
    example: 20,
    description: 'Delivery fee in EGP. Stored as 0 for on_order zones',
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  delivery_fee: number;

  @ApiPropertyOptional({
    enum: DeliveryFeeMode,
    default: DeliveryFeeMode.fixed,
    description: 'on_order defers pricing until the merchant sees the address',
  })
  @IsOptional()
  @IsEnum(DeliveryFeeMode)
  fee_mode?: DeliveryFeeMode;

  @ApiPropertyOptional({
    example: 20,
    description: 'Optional lower bound advertised at checkout for on_order zones',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  min_delivery_fee?: number | null;

  @ApiPropertyOptional({
    example: 40,
    description: 'Optional upper bound advertised at checkout for on_order zones',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  max_delivery_fee?: number | null;
}

export class UpdateDeliveryConfigurationDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  delivery_available: boolean;

  @ApiPropertyOptional({ example: '10:00' })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'delivery_starts_at must be a valid time in HH:mm format',
  })
  delivery_starts_at?: string | null;

  @ApiPropertyOptional({ example: '22:00' })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'delivery_ends_at must be a valid time in HH:mm format',
  })
  delivery_ends_at?: string | null;

  @ApiProperty({ example: [4, 5] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Type(() => Number)
  main_area_ids: number[];

  @ApiProperty({ type: [DeliveryAreaFeeDto] })
  @IsArray()
  @ArrayUnique((item: DeliveryAreaFeeDto) => item.area_id)
  @ValidateNested({ each: true })
  @Type(() => DeliveryAreaFeeDto)
  delivery_areas: DeliveryAreaFeeDto[];
}
