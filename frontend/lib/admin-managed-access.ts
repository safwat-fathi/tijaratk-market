import type {
  AdminManagementSession,
  AdminManagedPermission,
  AdminTenantAccess,
} from "@/services/api/admin.service";
import type { ServiceResponse } from "@/services/base/http.service";
import { isZoneStorefrontEnabled } from "@/lib/zone-storefront-feature";

const MANAGED_SESSION_FAILURE_CODES = new Set([
  "MANAGEMENT_SESSION_REQUIRED",
  "MANAGEMENT_SESSION_INVALID",
  "MANAGEMENT_SESSION_EXPIRED",
  "MANAGEMENT_TENANT_MISMATCH",
]);

type ManagedSessionNavigation = Pick<
  AdminManagementSession,
  "tenant_id" | "permissions" | "tenant"
>;

export type ManagedStoreSection =
  | "products"
  | "orders"
  | "activity"
  | "dispatches";

const MANAGED_SECTION_READ_PERMISSIONS = {
  products: "products.read",
  activity: "activity_logs.read",
  dispatches: "dispatches.read",
} as const satisfies Record<
  Exclude<ManagedStoreSection, "orders">,
  AdminManagedPermission
>;

export function hasActiveManagedPermission(
  access: AdminTenantAccess | null | undefined,
  permission: AdminManagedPermission,
  now = Date.now(),
): boolean {
  if (
    !access?.is_active ||
    access.revoked_at ||
    !access.permissions.includes(permission)
  ) {
    return false;
  }

  if (!access.expires_at) {
    return true;
  }

  const expiresAt = Date.parse(access.expires_at);
  return Number.isFinite(expiresAt) && expiresAt > now;
}

export function hasManagedOrderReadAccess(
  permissions: readonly AdminManagedPermission[],
): boolean {
  return (
    permissions.includes("orders.read") &&
    permissions.includes("customers.read_limited")
  );
}

export function hasManagedSectionAccess(
  permissions: readonly AdminManagedPermission[],
  section: ManagedStoreSection,
): boolean {
  if (section === "orders") {
    return hasManagedOrderReadAccess(permissions);
  }

  return permissions.includes(MANAGED_SECTION_READ_PERMISSIONS[section]);
}

export function getManagedStoreLandingPath(
  session: ManagedSessionNavigation,
): string | null {
  const { tenant_id: tenantId, permissions } = session;
  const operatedZone = session.tenant.operated_zone_storefront;

  if (
    isZoneStorefrontEnabled() &&
    operatedZone &&
    hasManagedSectionAccess(permissions, "dispatches")
  ) {
    return `/admin/zones/${operatedZone.id}/dispatches`;
  }

  if (hasManagedSectionAccess(permissions, "products")) {
    return `/admin/merchants/${tenantId}/manage/products`;
  }

  if (hasManagedSectionAccess(permissions, "orders")) {
    return `/admin/merchants/${tenantId}/manage/orders`;
  }

  if (hasManagedSectionAccess(permissions, "activity")) {
    return `/admin/merchants/${tenantId}/manage/activity`;
  }

  return null;
}

export function getManagedStoreFallbackPath(
  session: ManagedSessionNavigation,
): string {
  return (
    getManagedStoreLandingPath(session) ??
    `/admin/merchants/${session.tenant_id}/manage`
  );
}

export function getManagedSessionRevokePath(tenantId: number): string {
  const target = encodeURIComponent(`/admin/merchants/${tenantId}`);
  return `/api/auth/admin/managed-session/revoke?redirect=${target}`;
}

export function getServiceResponseErrorCode(
  response: ServiceResponse<unknown>,
): string | null {
  const data = response.data;
  if (typeof data !== "object" || data === null) return null;

  const errors = (data as Record<string, unknown>).errors;
  if (typeof errors !== "object" || errors === null) return null;

  const code = (errors as Record<string, unknown>).code;
  return typeof code === "string" ? code : null;
}

export function isManagedSessionFailure(
  response: ServiceResponse<unknown>,
): boolean {
  const code = getServiceResponseErrorCode(response);
  return Boolean(code && MANAGED_SESSION_FAILURE_CODES.has(code));
}

export function isManagedPermissionFailure(
  response: ServiceResponse<unknown>,
): boolean {
  return getServiceResponseErrorCode(response) === "MANAGEMENT_PERMISSION_DENIED";
}
