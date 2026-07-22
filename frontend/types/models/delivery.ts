export type DeliverySlot = {
  date: string;
  starts_at: string;
  ends_at: string;
};

export type DeliveryAvailability = {
  timezone: "Africa/Cairo";
  state: "open" | "closed" | "unavailable";
  ordering_mode: "asap" | "scheduled" | "unavailable";
  operating_hours: {
    starts_at: string | null;
    ends_at: string | null;
  };
  schedule_constraints: {
    date: string;
    min_starts_at: string;
    max_ends_at: string;
    step_minutes: 15;
    min_duration_minutes: 60;
  } | null;
  slots: DeliverySlot[];
};

export const STOREFRONT_ORDER_UNAVAILABLE_REASONS = {
  SETUP_INCOMPLETE: "setup_incomplete",
  INSUFFICIENT_PRODUCTS: "insufficient_products",
  DELIVERY_UNAVAILABLE: "delivery_unavailable",
} as const;

export type StorefrontOrderUnavailableReason =
  (typeof STOREFRONT_ORDER_UNAVAILABLE_REASONS)[keyof typeof STOREFRONT_ORDER_UNAVAILABLE_REASONS];

export type StorefrontOrderAvailability = {
  accepting_orders: boolean;
  reason: StorefrontOrderUnavailableReason | null;
  message: string | null;
  delivery_availability: DeliveryAvailability;
};
