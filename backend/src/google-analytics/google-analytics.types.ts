import type { Prisma } from '../../generated/prisma/client';
import type { OrderStatus } from 'src/common/enums/order-status.enum';

export type Ga4TrackingContext = {
  clientId: string;
  sessionId?: string;
};

export type Ga4LifecycleEventName =
  | 'order_confirmed'
  | 'order_cancelled'
  | 'purchase';

export type Ga4DeliveryConfig = {
  measurementId: string;
  apiSecret: string;
};

export type Ga4MeasurementPayload = {
  client_id: string;
  timestamp_micros: number;
  consent: {
    ad_user_data: 'DENIED';
    ad_personalization: 'DENIED';
  };
  events: Array<{
    name: Ga4LifecycleEventName;
    params: Record<string, unknown>;
  }>;
};

export type EnqueueGa4LifecycleInput = {
  manager: Prisma.TransactionClient;
  orderId: number;
  eventName: Ga4LifecycleEventName;
  previousStatus: OrderStatus;
  occurredAt?: Date;
  cancellationReasonCode?: string;
};

export type ClaimedGa4OutboxEvent = {
  id: number;
  event_name: string;
  encrypted_payload: string | null;
  attempt_count: number;
  created_at: Date;
};
