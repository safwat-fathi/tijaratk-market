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
const CHEFAA_CATALOG_CATEGORY_HINT_SET = new Set<string>([
  ...PHARMACY_CATALOG_CATEGORIES,
  'الأدوية',
  'العناية بالشعر',
  'العناية بالبشرة',
  'العناية اليومية',
  'الأم والطفل',
  'المكياج و الاكسسوارات',
  'المستلزمات الطبية',
  'الفيتامينات والمكملات',
  'الصحة الجنسية',
]);

const CATALOG_SOURCE_BY_IMPORT_FORMAT: Record<
  CatalogImportSourceFormat,
  CatalogSource
> = {
  [CATALOG_IMPORT_FORMAT_TALABAT]: CATALOG_SOURCE_TALABAT,
  [CATALOG_IMPORT_FORMAT_CHEFAA]: CATALOG_SOURCE_CHEFAA,
  [CATALOG_IMPORT_FORMAT_CARREFOUR]: CATALOG_SOURCE_TALABAT,
};

const RAW_CATALOG_CATEGORY_MAP: Record<string, string> = {
  Bakery: 'مخبوزات',
  Dairy: 'ألبان و بيض',
  Eggs: 'ألبان و بيض',
  'Rice, Pasta & Pulses': 'أرز ومكرونة',
  'Oil & Ghee': 'زيت وسمن',
  'Cooking Ingredients': 'أخرى',
  'Herbs & Spices': 'توابل',
  Sauces: 'صلصات و خل',
  Beverages: 'مشروبات',
  'Meat & Poultry': 'لحوم و دواجن',
  Frozen: 'مجمدات',
  'Snacks & Confectionery': 'سناكس و حلويات',
  'Honey, Jam & Spreads': 'عسل ومربى وشوكولاتة',
  Cleaning: 'منظفات ومنتجات ورقية',
  'Personal Care': 'عناية شخصية',
  'Biscuits, Crackers & Cakes': 'سناكس و حلويات',
  'Chocolate & Confectionery': 'سناكس و حلويات',
  'Chips & Snacks': 'سناكس و حلويات',
  'Chips, Dips & Snacks': 'شيبس ومقبلات',
  'Jam, Honey & Spreads': 'عسل ومربى وشوكولاتة',
  'Jams, Honey & Spreads': 'عسل ومربى وشوكولاتة',
  'Sugar & Home Baking': 'سكر و دقيق',
  'Spices, Sauces & Vinegar': 'صلصات و خل',
  'Condiments, Dressings & Marinades': 'صلصات و خل',
  'Breakfast Food': 'مخبوزات',
  'Breakfast Cereals & Bars': 'مخبوزات',
  'Nuts, Dates & Dried Fruits': 'سناكس و حلويات',
  'Household Cleaning': 'منظفات ومنتجات ورقية',
  'Fruit & Veg': 'أخرى',
  Vegetables: 'أخرى',
  Fruits: 'أخرى',
  Herbs: 'توابل',
  الأدوية: 'أدوية',
  'العناية بالشعر': 'عناية شخصية',
  'العناية بالبشرة': 'عناية شخصية',
  'العناية اليومية': 'عناية شخصية',
  'الأم والطفل': 'عناية شخصية',
  'المكياج و الاكسسوارات': 'عناية شخصية',
  'المستلزمات الطبية': 'أدوية',
  'الفيتامينات والمكملات': 'أدوية',
  'الصحة الجنسية': 'عناية شخصية',
  'ألبان وبيض': 'ألبان و بيض',
  'قهوة وشاي': 'مشروبات',
  'صلصات وتوابل': 'صلصات و خل',
  'سناكس وشوكولاتة': 'سناكس و حلويات',
  'طبخ ومخبوزات': 'مخبوزات',
  'تنظيف وغسيل': 'منظفات ومنتجات ورقية',
  'ورقيات وبلاستيك': 'منظفات ومنتجات ورقية',
  'معلبات وبرطمانات': 'أخرى',
  'مكونات الطبخ': 'أخرى',
  خضروات: 'أخرى',
  الفاكهة: 'أخرى',
  أعشاب: 'توابل',
  'بسكويت، كراكرز وكيك': 'سناكس و حلويات',
  'الشوكولاته والمعجنات': 'سناكس و حلويات',
  'شيبس ومقبلات': 'شيبس ومقبلات',
  'أرز , مكرونة والبقوليات': 'أرز ومكرونة',
  'مربي، عسل وغيرها': 'عسل ومربى وشوكولاتة',
  'السكر و مستلزمات الخبز': 'سكر و دقيق',
  'توابل، صلصات و خل': 'صلصات و خل',
  'منتجات الفطور الغذائية': 'مخبوزات',
  'المكسرات والتمور والفواكه المجففة': 'سناكس و حلويات',
  'أدوات التنظيف المنزلية': 'منظفات ومنتجات ورقية',
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

/**
 * Returns whether a raw CSV category value is a known Chefaa category hint.
 */
export function isCatalogCategoryHintForChefaa(category: string): boolean {
  const categoryHint = category.trim();
  if (!categoryHint) return false;

  return CHEFAA_CATALOG_CATEGORY_HINT_SET.has(categoryHint);
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

export function normalizeCatalogCategory(
  category?: string | null,
): string | null {
  const parentCategory = category?.split('>')[0]?.trim();
  if (!parentCategory) return null;

  return RAW_CATALOG_CATEGORY_MAP[parentCategory] ?? parentCategory;
}

export function normalizeCatalogCategoryForSource(
  source: string,
  category?: string | null,
): string | null {
  const normalizedCategory = normalizeCatalogCategory(category);
  if (!normalizedCategory) return null;

  return isCatalogCategoryAllowedForSource(source, normalizedCategory)
    ? normalizedCategory
    : null;
}
