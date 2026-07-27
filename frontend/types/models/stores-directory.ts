export type StoresDirectoryArea = {
  id: number;
  nameAr: string;
  nameEn: string | null;
  slug: string;
  parentAreaId?: number | null;
  city: string | null;
  governorate: string | null;
  storesCount: number;
  categoryCounts: Record<string, number>;
};

export type StoresDirectoryCategory = {
  slug: "supermarkets" | "pharmacies" | string;
  label: string;
  tenantCategory: "grocery" | "pharmacy" | string;
  storesCount: number;
};

export type StoresDirectorySearchArea = {
  id: number;
  nameAr: string;
  nameEn: string | null;
  slug: string;
  destinationSlug: string;
  parentNameAr?: string;
  storesCount: number;
  categoryCounts: Record<string, number>;
};

export type StoresDirectoryDeliveryArea = {
  id: number;
  nameAr: string;
  nameEn: string | null;
  slug: string;
  parentAreaId: number;
  city: string | null;
  governorate: string | null;
};

export type StoresDirectoryStoreCard = {
  id: number;
  name: string;
  slug: string;
  category: string;
  logoUrl: string | null;
  address: string | null;
  areaName: string | null;
  areaSlug: string | null;
  deliveryAvailable: boolean;
  deliveryFee: number;
  deliveryAvailableNow: boolean;
  readinessLevel: "complete" | "partial" | "poor";
  badges: Array<
    "open_now" | "new_store" | "complete_profile" | "delivery_available"
  >;
  productsCategoriesCount?: number;
  storefrontUrl: string;
  whatsappUrl: string | null;
};

export type StoresDirectorySeo = {
  title: string;
  description: string;
  canonicalUrl?: string;
};

export type StoresDirectoryLanding = {
  areas: StoresDirectoryArea[];
  searchAreas?: StoresDirectorySearchArea[];
  categories: StoresDirectoryCategory[];
  featuredStores: StoresDirectoryStoreCard[];
  seo: StoresDirectorySeo;
};

export type StoresDirectoryPagination = {
  page: number;
  limit: number;
  total: number;
  lastPage: number;
};

export type StoresDirectoryCategoryPage = {
  area: StoresDirectoryArea;
  deliveryAreas: Array<StoresDirectoryDeliveryArea & { storesCount: number }>;
  selectedDeliveryArea: StoresDirectoryDeliveryArea | null;
  category: Omit<StoresDirectoryCategory, "storesCount">;
  stores: StoresDirectoryStoreCard[];
  pagination: StoresDirectoryPagination;
  seo: StoresDirectorySeo;
};
