import { ApiProperty } from '@nestjs/swagger';

/** Exact merchant-owned order counts grouped by customer-facing workflow status. */
export class OwnedOrderStatusCountsDto {
  @ApiProperty({ example: 3 })
  draft: number;

  @ApiProperty({ example: 2 })
  confirmed: number;

  @ApiProperty({ example: 1 })
  out_for_delivery: number;

  @ApiProperty({ example: 8 })
  completed: number;

  @ApiProperty({ example: 1 })
  cancelled: number;

  @ApiProperty({ example: 0 })
  rejected_by_customer: number;
}

/** Exact current assignment counts for the authenticated fulfillment merchant. */
export class AssignedOrderCountsDto {
  @ApiProperty({ example: 2 })
  pending: number;

  @ApiProperty({ example: 4 })
  accepted: number;

  @ApiProperty({ example: 6 })
  total: number;
}

/** Counter payload shared by the merchant order inbox and sidebar navigation. */
export class OrderInboxSummaryDto {
  @ApiProperty({ type: OwnedOrderStatusCountsDto })
  owned_status_counts: OwnedOrderStatusCountsDto;

  @ApiProperty({ type: AssignedOrderCountsDto })
  assigned_counts: AssignedOrderCountsDto;

  @ApiProperty({ example: 5 })
  new_orders_count: number;
}
