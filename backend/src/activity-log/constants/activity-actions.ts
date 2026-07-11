export const ActivityActions = {
  TenantStatusChanged: 'tenant.status_changed',
  TenantApplicationApproved: 'tenant.application_approved',
  TenantApplicationRejected: 'tenant.application_rejected',
  OrderCreated: 'order.created',
  OrderStatusChanged: 'order.status_changed',
  OrderCancelled: 'order.cancelled',
  OrderCompleted: 'order.completed',
  OrderRejectedByCustomer: 'order.rejected_by_customer',
  OrderTotalChanged: 'order.total_changed',
  OrderItemPriceChanged: 'order.item_price_changed',
  OrderItemOutOfStock: 'order.item_out_of_stock',
  OrderReplacementProposed: 'order.replacement_proposed',
  OrderReplacementApproved: 'order.replacement_approved',
  OrderReplacementRejected: 'order.replacement_rejected',
  ProductCreated: 'product.created',
  ProductUpdated: 'product.updated',
  ProductPriceChanged: 'product.price_changed',
  ProductAvailabilityChanged: 'product.availability_changed',
  ProductArchived: 'product.archived',
  ProductBulkCreated: 'product.bulk_created',
  ProductBulkUpdated: 'product.bulk_updated',
  ProductCsvImportCompleted: 'product.csv_import_completed',
} as const;

export type ActivityAction =
  (typeof ActivityActions)[keyof typeof ActivityActions];
