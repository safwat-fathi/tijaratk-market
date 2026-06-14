import type { TenantCategory } from "@/constants";

export interface Tenant {
  id: number;
  name: string;
  phone: string;
  slug: string;
  category: TenantCategory;
  status?: "active" | "inactive" | "suspended";
  delivery_fee?: number | string;
  delivery_available?: boolean;
  delivery_starts_at?: string | null;
  delivery_ends_at?: string | null;
  directory_profile?: TenantDirectoryProfile | null;
  tenant_delivery_areas?: TenantDeliveryArea[];
}

export interface DirectoryArea {
  id: number;
  name_ar: string;
  name_en: string | null;
  slug: string;
  city: string | null;
  governorate: string | null;
  is_active: boolean;
  sort_order: number;
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
}

export interface TenantDeliveryArea {
  id?: number;
  tenant_id?: number;
  area_id: number;
  is_active?: boolean;
}

export type TenantDeliverySettings = Pick<
  Tenant,
  "delivery_fee" | "delivery_available" | "delivery_starts_at" | "delivery_ends_at"
>;
