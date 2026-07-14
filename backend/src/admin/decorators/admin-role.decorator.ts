import { SetMetadata } from '@nestjs/common';

export const PLATFORM_ADMIN_REQUIRED_KEY = 'admin.platform_required';

/** Marks an admin route as restricted to platform administrators. */
export const RequirePlatformAdmin = () =>
  SetMetadata(PLATFORM_ADMIN_REQUIRED_KEY, true);

/** Overrides a class-level platform restriction for any active administrator. */
export const AllowAnyAdmin = () =>
  SetMetadata(PLATFORM_ADMIN_REQUIRED_KEY, false);
