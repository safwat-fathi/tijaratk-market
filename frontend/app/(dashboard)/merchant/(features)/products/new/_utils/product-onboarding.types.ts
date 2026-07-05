import type { ProductOrderMode } from '@/types/models/product';

export type CategoryMode = 'select' | 'custom';

export type ProductSection = 'quick-add' | 'catalog' | 'my-products';

export type ProductAvailabilityFilter = 'all' | 'available' | 'unavailable';

export type ProductStatusFilter = 'active' | 'archived';

export type SectionTab = {
  key: ProductSection;
  label: string;
  description: string;
};

export type CategoryTab = {
  key: string;
  label: string;
  count: number;
  imageUrl: string | null;
};

export type ParsedOptionalPrice = {
  value: number | null;
  valid: boolean;
};

export type EditFormState = {
  name: string;
  price: string;
  isAvailable: boolean;
  orderMode: ProductOrderMode;
  unitLabel: string;
  secondaryUnitLabel: string;
  secondaryUnitMultiplier: string;
  weightPresets: string;
  pricePresets: string;
  categoryMode: CategoryMode;
  categorySelect: string;
  categoryCustom: string;
};
