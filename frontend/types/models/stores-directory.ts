export type StoresDirectoryArea = {
  id: number;
  nameAr: string;
  nameEn: string | null;
  slug: string;
  city: string | null;
  governorate: string | null;
  storesCount: number;
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
  deliveryAvailable: boolean;
  deliveryFee: number;
  deliveryAvailableNow: boolean;
  activeProductsCount: number;
  storefrontUrl: string;
  whatsappUrl: string | null;
};

export type StoresDirectorySeo = {
  title: string;
  description: string;
};

export type StoresDirectoryLanding = {
  areas: StoresDirectoryArea[];
  categories: StoresDirectoryCategory[];
  featuredStores: StoresDirectoryStoreCard[];
  seo: StoresDirectorySeo;
};
