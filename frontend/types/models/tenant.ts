import type { TenantCategory } from "@/constants";

export interface Tenant {
  id: number;
  name: string;
  phone: string;
  slug: string;
  category: TenantCategory;
  status?: "pending" | "active" | "inactive" | "suspended" | "rejected";
  delivery_available?: boolean;
  delivery_starts_at?: string | null;
  delivery_ends_at?: string | null;
  instapay_account_name?: string | null;
  instapay_account_number?: string | null;
  ewallet_account_name?: string | null;
  ewallet_account_number?: string | null;
  card_on_delivery_available?: boolean;
  directory_profile?: TenantDirectoryProfile | null;
  tenant_delivery_areas?: TenantDeliveryArea[];
  onboarding_completed?: boolean;
  onboarding_step?: number;
}


export interface DirectoryArea {
  id: number;
  name_ar: string;
  name_en: string | null;
  slug: string;
  parent_area_id: number | null;
  city: string | null;
  governorate: string | null;
  is_active: boolean;
  sort_order: number;
  parent_area?: Pick<
    DirectoryArea,
    "id" | "name_ar" | "name_en" | "slug"
  > | null;
}

export interface TenantDirectoryProfile {
  id: number;
  tenant_id: number;
  area_id: number | null;
  directory_status: "draft" | "listed" | "hidden" | "suspended";
  display_name: string | null;
  logo_url: string | null;
  cover_url: string | null;
  address: string | null;
  latitude: string | number | null;
  longitude: string | number | null;
  seo_title: string | null;
  seo_description: string | null;
  profile_completion_score: number;
  area?: DirectoryArea | null;
  delivery_area_ids?: number[];
  delivery_areas?: TenantDeliveryArea[];
  tenant?: {
    tenant_delivery_areas?: TenantDeliveryArea[];
  };
}

export interface TenantDeliveryArea {
  id?: number;
  tenant_id?: number;
  area_id: number;
  delivery_fee: number | string;
  is_active?: boolean;
  area?: DirectoryArea;
}

export type MissingDeliveryAreaRequest = {
  id: number;
  main_area_id: number;
  requested_area_name: string;
  note: string | null;
  status: "pending" | "resolved";
  created_at: string;
  resolved_at: string | null;
  main_area: Pick<DirectoryArea, "id" | "name_ar" | "name_en" | "slug">;
  resolved_area: Pick<DirectoryArea, "id" | "name_ar" | "name_en" | "slug"> | null;
};

export type DeliveryAreaFeeInput = {
  area_id: number;
  delivery_fee: number;
};

export type DeliveryConfigurationInput = {
  delivery_available: boolean;
  delivery_starts_at?: string | null;
  delivery_ends_at?: string | null;
  main_area_ids: number[];
  delivery_areas: DeliveryAreaFeeInput[];
};

export type TenantDeliverySettings = Pick<
  Tenant,
  | "delivery_available"
  | "delivery_starts_at"
  | "delivery_ends_at"
  | "instapay_account_name"
  | "instapay_account_number"
  | "ewallet_account_name"
  | "ewallet_account_number"
  | "card_on_delivery_available"
  | "tenant_delivery_areas"
  | "directory_profile"
>;
