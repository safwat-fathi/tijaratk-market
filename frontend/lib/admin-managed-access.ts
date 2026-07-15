import type {
  AdminManagedPermission,
  AdminTenantAccess,
} from "@/services/api/admin.service";

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
