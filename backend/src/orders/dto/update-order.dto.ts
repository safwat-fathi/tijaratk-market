import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { CreateOrderDto } from './create-order.dto';
import { OrderStatus } from 'src/common/enums/order-status.enum';

export class UpdateOrderDto extends PartialType(CreateOrderDto) {
  @ApiPropertyOptional({ enum: OrderStatus })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiPropertyOptional({
    description: 'Optional merchant reason when cancelling the order.',
    example: 'المنتج غير متوفر',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  cancellation_reason?: string;
}
