import type { Product, PublicProductCategory, PublicProductsResponse } from "@/types/models/product";
import type { OrderItem } from "@/types/models/order";

export type ZoneStorefront = {
  id: number;
  name: string;
  slug: string;
  category: "grocery" | "pharmacy";
  delivery_fee?: number | string;
  delivery_available?: boolean;
  delivery_starts_at?: string | null;
  delivery_ends_at?: string | null;
  card_on_delivery_available?: boolean;
  area: {
    id: number;
    name_ar: string;
    name_en?: string | null;
    slug: string;
  };
};

export type ZoneReadiness = {
  catalog_ready: boolean;
  active_products: number;
  required_products?: number;
  active_eligible_merchants: number;
  catalog_source?: "talabat_csv" | "chefaa_csv";
};

export type ZoneEssentialCatalogSyncResult = {
  created: number;
  linked: number;
  updated: number;
  archived: number;
  active_products: number;
  active_categories: number;
};

export type AdminZoneMerchantMembership = {
  id: number;
  tenant_id: number;
  priority: number;
  is_active: boolean;
  tenant: {
    id: number;
    name: string;
    slug?: string;
    status: string;
    category?: string;
  };
};

export type AdminZoneStorefront = {
  id: number;
  name: string;
  slug: string;
  operations_phone: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  area: ZoneStorefront["area"];
  operator_tenant: {
    id: number;
    name: string;
    category: "grocery" | "pharmacy";
    status: string;
    delivery_fee?: number | string;
  };
  merchants: AdminZoneMerchantMembership[];
  readiness: ZoneReadiness;
};

export type EligibleZoneMerchant = {
  id: number;
  name: string;
  slug: string;
  category: string;
  membership: {
    id: number;
    is_active: boolean;
    priority: number;
  } | null;
};

export type DispatchAssignment = {
  id: number;
  status: "pending" | "accepted" | "rejected" | "revoked" | "cancelled";
  is_current: boolean;
  version: number;
  reason?: string | null;
  internal_notes?: string | null;
  assigned_at: string;
  responded_at?: string | null;
  target_tenant?: { id: number; name: string };
  quote_lines: Array<{
    id: number;
    order_item_id: number;
    unit_price: number | string;
    total_price: number | string;
  }>;
};

export type ZoneOrderDispatch = {
  id: number;
  status: "pending" | "awaiting_merchant" | "accepted" | "cancelled";
  version: number;
  cancellation_reason?: string | null;
  created_at: string;
  updated_at?: string;
  zone_storefront?: { name: string; slug: string };
  order: {
    id: number;
    public_token?: string;
    status: string;
    customer_name?: string | null;
    customer_phone?: string | null;
    delivery_address?: string | null;
    delivery_time_window_snapshot?: string | null;
    subtotal?: number | string | null;
    delivery_fee?: number | string | null;
    total?: number | string | null;
    notes?: string | null;
    order_items?: OrderItem[];
  };
  assignments: DispatchAssignment[];
};

export type ManagedZoneDispatchContext = {
  zone: {
    id: number;
    name: string;
    slug: string;
    is_active: boolean;
    area: ZoneStorefront["area"];
    operator_tenant: { id: number; name: string };
  };
  eligible_merchants: EligibleZoneMerchant[];
};

export type AssignedOrderReplacementProduct = {
  id: number;
  name: string;
  image_url?: string | null;
  category: string;
  current_price?: number | string | null;
};

export type ZonePublicProductsResponse = PublicProductsResponse;
export type ZonePublicProduct = Product;
export type ZonePublicCategory = PublicProductCategory;
