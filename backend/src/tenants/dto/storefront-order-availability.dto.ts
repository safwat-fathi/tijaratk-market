import { ApiProperty } from '@nestjs/swagger';
import type { DeliveryAvailability } from 'src/delivery-configuration/delivery-scheduling.service';

export const STOREFRONT_ORDER_UNAVAILABLE_REASONS = [
  'setup_incomplete',
  'insufficient_products',
  'delivery_unavailable',
] as const;

export type StorefrontOrderUnavailableReason =
  (typeof STOREFRONT_ORDER_UNAVAILABLE_REASONS)[number];

/** Public decision describing whether a merchant storefront can accept an order. */
export class StorefrontOrderAvailabilityDto {
  @ApiProperty({ example: true })
  accepting_orders: boolean;

  @ApiProperty({
    enum: STOREFRONT_ORDER_UNAVAILABLE_REASONS,
    nullable: true,
    example: null,
  })
  reason: StorefrontOrderUnavailableReason | null;

  @ApiProperty({ nullable: true, example: null })
  message: string | null;

  @ApiProperty({ type: Object })
  delivery_availability: DeliveryAvailability;
}
