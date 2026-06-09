export type CreateAvailabilityRequestPayload = {
  product_id?: number;
  requested_product_name?: string;
  customer_name?: string;
  customer_phone?: string;
  customer_address?: string;
  customer_notes?: string;
  visitor_key: string;
};

export type CreateAvailabilityRequestResponse = {
  status: 'created' | 'already_requested_today';
  requested_at: string;
  product_id: number | null;
  requested_product_name: string | null;
};

export type MerchantAvailabilityTopProduct = {
  item_key: string;
  product_id: number | null;
  product_name: string;
  requests_count: number;
  last_requested_at: string;
};

export type MerchantAvailabilitySummaryResponse = {
  today_total_requests: number;
  top_products: MerchantAvailabilityTopProduct[];
};

export type MerchantAvailabilityRequestItem = {
  id: number;
  item_name: string;
  product_id: number | null;
  requested_product_name: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  customer_notes: string | null;
  requested_at: string;
  request_date: string;
  visitor_key: string;
};

export type MerchantAvailabilityRequestsMeta = {
  total: number;
  page: number;
  last_page: number;
  limit: number;
};

export type MerchantAvailabilityRequestsResponse = {
  data: MerchantAvailabilityRequestItem[];
  meta: MerchantAvailabilityRequestsMeta;
};

export type MerchantAvailabilityRequestsParams = {
  page?: number;
  limit?: number;
  date?: string;
  item_name?: string;
  sort_by?: 'date' | 'name';
  sort_order?: 'asc' | 'desc';
};
