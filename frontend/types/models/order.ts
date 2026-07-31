import {
  OrderStatus,
  OrderType,
  PricingMode,
  ReplacementDecisionStatus,
  UnavailableItemAction,
} from '../enums';

export interface OrderCustomer {
  name?: string;
  phone?: string;
  address?: string;
  [key: string]: unknown;
}

export type OrderItemSelectionMode = "quantity" | "weight" | "price" | null;
export type OrderNumericValue = number | string | null;

export interface OrderItem {
  id: number;
  order_id: number;
  product_id?: number | null;
  name_snapshot: string;
  quantity: string;
  unit_price?: OrderNumericValue;
  total_price?: OrderNumericValue;
  is_out_of_stock?: boolean;
  out_of_stock_at?: string | null;
  notes?: string;
  selection_mode?: OrderItemSelectionMode;
  selection_quantity?: OrderNumericValue;
  selection_grams?: number | null;
  selection_amount_egp?: OrderNumericValue;
  unit_option_id?: string | null;
  replaced_by_product_id?: number | null;
  replaced_by_product?: {
    id: number;
    name: string;
    image_url?: string | null;
  } | null;
  pending_replacement_product_id?: number | null;
  pending_replacement_product?: {
    id: number;
    name: string;
    image_url?: string | null;
  } | null;
  replacement_decision_status?: ReplacementDecisionStatus;
  replacement_decision_reason?: string | null;
  replacement_decided_at?: string | null;
}

export interface Order {
  id: number;
  tenant_id: number;
  tenant?: {
    name: string;
    id: number;
    slug?: string;
  };
  customer_id: number;
  customer?: OrderCustomer;
  items: OrderItem[];
  public_token: string;
  order_type: OrderType;
  status: OrderStatus;
  pricing_mode: PricingMode;
  subtotal?: OrderNumericValue;
  delivery_fee?: OrderNumericValue;
  delivery_area_id?: number | null;
  delivery_area?: {
    id: number;
    name_ar: string;
    name_en?: string | null;
    slug: string;
  } | null;
  delivery_time_window_snapshot?: string | null;
  scheduled_delivery_date?: string | null;
  scheduled_delivery_starts_at?: string | null;
  scheduled_delivery_ends_at?: string | null;
  total?: OrderNumericValue;
  free_text_payload?: { text?: string };
  prescription_file_url?: string | null;
  prescription_original_filename?: string | null;
  prescription_mime_type?: string | null;
  prescription_unavailability_action?: string | null;
  unavailable_item_action?: UnavailableItemAction | null;
  notes?: string;
  card_on_delivery_requested?: boolean;
  merchant_cancellation_reason?: string | null;
  merchant_cancelled_at?: string | null;
  customer_rejection_reason?: string | null;
  customer_rejected_at?: string | null;
  customer_access_code?: string;
  fulfilled_by?: { name: string } | null;
  created_at: string;
  updated_at: string;
}
