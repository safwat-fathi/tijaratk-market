import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Min } from 'class-validator';

export class SetOrderDeliveryFeeDto {
  @ApiProperty({
    description:
      'Delivery fee in EGP for an order placed on an on_order zone. Must fall inside the range quoted to the customer when one was advertised.',
    example: 30,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  delivery_fee: number;
}
