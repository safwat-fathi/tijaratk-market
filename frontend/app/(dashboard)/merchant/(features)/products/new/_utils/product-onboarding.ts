import { formatCurrency } from '@/lib/utils/currency';
import type {
  CatalogItem,
  Product,
  ProductOrderConfig,
  ProductOrderMode,
  QuantityUnitOption,
} from '@/types/models/product';
import {
  ALL_CATALOG_ITEMS,
  ALLOWED_PRODUCT_IMAGE_EXTENSIONS,
  ALLOWED_PRODUCT_IMAGE_MIME_TYPES,
  CATEGORY_MODE_CUSTOM,
  CATEGORY_MODE_SELECT,
  DEFAULT_PRICE_PRESETS,
  DEFAULT_UNIT_LABEL,
  DEFAULT_WEIGHT_PRESETS,
  ORDER_MODE_PRICE,
  ORDER_MODE_QUANTITY,
  ORDER_MODE_WEIGHT,
  SECTION_CATALOG,
  SECTION_MY_PRODUCTS,
  SECTION_QUICK_ADD,
} from './product-onboarding.constants';
import type {
  CategoryMode,
  CategoryTab,
  EditFormState,
  ParsedOptionalPrice,
  ProductSection,
  SectionTab,
} from './product-onboarding.types';

export const resolveSectionFromQuery = (value: string | null): ProductSection => {
  if (value === SECTION_CATALOG || value === SECTION_MY_PRODUCTS || value === SECTION_QUICK_ADD) {
    return value;
  }

  return SECTION_QUICK_ADD;
};

export const normalizeProductName = (name: string): string =>
  name.trim().replace(/\s+/g, ' ').toLowerCase();

export const normalizeOptionalCategory = (value: string): string | undefined => {
  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }

  return normalized;
};

export const isDuplicateMessage = (message?: string): boolean => {
  if (!message) {
    return false;
  }

  return /(already exists|duplicate|موجود بالفعل)/i.test(message);
};

export const resolveImageUrl = (imageUrl?: string | null): string | null => {
  if (!imageUrl?.trim()) {
    return null;
  }

  if (/^https?:\/\//i.test(imageUrl) || imageUrl.startsWith('data:') || imageUrl.startsWith('blob:')) {
    return imageUrl;
  }

  if (imageUrl.startsWith('/uploads')) {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
    if (!apiBaseUrl) {
      return imageUrl;
    }

    return `${apiBaseUrl.replace(/\/$/, '')}${imageUrl}`;
  }

  return imageUrl;
};

export const isServerActionBodyLimitError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }

  const normalizedMessage = error.message.toLowerCase();
  return (
    normalizedMessage.includes('body exceeded') ||
    normalizedMessage.includes('body size limit') ||
    normalizedMessage.includes('body limit') ||
    (normalizedMessage.includes('request body') &&
      normalizedMessage.includes('exceed')) ||
    (normalizedMessage.includes('payload') &&
      normalizedMessage.includes('too large'))
  );
};

export const normalizeImageUploadErrorMessage = (
  message?: string,
): string | null => {
  const normalized = message?.trim();
  if (!normalized) {
    return null;
  }

  if (
    /(unsupported image format|unsupported codec|صيغة الصورة غير مدعومة)/i.test(
      normalized,
    )
  ) {
    return 'صيغة الصورة غير مدعومة. استخدم JPG أو PNG أو WEBP أو HEIC أو HEIF.';
  }

  if (
    /(limit_file_size|payload too large|entity too large|file too large|حجم الصورة|ميجابايت|exceed.*(?:size|limit))/i.test(
      normalized,
    )
  ) {
    return 'حجم الصورة كبير. الحد الأقصى 15 ميجابايت.';
  }

  if (
    /(timeout|timed out|aborterror|operation was aborted|signal is aborted|استغرق رفع\/معالجة الصورة)/i.test(
      normalized,
    )
  ) {
    return 'استغرق رفع/معالجة الصورة وقتًا أطول من المتوقع. حاول مرة أخرى.';
  }

  return null;
};

export const parseOptionalPositivePrice = (value: string): ParsedOptionalPrice => {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) {
    return { value: null, valid: true };
  }

  const parsedPrice = Number(normalized);
  if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
    return { value: null, valid: false };
  }

  return { value: Number(parsedPrice.toFixed(2)), valid: true };
};

