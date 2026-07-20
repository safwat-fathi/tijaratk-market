import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateMissingDeliveryAreaRequestDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  main_area_id: number;

  @ApiProperty({ example: 'شارع الهرم' })
  @IsString()
  @MaxLength(120)
  requested_area_name: string;

  @ApiPropertyOptional({ example: 'بجوار محطة المريوطية' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ResolveMissingDeliveryAreaRequestDto {
  @ApiProperty({ example: 12 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  resolved_area_id: number;
}
