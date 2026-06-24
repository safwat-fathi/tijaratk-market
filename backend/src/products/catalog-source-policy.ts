import { TenantCategory } from '../../generated/prisma/client';

export const CATALOG_SOURCE_TALABAT = 'talabat_csv';
export const CATALOG_SOURCE_CHEFAA = 'chefaa_csv';

export type CatalogSource =
  | typeof CATALOG_SOURCE_TALABAT
  | typeof CATALOG_SOURCE_CHEFAA;

export const CATALOG_IMPORT_FORMAT_TALABAT = 'talabat';
export const CATALOG_IMPORT_FORMAT_CHEFAA = 'chefaa';
export const CATALOG_IMPORT_FORMAT_CARREFOUR = 'carrefour';

export type CatalogImportSourceFormat =
  | typeof CATALOG_IMPORT_FORMAT_TALABAT
  | typeof CATALOG_IMPORT_FORMAT_CHEFAA
  | typeof CATALOG_IMPORT_FORMAT_CARREFOUR;

export const GROCERY_CATALOG_CATEGORIES = [
  'ألبان و بيض',
  'مخبوزات',
  'زيت وسمن',
  'أرز ومكرونة',
  'بقوليات',
  'سكر و دقيق',
  'توابل',
  'صلصات و خل',
  'مشروبات',
  'لحوم و دواجن',
  'مجمدات',
  'سناكس و حلويات',
  'شيبس ومقبلات',
  'عسل ومربى وشوكولاتة',
  'منظفات ومنتجات ورقية',
  'عناية شخصية',
  'أخرى',
] as const;

export const PHARMACY_CATALOG_CATEGORIES = [
  'أدوية',
  'عناية شخصية',
] as const;

const GROCERY_CATALOG_CATEGORY_SET = new Set<string>(
  GROCERY_CATALOG_CATEGORIES,
);
const PHARMACY_CATALOG_CATEGORY_SET = new Set<string>(
  PHARMACY_CATALOG_CATEGORIES,
);

const CATALOG_SOURCE_BY_IMPORT_FORMAT: Record<
  CatalogImportSourceFormat,
  CatalogSource
> = {
  [CATALOG_IMPORT_FORMAT_TALABAT]: CATALOG_SOURCE_TALABAT,
  [CATALOG_IMPORT_FORMAT_CHEFAA]: CATALOG_SOURCE_CHEFAA,
  [CATALOG_IMPORT_FORMAT_CARREFOUR]: CATALOG_SOURCE_TALABAT,
};

export function resolveCatalogSourceForTenantCategory(
  category?: TenantCategory | null,
): CatalogSource | null {
  if (category === TenantCategory.grocery) return CATALOG_SOURCE_TALABAT;
  if (category === TenantCategory.pharmacy) return CATALOG_SOURCE_CHEFAA;
  return null;
}

export function isCatalogCategoryAllowedForSource(
  source: string,
  category: string,
): boolean {
  const normalizedCategory = category.trim();
  if (!normalizedCategory) return false;

  if (source === CATALOG_SOURCE_CHEFAA) {
    return PHARMACY_CATALOG_CATEGORY_SET.has(normalizedCategory);
  }

  if (source === CATALOG_SOURCE_TALABAT) {
    return GROCERY_CATALOG_CATEGORY_SET.has(normalizedCategory);
  }

  return false;
}

export function buildAllowedCatalogCategoryWhere(source: string) {
  if (source === CATALOG_SOURCE_CHEFAA) {
    return { in: [...PHARMACY_CATALOG_CATEGORIES] };
  }

  if (source === CATALOG_SOURCE_TALABAT) {
    return { in: [...GROCERY_CATALOG_CATEGORIES] };
  }

  return { in: [] };
}

export function getAllowedCatalogCategoriesForSource(source: string): string[] {
  if (source === CATALOG_SOURCE_CHEFAA) {
    return [...PHARMACY_CATALOG_CATEGORIES];
  }

  if (source === CATALOG_SOURCE_TALABAT) {
    return [...GROCERY_CATALOG_CATEGORIES];
  }

  return [];
}

export function resolveCatalogSourceForImportFormat(
  format: CatalogImportSourceFormat,
): CatalogSource {
  return CATALOG_SOURCE_BY_IMPORT_FORMAT[format];
}
