import { ApiProperty, ApiPropertyOptional, PickType } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { UpdateProductDto } from 'src/products/dto/update-product.dto';
import { ProductStatus } from 'src/common/enums/product-status.enum';

export class UpdateManagedProductDetailsDto extends PickType(
  UpdateProductDto,
  ['name', 'image_url', 'category', 'order_mode', 'order_config'] as const,
) {}

export class UpdateManagedProductPriceDto {
  @ApiProperty({ minimum: 0.01 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  current_price: number;
}

export class UpdateManagedProductAvailabilityDto {
  @ApiProperty()
  @IsBoolean()
  is_available: boolean;
}

export class UpdateManagedProductStatusDto {
  @ApiPropertyOptional({ enum: ProductStatus })
  @IsEnum(ProductStatus)
  status: ProductStatus;
}
