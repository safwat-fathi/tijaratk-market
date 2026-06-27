export type ProductSource = 'manual' | 'catalog' | 'order_note';
export type ProductStatus = 'active' | 'archived';
export type ProductOrderMode = 'quantity' | 'weight' | 'price';

export interface QuantityUnitOption {
  id: string;
  label: string;
  multiplier: number;
}

export interface ProductOrderConfig {
  quantity?: {
    unit_label?: string;
    unit_options?: QuantityUnitOption[];
  };
  weight?: {
    preset_grams: number[];
    allow_custom_grams: boolean;
  };
  price?: {
    preset_amounts_egp: number[];
    allow_custom_amount: boolean;
  };
}

export interface Product {
  id: number;
  name: string;
  image_url?: string | null;
  current_price?: number | string | null;
  category?: string | null;
  is_available: boolean;
  order_mode: ProductOrderMode;
  order_config?: ProductOrderConfig | null;
  source: ProductSource;
  status: ProductStatus;
  price_needs_review?: boolean;
  tenant_id?: number;
}

export interface CatalogItem {
  id: number;
  name: string;
  image_url?: string | null;
  price?: number | string | null;
  currency?: string;
  category: string;
  is_active: boolean;
  is_essential?: boolean;
  essential_sort_order?: number | null;
  is_in_stock?: boolean;
  created_at: string;
}

export interface CatalogItemsResponse {
  data: CatalogItem[];
  meta: PublicProductsMeta;
}

export interface BulkEssentialStage {
  category: string;
  total: number;
  default_selected_catalog_item_ids: number[];
  items: CatalogItem[];
}

export interface PublicProductsMeta {
  total: number;
  page: number;
  limit: number;
  last_page: number;
  has_next: boolean;
}

export interface PublicProductsResponse {
  data: Product[];
  meta: PublicProductsMeta;
}

export interface TenantProductsSearchResponse {
  data: Product[];
  meta: PublicProductsMeta;
}

export interface PublicProductCategory {
  category: string;
  count: number;
  image_url?: string;
}
