import type { Order } from "@/types/models/order";
import type { Product } from "@/types/models/product";
import type { DeliveryFeeMode, DirectoryArea } from "@/types/models/tenant";
import type { OrderSource, UnavailableItemAction } from "@/types/enums";

export type StorefrontCartSelection = {
  product_id: number;
  selection_mode: "quantity" | "weight" | "price";
  selection_quantity?: number;
  selection_grams?: number;
  selection_amount_egp?: number;
  unit_option_id?: string;
  item_note?: string;
};

export type StorefrontCartDraftItem = StorefrontCartSelection & {
  product: Product;
};

export type StorefrontCartDraft = {
  items: StorefrontCartDraftItem[];
  invalid_product_ids: number[];
  free_text_payload: string;
  unavailable_item_action: UnavailableItemAction;
  order_source: OrderSource;
  source_metadata?: Record<string, unknown> | null;
  delivery_area_id: number | null;
  delivery_area: DirectoryArea | null;
  /** null when no area is chosen yet, and also when the chosen zone is `on_order`. */
  delivery_fee: number | null;
  /** null until an area is chosen. */
  delivery_fee_mode?: DeliveryFeeMode | null;
  delivery_fee_min?: number | null;
  delivery_fee_max?: number | null;
  subtotal: number;
  /** Covers items only when the chosen zone is priced after the order. */
  estimated_total: number | null;
  has_prescription: boolean;
  prescription_original_filename?: string | null;
  prescription_unavailability_action?: string | null;
  expires_at: string;
  completed: boolean;
};

export type StorefrontCartDraftResponse = StorefrontCartDraft & {
  token: string;
};

export type SaveStorefrontCartDraftInput = {
  items: StorefrontCartSelection[];
  free_text_payload?: string;
  delivery_area_id?: number;
  unavailable_item_action?: UnavailableItemAction;
  order_source?: OrderSource;
  source_metadata?: Record<string, unknown>;
  prescription_unavailability_action?: string;
};

export type CheckoutStorefrontCartDraftInput = {
  customer: { name: string; phone: string; address: string };
  notes?: string;
  delivery_slot?: { date: string; starts_at: string; ends_at: string };
  card_on_delivery_requested?: boolean;
  delivery_address?: string;
  ga_client_id?: string;
  ga_session_id?: string;
};

export type StorefrontCheckoutOrder = Order & {
  customer_access_code?: string;
  meta_purchase?: { event_id: string; value: number; currency: "EGP" };
};
