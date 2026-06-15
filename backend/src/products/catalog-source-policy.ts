import { TenantCategory } from '../../generated/prisma/client';

export const CATALOG_SOURCE_TALABAT = 'talabat_csv';
export const CATALOG_SOURCE_CHEFAA = 'chefaa_csv';

export type CatalogSource =
  | typeof CATALOG_SOURCE_TALABAT
  | typeof CATALOG_SOURCE_CHEFAA;

const PHARMACY_CATALOG_CATEGORIES = new Set(['أدوية', 'عناية شخصية']);

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
    return PHARMACY_CATALOG_CATEGORIES.has(normalizedCategory);
  }

  return true;
}

export function buildAllowedCatalogCategoryWhere(source: string) {
  if (source === CATALOG_SOURCE_CHEFAA) {
    return { in: Array.from(PHARMACY_CATALOG_CATEGORIES) };
  }

  return undefined;
}

export function getAllowedCatalogCategoriesForSource(source: string): string[] {
  if (source === CATALOG_SOURCE_CHEFAA) {
    return Array.from(PHARMACY_CATALOG_CATEGORIES);
  }

  return [];
}
