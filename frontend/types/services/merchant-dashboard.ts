export type DashboardPeriod = "today" | "7d" | "30d";

export type DashboardMetricWithDelta = {
  value: number;
  previous_value: number;
  change_percentage: number | null;
};

export type DashboardRateMetric = {
  percentage: number;
  completed_orders?: number;
  cancelled_orders?: number;
  total_orders: number;
};

export type ReturningCustomersRateMetric = {
  percentage: number;
  returning_customers: number;
  active_customers: number;
};

export type TopSellingProductMetric = {
  name: string;
  orders_count: number;
};

export type OrdersBySourceMetric = {
  source: "qr_code" | "stores_directory" | "whatsapp" | "manual" | "storefront";
  label: string;
  orders_count: number;
  percentage: number;
};

export type MerchantDashboardMeasurements = {
  period: DashboardPeriod;
  period_start: string;
  period_end: string;
  total_orders: DashboardMetricWithDelta;
  completed_orders_rate: DashboardRateMetric;
  cancelled_orders_rate: DashboardRateMetric;
  total_sales: DashboardMetricWithDelta;
  average_order_value: number;
  new_customers: number;
  returning_customers_rate: ReturningCustomersRateMetric;
  top_selling_products: TopSellingProductMetric[];
  availability_requests: number;
  orders_by_source: OrdersBySourceMetric[];
};