export const resolveProductPriceText = (value: Product['current_price']): string | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsedPrice = Number(value);
  if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
    return null;
  }

  return formatCurrency(parsedPrice) || null;
};

export const hasAllowedProductImageFormat = (file: File): boolean => {
  const mimeType = file.type.trim().toLowerCase();
  if (ALLOWED_PRODUCT_IMAGE_MIME_TYPES.has(mimeType)) {
    return true;
  }

  const extensionMatch = /\.[^.]+$/.exec(file.name);
  const extension = extensionMatch?.[0].toLowerCase() || '';
  const hasAllowedExtension = ALLOWED_PRODUCT_IMAGE_EXTENSIONS.has(extension);
  const hasGenericMimeType = !mimeType || mimeType === 'application/octet-stream';
  const hasImageMimeType = mimeType.startsWith('image/');
  const canTrustExtension = hasGenericMimeType || hasImageMimeType;

  return canTrustExtension && hasAllowedExtension;
};

export const parsePresetNumbers = (value: string, fallback: number[]): number[] => {
  const parsed = Array.from(
    new Set(
      value
        .split(',')
        .map((item) => Number(item.trim()))
        .filter((item) => Number.isFinite(item) && item > 0)
        .map((item) => Math.round(item)),
    ),
  );

  if (parsed.length === 0) {
    return fallback;
  }

  return parsed.slice(0, 6);
};

export const normalizeModeBadge = (mode?: ProductOrderMode): string => {
  if (mode === ORDER_MODE_WEIGHT) {
    return 'بالوزن';
  }

  if (mode === ORDER_MODE_PRICE) {
    return 'بالمبلغ';
  }

  return 'بالعدد';
};

export const buildQuantityUnitOptions = (
  unitLabel: string,
  secondaryLabel: string,
  secondaryMultiplier: string,
): QuantityUnitOption[] => {
  const normalizedUnitLabel = unitLabel.trim() || DEFAULT_UNIT_LABEL;
  const normalizedSecondary = secondaryLabel.trim();
  const parsedMultiplier = Number(secondaryMultiplier.trim().replace(',', '.'));

  if (!normalizedSecondary || !Number.isFinite(parsedMultiplier) || parsedMultiplier <= 1) {
    return [];
  }

  return [
    { id: 'base', label: normalizedUnitLabel, multiplier: 1 },
    {
      id: 'alt',
      label: normalizedSecondary,
      multiplier: Number(parsedMultiplier.toFixed(3)),
    },
  ];
};

export const buildOrderConfigPayload = ({
  mode,
  unitLabel,
  secondaryLabel,
  secondaryMultiplier,
  weightPresets,
  pricePresets,
}: {
  mode: ProductOrderMode;
  unitLabel: string;
  secondaryLabel: string;
  secondaryMultiplier: string;
  weightPresets: string;
  pricePresets: string;
}): ProductOrderConfig => {
  if (mode === ORDER_MODE_WEIGHT) {
    return {
      weight: {
        preset_grams: parsePresetNumbers(weightPresets, [250, 500, 1000]),
        allow_custom_grams: true,
      },
    };
  }

  if (mode === ORDER_MODE_PRICE) {
    return {
      price: {
        preset_amounts_egp: parsePresetNumbers(pricePresets, [100, 200, 300]),
        allow_custom_amount: true,
      },
    };
  }

  const normalizedUnitLabel = unitLabel.trim() || DEFAULT_UNIT_LABEL;
  const unitOptions = buildQuantityUnitOptions(
    normalizedUnitLabel,
    secondaryLabel,
    secondaryMultiplier,
  );

  return {
    quantity: {
      unit_label: normalizedUnitLabel,
      ...(unitOptions.length > 0 ? { unit_options: unitOptions } : {}),
    },
  };
};

export const buildAvailableProductCategories = (categories: string[]): string[] => {
  const uniqueCategories = new Set<string>();
  for (const category of categories) {
    const normalizedCategory = category.trim();
    if (!normalizedCategory) {
      continue;
    }
    uniqueCategories.add(normalizedCategory);
  }

  return Array.from(uniqueCategories).sort((a, b) => a.localeCompare(b, 'ar'));
};

