import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

/** Payload used by customers to request a listed or unlisted product. */
export class CreateAvailabilityRequestDto {
  @ApiPropertyOptional({ example: 123 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  product_id?: number;

  @ApiPropertyOptional({ example: 'رز بسمتي' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  requested_product_name?: string;

  @ApiPropertyOptional({ example: 'أحمد محمد' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  customer_name?: string;

  @ApiPropertyOptional({ example: '01012345678' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  customer_phone?: string;

  @ApiPropertyOptional({ example: 'شارع النصر، مدينة نصر' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  customer_address?: string;

  @ApiPropertyOptional({ example: 'يفضل التواصل واتساب' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  customer_notes?: string;

  @ApiProperty({ example: 'v_c2f2f8d7b47a4e4eb6ac' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  @Matches(/^[a-zA-Z0-9_-]+$/)
  visitor_key: string;
}
