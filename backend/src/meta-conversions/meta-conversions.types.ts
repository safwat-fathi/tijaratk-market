import type { Order, OrderItem, Prisma } from '../../generated/prisma/client';

export type MetaStorefrontType = 'tenant' | 'zone';

export type MetaTrackingContext = {
  consentGranted: boolean;
  clientIp?: string;
  clientUserAgent?: string;
  fbp?: string;
  fbc?: string;
  eventSourceUrl: string;
  storefrontType: MetaStorefrontType;
};

export type MetaPurchaseResponse = {
  event_id: string;
  value: number;
  currency: 'EGP';
};

export type MetaPurchaseOrder = Pick<
  Order,
  'id' | 'created_at' | 'customer_phone' | 'total'
>;

export type MetaPurchaseOrderItem = Pick<
  OrderItem,
  | 'product_id'
  | 'selection_quantity'
  | 'selection_grams'
  | 'selection_amount_egp'
  | 'total_price'
>;

export type EnqueueMetaPurchaseInput = {
  manager: Prisma.TransactionClient;
  order: MetaPurchaseOrder;
  orderItems: MetaPurchaseOrderItem[];
  context?: MetaTrackingContext;
};

export type MetaServerEvent = {
  event_name: 'Purchase';
  event_time: number;
  event_id: string;
  action_source: 'website';
  event_source_url: string;
  user_data: {
    ph: string[];
    client_ip_address?: string;
    client_user_agent?: string;
    fbp?: string;
    fbc?: string;
  };
  custom_data: {
    currency: 'EGP';
    value: number;
    conversion_type: 'order_created';
    storefront_type: MetaStorefrontType;
    content_type?: 'product';
    contents?: Array<{
      id: string;
      quantity: number;
      item_price?: number;
    }>;
    content_ids?: string[];
    num_items: number;
  };
};

export type MetaDeliveryConfig = {
  pixelId: string;
  accessToken: string;
  graphApiVersion: string;
  testEventCode?: string;
};

export type ClaimedMetaOutboxEvent = {
  id: number;
  event_id: string;
  encrypted_payload: string | null;
  attempt_count: number;
  created_at: Date;
};

