import type { ProductOrderMode } from '@/types/models/product';
import type { ProductSection } from './product-onboarding.types';

export const ALL_CATALOG_ITEMS = '__all__';
export const MAX_PRODUCT_IMAGE_SIZE_BYTES = 15 * 1024 * 1024;
export const MAX_PRODUCT_IMAGE_SIZE_MB = 15;

export const ALLOWED_PRODUCT_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

export const ALLOWED_PRODUCT_IMAGE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.heic',
  '.heif',
]);

export const DUPLICATE_PRODUCT_PREFIX = 'المنتج موجود بالفعل:';
export const MIN_SEARCH_CHARS = 2;
export const SEARCH_DEBOUNCE_MS = 300;
export const SEARCH_RESULTS_LIMIT = 20;

export const ORDER_MODE_QUANTITY: ProductOrderMode = 'quantity';
export const ORDER_MODE_WEIGHT: ProductOrderMode = 'weight';
export const ORDER_MODE_PRICE: ProductOrderMode = 'price';

export const DEFAULT_UNIT_LABEL = 'قطعة';
export const DEFAULT_WEIGHT_PRESETS = '250,500,1000';
export const DEFAULT_PRICE_PRESETS = '100,200,300';

export const CATEGORY_MODE_SELECT = 'select';
export const CATEGORY_MODE_CUSTOM = 'custom';

export const SECTION_QUICK_ADD: ProductSection = 'quick-add';
export const SECTION_CATALOG: ProductSection = 'catalog';
export const SECTION_MY_PRODUCTS: ProductSection = 'my-products';
