import { SetMetadata } from '@nestjs/common';
import { AdminManagedPermission } from '../constants/admin-managed-permissions';
import { ManagedFeature } from '../admin-managed.types';

export const MANAGED_PERMISSIONS_KEY = 'admin.managed_permissions';
export const MANAGED_FEATURE_KEY = 'admin.managed_feature';

/** Declares every managed-store permission required by an endpoint. */
export const RequireManagedPermissions = (
  ...permissions: AdminManagedPermission[]
) => SetMetadata(MANAGED_PERMISSIONS_KEY, permissions);

/** Declares the write feature flag required by an endpoint. */
export const RequireManagedFeature = (feature: ManagedFeature) =>
  SetMetadata(MANAGED_FEATURE_KEY, feature);
