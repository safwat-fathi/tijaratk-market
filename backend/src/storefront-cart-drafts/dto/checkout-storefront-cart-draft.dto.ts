import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { CreateCustomerDto } from 'src/customers/dto/create-customer.dto';
import { DeliverySlotDto } from 'src/orders/dto/create-order.dto';

/** Customer and delivery fields accepted only at the final checkout step. */
export class CheckoutStorefrontCartDraftDto {
  @ApiProperty({ type: CreateCustomerDto })
  @ValidateNested()
  @Type(() => CreateCustomerDto)
  customer: CreateCustomerDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;

  @ApiPropertyOptional({ type: DeliverySlotDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DeliverySlotDto)
  delivery_slot?: DeliverySlotDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true')
  card_on_delivery_requested?: boolean;

  @ApiPropertyOptional({ description: 'Optional explicit delivery address override' })
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  delivery_address?: string;

  @ApiPropertyOptional({
    description: 'Consented GA4 browser client identifier',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9._-]{1,128}$/)
  ga_client_id?: string;

  @ApiPropertyOptional({
    description: 'Consented GA4 browser session identifier',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{1,20}$/)
  ga_session_id?: string;
}
