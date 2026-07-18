import type {
  AdminRole,
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
    | 'merchant.order.created'
    | 'admin.order.created'
    | 'merchant.assignment.created';
  title: string;
  body: string;
  url: string;
  tag: string;
  createdAt: string;
};

export type PushOutboxPayload = {
  storeName: string;
  orderNumber: string;
  zoneName?: string;
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

export type PushDeliveryTarget = {
  subscriptionId: number;
  encryptedSubscription: string;
  actor: 'merchant' | 'admin';
  adminRole?: AdminRole;
};
