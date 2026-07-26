import type {
  AdminRole,
  OrderStatus,
  Prisma,
  PushNotificationEventType,
} from '../../generated/prisma/client';

export type BrowserPushSubscription = {
  endpoint: string;
  expirationTime: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
};

export type PushDeliveryConfig = {
  subject: string;
  publicKey: string;
  privateKey: string;
};

export type PushNotificationEnvelope = {
  version: 1;
  eventId: string;
  type:
    | 'admin.merchant.registered'
    | 'merchant.order.created'
    | 'admin.order.created'
    | 'merchant.assignment.created'
    | 'customer.order.status_changed'
    | 'customer.order.replacement_requested';
  title: string;
  body: string;
  url: string;
  iconUrl?: string;
  tag: string;
  createdAt: string;
};

export type MerchantRegistrationPushOutboxPayload = {
  storeName: string;
};

export type OrderPushOutboxPayload = {
  storeName: string;
  orderNumber: string;
  zoneName?: string;
};

export type CustomerOrderStatusPushOutboxPayload = {
  status: OrderStatus;
};

export type ClaimedPushEvent = {
  id: number;
  event_key: string;
  event_type: PushNotificationEventType;
  tenant_id: number;
  order_id: number | null;
  dispatch_id: number | null;
  assignment_id: number | null;
  zone_id: number | null;
  payload: Prisma.JsonValue;
  attempt_count: number;
  created_at: Date;
};

type BasePushDeliveryTarget = {
  subscriptionId: number;
  encryptedSubscription: string;
  notificationIconUrl?: string;
};

export type PushDeliveryTarget =
  | (BasePushDeliveryTarget & {
      actor: 'merchant';
    })
  | (BasePushDeliveryTarget & {
      actor: 'admin';
      adminRole: AdminRole;
    })
  | (BasePushDeliveryTarget & {
      actor: 'customer';
      notificationUrl: string;
      storeName: string;
      orderNumber: string;
    });
