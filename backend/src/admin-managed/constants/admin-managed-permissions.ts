export const ADMIN_MANAGED_PERMISSIONS = {
  ProductsRead: 'products.read',
  ProductsCreate: 'products.create',
  ProductsUpdate: 'products.update',
  ProductsUpdatePrice: 'products.update_price',
  ProductsUpdateAvailability: 'products.update_availability',
  ProductsArchive: 'products.archive',
  OrdersRead: 'orders.read',
  OrdersUpdateStatus: 'orders.update_status',
  OrdersUpdatePricing: 'orders.update_pricing',
  OrdersManageReplacements: 'orders.manage_replacements',
  CustomersReadLimited: 'customers.read_limited',
  ActivityLogsRead: 'activity_logs.read',
  DispatchesRead: 'dispatches.read',
  DispatchesAssign: 'dispatches.assign',
  DispatchesCancel: 'dispatches.cancel',
} as const;

export type AdminManagedPermission =
  (typeof ADMIN_MANAGED_PERMISSIONS)[keyof typeof ADMIN_MANAGED_PERMISSIONS];

export const ADMIN_MANAGED_PERMISSION_VALUES = Object.values(
  ADMIN_MANAGED_PERMISSIONS,
);

const CATALOG_OPERATOR_PERMISSIONS: AdminManagedPermission[] = [
  ADMIN_MANAGED_PERMISSIONS.ProductsRead,
  ADMIN_MANAGED_PERMISSIONS.ProductsCreate,
  ADMIN_MANAGED_PERMISSIONS.ProductsUpdate,
  ADMIN_MANAGED_PERMISSIONS.ProductsUpdatePrice,
  ADMIN_MANAGED_PERMISSIONS.ProductsUpdateAvailability,
  ADMIN_MANAGED_PERMISSIONS.ProductsArchive,
  ADMIN_MANAGED_PERMISSIONS.ActivityLogsRead,
];

const ORDER_OPERATOR_PERMISSIONS: AdminManagedPermission[] = [
  ADMIN_MANAGED_PERMISSIONS.OrdersRead,
  ADMIN_MANAGED_PERMISSIONS.OrdersUpdateStatus,
  ADMIN_MANAGED_PERMISSIONS.OrdersUpdatePricing,
  ADMIN_MANAGED_PERMISSIONS.OrdersManageReplacements,
  ADMIN_MANAGED_PERMISSIONS.CustomersReadLimited,
  ADMIN_MANAGED_PERMISSIONS.ProductsRead,
  ADMIN_MANAGED_PERMISSIONS.ProductsUpdateAvailability,
  ADMIN_MANAGED_PERMISSIONS.ActivityLogsRead,
  ADMIN_MANAGED_PERMISSIONS.DispatchesRead,
  ADMIN_MANAGED_PERMISSIONS.DispatchesAssign,
  ADMIN_MANAGED_PERMISSIONS.DispatchesCancel,
];

export const ADMIN_MANAGED_PERMISSION_PRESETS = {
  catalog_operator: CATALOG_OPERATOR_PERMISSIONS,
  order_operator: ORDER_OPERATOR_PERMISSIONS,
  store_manager: Array.from(
    new Set([...CATALOG_OPERATOR_PERMISSIONS, ...ORDER_OPERATOR_PERMISSIONS]),
  ),
} as const;

/** Validates and deduplicates permission values persisted in JSONB. */
export function normalizeAdminManagedPermissions(
  value: unknown,
): AdminManagedPermission[] {
  if (!Array.isArray(value)) return [];

  const allowed = new Set<string>(ADMIN_MANAGED_PERMISSION_VALUES);
  return Array.from(
    new Set(
      value.filter(
        (permission): permission is AdminManagedPermission =>
          typeof permission === 'string' && allowed.has(permission),
      ),
    ),
  );
}
