import { Order } from '../models/order';
import { OrderType } from '../enums';

export interface CreateOrderRequest {
  customer: {
    name?: string;
    phone: string;
    address?: string;
  };
  items?: Array<{
    product_id?: number;
    name?: string;
    quantity: string;
    notes?: string;
    unit_price?: number;
    total_price?: number;
    selection_mode?: 'quantity' | 'weight' | 'price';
    selection_quantity?: number;
    selection_grams?: number;
    selection_amount_egp?: number;
    unit_option_id?: string;
  }>;
  notes?: string;
  free_text_payload?: { text: string };
  order_type: OrderType;
  delivery_area_id?: number;
  delivery_area_slug?: string;
  prescription_unavailability_action?: string;
}

export interface OrderListResponse {
  data: Order[];
  total: number;
  page: number;
  last_page: number;
}

export interface DayCloseSummary {
  orders_count: number;
  cancelled_count: number;
  completed_sales_total: number;
}

export interface DayClosePayload extends DayCloseSummary {
  id: number;
  closure_date: string;
  closed_at: string;
}

export interface DayCloseTodayStatusResponse {
  is_closed: boolean;
  closure: DayClosePayload | null;
  preview: DayCloseSummary;
}

export interface CloseDayResponse {
  is_already_closed: boolean;
  closure: DayClosePayload;
  whatsapp_sent: boolean;
}
