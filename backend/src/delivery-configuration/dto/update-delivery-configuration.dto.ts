import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';

export class DeliveryAreaFeeDto {
  @ApiProperty({ example: 12 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  area_id: number;

  @ApiProperty({ example: 20, description: 'Delivery fee in EGP' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  delivery_fee: number;
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

  @ApiProperty({ example: 4 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  primary_area_id: number;

  @ApiProperty({ type: [DeliveryAreaFeeDto] })
  @IsArray()
  @ArrayUnique((item: DeliveryAreaFeeDto) => item.area_id)
  @ValidateNested({ each: true })
  @Type(() => DeliveryAreaFeeDto)
  delivery_areas: DeliveryAreaFeeDto[];
}