export const buildCategoryTabsFromCatalog = (catalogItems: CatalogItem[]): CategoryTab[] => {
  const categoryMap = new Map<string, { count: number }>();

  for (const item of catalogItems) {
    const existing = categoryMap.get(item.category);

    if (existing) {
      existing.count += 1;
      continue;
    }

    categoryMap.set(item.category, {
      count: 1,
    });
  }

  const categories = Array.from(categoryMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0], 'ar'))
    .map(([category, value]) => ({
      key: category,
      label: category,
      count: value.count,
      imageUrl: null,
    }));

  return [
    {
      key: ALL_CATALOG_ITEMS,
      label: 'الكل',
      count: catalogItems.length,
      imageUrl: null,
    },
    ...categories,
  ];
};

export const filterCatalogItemsByCategory = (
  catalogItems: CatalogItem[],
  activeCategory: string,
): CatalogItem[] => {
  if (activeCategory === ALL_CATALOG_ITEMS) {
    return catalogItems;
  }

  return catalogItems.filter((item) => item.category === activeCategory);
};

export const supportsCatalogForStoreType = (storeType?: string): boolean =>
  storeType === 'grocery' || storeType === 'pharmacy';

export const buildSectionTabs = (
  catalogItemsLength: number,
  productsLength: number,
  storeType?: string,
): SectionTab[] => {
  const tabs: SectionTab[] = [
    {
      key: SECTION_QUICK_ADD,
      label: 'إضافة منتج',
      description: 'إضافة منتج يدويًا',
    },
  ];

  if (supportsCatalogForStoreType(storeType)) {
    tabs.push({
      key: SECTION_CATALOG,
      label: 'الكتالوج',
      description: `${catalogItemsLength} منتج جاهز`,
    });
  }

  tabs.push({
    key: SECTION_MY_PRODUCTS,
    label: 'منتجاتك',
    description: `${productsLength} منتج`,
  });

  return tabs;
};

export const buildProductsByNormalizedNameMap = (products: Product[]): Map<string, Product> => {
  const map = new Map<string, Product>();

  for (const product of products) {
    const normalizedName = normalizeProductName(product.name);
    if (!normalizedName || map.has(normalizedName)) {
      continue;
    }

    map.set(normalizedName, product);
  }

  return map;
};

export const deriveEditFormState = (
  product: Product,
  availableCategorySet: Set<string>,
  defaultUnitLabel: string = DEFAULT_UNIT_LABEL,
): EditFormState => {
  const normalizedCategory = product.category?.trim() || '';
  const productMode = product.order_mode || ORDER_MODE_QUANTITY;

  const quantityConfig = product.order_config?.quantity;
  const quantityUnitLabel = quantityConfig?.unit_label || defaultUnitLabel;
  const quantityAltOption = quantityConfig?.unit_options?.find(
    (option) => option.id !== 'base' && option.multiplier > 1,
  );

  const weightPresetList = product.order_config?.weight?.preset_grams;
  const pricePresetList = product.order_config?.price?.preset_amounts_egp;

  let categoryMode: CategoryMode = CATEGORY_MODE_SELECT;
  if (normalizedCategory) {
    categoryMode = availableCategorySet.has(normalizedCategory)
      ? CATEGORY_MODE_SELECT
      : CATEGORY_MODE_CUSTOM;
  }

  return {
    name: product.name,
    price:
      product.current_price === null ||
      product.current_price === undefined ||
      product.current_price === ''
        ? ''
        : String(Number(product.current_price)),
    isAvailable: product.is_available !== false,
    orderMode: productMode,
    unitLabel: quantityUnitLabel,
    secondaryUnitLabel: quantityAltOption?.label || '',
    secondaryUnitMultiplier: quantityAltOption?.multiplier
      ? String(quantityAltOption.multiplier)
      : '',
    weightPresets:
      Array.isArray(weightPresetList) && weightPresetList.length > 0
        ? weightPresetList.join(',')
        : DEFAULT_WEIGHT_PRESETS,
    pricePresets:
      Array.isArray(pricePresetList) && pricePresetList.length > 0
        ? pricePresetList.join(',')
        : DEFAULT_PRICE_PRESETS,
    categoryMode,
    categorySelect: categoryMode === CATEGORY_MODE_SELECT ? normalizedCategory : '',
    categoryCustom: categoryMode === CATEGORY_MODE_CUSTOM ? normalizedCategory : '',
  };
};
