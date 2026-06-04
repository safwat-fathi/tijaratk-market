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
}

export type TenantDeliverySettings = Pick<
  Tenant,
  "delivery_fee" | "delivery_available" | "delivery_starts_at" | "delivery_ends_at"
>;
