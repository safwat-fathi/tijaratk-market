import type { StorefrontOrderAvailability } from "@/types/models/delivery";

const DEFAULT_UNAVAILABLE_MESSAGE =
  "تعذر التحقق من استقبال الطلبات حالياً. حاول مرة أخرى لاحقاً.";

/** Returns a fail-closed ordering state when live availability cannot be loaded. */
export const createUnavailableStorefrontOrderState = (
  message = DEFAULT_UNAVAILABLE_MESSAGE,
): StorefrontOrderAvailability => ({
  accepting_orders: false,
  reason: "delivery_unavailable",
  message,
  delivery_availability: {
    timezone: "Africa/Cairo",
    state: "unavailable",
    ordering_mode: "unavailable",
    operating_hours: { starts_at: null, ends_at: null },
    schedule_constraints: null,
    slots: [],
  },
});

/**
 * True when the store is closed but still taking pre-orders for a future slot.
 *
 * The `accepting_orders` guard is required, not decorative: a store can report
 * `ordering_mode: "scheduled"` while being blocked for an unrelated reason
 * (`setup_incomplete`, `insufficient_products`). Guarding here keeps this state
 * mutually exclusive with the "الطلبات متوقفة حالياً" banner.
 */
export const isScheduledOnlyOrdering = (
  availability: StorefrontOrderAvailability,
) =>
  availability.accepting_orders &&
  availability.delivery_availability.ordering_mode === "scheduled";
