export const PUSH_SCOPES = {
  merchant: "/merchant",
  admin: "/admin",
} as const;

export type PushScope = keyof typeof PUSH_SCOPES;

export type PushNotificationsConfig = {
  enabled: boolean;
  publicKey?: string;
};

export type BrowserPushSubscriptionPayload = {
  endpoint: string;
  expirationTime: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
};

export type PushNotificationMessage = {
  version: 1;
  eventId: string;
  type:
    | "admin.merchant.registered"
    | "merchant.order.created"
    | "admin.order.created"
    | "merchant.assignment.created";
  title: string;
  body: string;
  url: string;
  iconUrl?: string;
  tag: string;
  createdAt: string;
};
