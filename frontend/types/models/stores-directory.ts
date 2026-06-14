export type StoresDirectoryArea = {
  id: number;
  nameAr: string;
  nameEn: string | null;
  slug: string;
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
  category: Omit<StoresDirectoryCategory, "storesCount">;
  stores: StoresDirectoryStoreCard[];
  pagination: StoresDirectoryPagination;
  seo: StoresDirectorySeo;
};
