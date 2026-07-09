export const ActivityEntityTypes = {
  Order: 'order',
  Product: 'product',
  Customer: 'customer',
  Tenant: 'tenant',
  User: 'user',
  Subscription: 'subscription',
  DayClosure: 'day_closure',
  CsvImport: 'csv_import',
} as const;

export type ActivityEntityType =
  (typeof ActivityEntityTypes)[keyof typeof ActivityEntityTypes];

export const ActivitySources = {
  Dashboard: 'dashboard',
  Storefront: 'storefront',
  Admin: 'admin',
  System: 'system',
  Whatsapp: 'whatsapp',
  CsvImport: 'csv_import',
} as const;

export type ActivitySource =
  (typeof ActivitySources)[keyof typeof ActivitySources];

export const ACTIVITY_ENTITY_TYPE_VALUES = Object.values(ActivityEntityTypes);
export const ACTIVITY_SOURCE_VALUES = Object.values(ActivitySources);

