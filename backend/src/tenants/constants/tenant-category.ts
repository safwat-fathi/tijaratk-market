export const TENANT_CATEGORY_VALUES = [
  'grocery',
  'greengrocer',
  'butcher',
  'bakery',
  'pharmacy',
  'other',
] as const;

export type TenantCategory = (typeof TENANT_CATEGORY_VALUES)[number];

export const TENANT_CATEGORIES = {
  GROCERY: {
    value: 'grocery',
    labels: {
      en: 'Grocery',
      ar: 'سوبر ماركت',
    },
  },
  GREENGROCER: {
    value: 'greengrocer',
    labels: {
      en: 'Greengrocer',
      ar: 'خضروات وفواكه',
    },
  },
  BUTCHER: {
    value: 'butcher',
    labels: {
      en: 'Butcher',
      ar: 'جزارة',
    },
  },
  BAKERY: {
    value: 'bakery',
    labels: {
      en: 'Bakery',
      ar: 'مخبز',
    },
  },
  PHARMACY: {
    value: 'pharmacy',
    labels: {
      en: 'Pharmacy',
      ar: 'صيدلية',
    },
  },
  OTHER: {
    value: 'other',
    labels: {
      en: 'Other',
      ar: 'أخرى',
    },
  },
} as const;
