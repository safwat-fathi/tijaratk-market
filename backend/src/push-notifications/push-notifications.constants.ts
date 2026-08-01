export const PUSH_OUTBOX_POLL_INTERVAL_MS = 1_000;
export const PUSH_OUTBOX_BATCH_SIZE = 20;
export const PUSH_OUTBOX_LOCK_TIMEOUT_MS = 2 * 60 * 1_000;
export const PUSH_OUTBOX_MAX_ATTEMPTS = 8;
export const PUSH_OUTBOX_MAX_EVENT_AGE_MS = 24 * 60 * 60 * 1_000;
export const PUSH_OUTBOX_RETENTION_MS = 30 * 24 * 60 * 60 * 1_000;
export const PUSH_SUBSCRIPTION_STALE_MS = 90 * 24 * 60 * 60 * 1_000;
export const PUSH_CLEANUP_INTERVAL_MS = 60 * 60 * 1_000;
export const PUSH_MESSAGE_TTL_SECONDS = 24 * 60 * 60;

export const PUSH_CLIENT_EVENT_TYPES = {
  AdminMerchantRegistered: 'admin.merchant.registered',
  MerchantOrderCreated: 'merchant.order.created',
  AdminOrderCreated: 'admin.order.created',
  CustomerOrderStatusChanged: 'customer.order.status_changed',
  CustomerReplacementRequested: 'customer.order.replacement_requested',
  CustomerDeliveryFeeSet: 'customer.order.delivery_fee_set',
} as const;
