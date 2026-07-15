import { TenantCategory } from '../../generated/prisma/client';

export const CATALOG_SOURCE_TALABAT = 'talabat_csv';
export const CATALOG_SOURCE_CHEFAA = 'chefaa_csv';

export type CatalogSource =
  | typeof CATALOG_SOURCE_TALABAT
  | typeof CATALOG_SOURCE_CHEFAA;

export const TENANT_CATEGORIES_WITH_CATALOG_SOURCE = [
  TenantCategory.grocery,
  TenantCategory.pharmacy,
] as const;

export const ADMIN_CATALOG_TYPE_GROCERY = 'grocery';
export const ADMIN_CATALOG_TYPE_PHARMACY = 'pharmacy';

export type AdminCatalogType =
  | typeof ADMIN_CATALOG_TYPE_GROCERY
  | typeof ADMIN_CATALOG_TYPE_PHARMACY;

export const ADMIN_CATALOG_TYPES = [
  ADMIN_CATALOG_TYPE_GROCERY,
  ADMIN_CATALOG_TYPE_PHARMACY,
] as const;

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

type CatalogImageRemoteRule = {
  hostname: string;
  pathnamePrefix?: string;
};

const SHARED_CATALOG_IMAGE_HOSTS = new Set(['tijaratk.com']);
const LOCAL_CATALOG_IMAGE_HOSTS = new Set(['localhost', '127.0.0.1']);
const MANAGED_CATALOG_IMAGE_PATH_PREFIX = '/uploads/products/';

const CATALOG_IMAGE_REMOTE_RULES_BY_SOURCE: Record<
  CatalogSource,
  CatalogImageRemoteRule[]
> = {
  [CATALOG_SOURCE_TALABAT]: [
    { hostname: 'cdn.mafrservices.com' },
    { hostname: 'talabat.dhmedia.io', pathnamePrefix: '/image/' },
    { hostname: 'images.deliveryhero.io', pathnamePrefix: '/image/' },
  ],
  [CATALOG_SOURCE_CHEFAA]: [{ hostname: 'cdn.chefaa.com' }],
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
  'منتجات الالبان': 'ألبان و بيض',
  'لبن سايب': 'ألبان و بيض',
  'قهوة وشاي': 'مشروبات',
  عص: 'مشروبات',
  عصائر: 'مشروبات',
  'مشروبات باردة': 'مشروبات',
  'مشروبات ساخنة': 'مشروبات',
  'صلصات وتوابل': 'صلصات و خل',
  'صلصات و منكهات': 'صلصات و خل',
  'صلصات ومنكهات': 'صلصات و خل',
  'سناكس وشوكولاتة': 'سناكس و حلويات',
  'سناكس وحلويات': 'سناكس و حلويات',
  'طبخ ومخبوزات': 'مخبوزات',
  'فطار وحبوب': 'مخبوزات',
  'تنظيف وغسيل': 'منظفات ومنتجات ورقية',
  'ورقيات وبلاستيك': 'منظفات ومنتجات ورقية',
  'معلبات وبرطمانات': 'أخرى',
  'مكونات الطبخ': 'أخرى',
  'مواد غذائية': 'أخرى',
  معلبات: 'أخرى',
  خضروات: 'أخرى',
  الفاكهة: 'أخرى',
  أعشاب: 'توابل',
  'بسكويت، كراكرز وكيك': 'سناكس و حلويات',
  'الشوكولاته والمعجنات': 'سناكس و حلويات',
  'شيبس ومقبلات': 'شيبس ومقبلات',
  'شيبسي ومقبلات': 'شيبس ومقبلات',
  'أرز , مكرونة والبقوليات': 'أرز ومكرونة',
  'أرز ومكرونة وحبوب': 'أرز ومكرونة',
  'ارز ومكرونة وحبوب': 'أرز ومكرونة',
  'ارز ومكرونة': 'أرز ومكرونة',
  'مربي، عسل وغيرها': 'عسل ومربى وشوكولاتة',
  'مربى وعسل وطحينة': 'عسل ومربى وشوكولاتة',
  'السكر و مستلزمات الخبز': 'سكر و دقيق',
  'سكر ودقيق': 'سكر و دقيق',
  'مستلزمات الحلويات والخبز': 'سكر و دقيق',
  'زيوت وسمن': 'زيت وسمن',
  'بهارات ومرق': 'توابل',
  تمر: 'سناكس و حلويات',
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

export function resolveCatalogSourceForAdminCatalogType(
  catalogType: AdminCatalogType,
): CatalogSource {
  return catalogType === ADMIN_CATALOG_TYPE_PHARMACY
    ? CATALOG_SOURCE_CHEFAA
    : CATALOG_SOURCE_TALABAT;
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

const parseConfiguredCatalogImageHost = (
  appUrl?: string | null,
): string | null => {
  const normalizedAppUrl = appUrl?.trim();
  if (!normalizedAppUrl) return null;

  try {
    const parsed = new URL(normalizedAppUrl);
    if (parsed.protocol === 'https:') return parsed.hostname;
    if (
      parsed.protocol === 'http:' &&
      LOCAL_CATALOG_IMAGE_HOSTS.has(parsed.hostname)
    ) {
      return parsed.hostname;
    }

    return null;
  } catch {
    return null;
  }
};

const isManagedCatalogImagePath = (imageReference: string): boolean => {
  if (!imageReference.startsWith('/') || imageReference.startsWith('//')) {
    return false;
  }

  try {
    const parsed = new URL(imageReference, 'https://catalog.local');
    return parsed.pathname.startsWith(MANAGED_CATALOG_IMAGE_PATH_PREFIX);
  } catch {
    return false;
  }
};

/**
 * Returns whether an image reference is valid for the catalog source. Provider
 * hosts remain source-specific so pharmacy and grocery catalogs cannot mix
 * external asset sources.
 */
export function isCatalogImageReferenceAllowedForSource(
  source: string,
  imageReference?: string | null,
  appUrl = process.env.APP_URL,
): boolean {
  const normalizedReference = imageReference?.trim();
  if (!normalizedReference) return false;
  if (isManagedCatalogImagePath(normalizedReference)) return true;

  const sourceRules =
    CATALOG_IMAGE_REMOTE_RULES_BY_SOURCE[source as CatalogSource];
  if (!sourceRules) return false;

  try {
    const parsed = new URL(normalizedReference);
    if (parsed.username || parsed.password) return false;

    const isLocalHost = LOCAL_CATALOG_IMAGE_HOSTS.has(parsed.hostname);
    if (
      parsed.protocol !== 'https:' &&
      !(parsed.protocol === 'http:' && isLocalHost)
    ) {
      return false;
    }

    const configuredAppHost = parseConfiguredCatalogImageHost(appUrl);
    if (
      SHARED_CATALOG_IMAGE_HOSTS.has(parsed.hostname) ||
      isLocalHost ||
      (configuredAppHost !== null && parsed.hostname === configuredAppHost)
    ) {
      return true;
    }

    return sourceRules.some(
      (rule) =>
        parsed.hostname === rule.hostname &&
        (!rule.pathnamePrefix ||
          parsed.pathname.startsWith(rule.pathnamePrefix)),
    );
  } catch {
    return false;
  }
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
