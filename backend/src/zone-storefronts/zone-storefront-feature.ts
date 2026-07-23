import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

/** Returns whether the complete zone storefront feature is enabled. */
export function isZoneStorefrontEnabled(): boolean {
  return (
    String(process.env.ZONE_STOREFRONTS_ENABLED).trim().toLowerCase() === 'true'
  );
}

/** Returns whether new public zone discovery and checkout are enabled. */
export function isZoneStorefrontPublicOrderingEnabled(): boolean {
  return isZoneStorefrontEnabled();
}

/** Rejects requests for zone-only APIs while the experiment is disabled. */
@Injectable()
export class ZoneStorefrontFeatureGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    if (!isZoneStorefrontEnabled()) {
      throw new NotFoundException({
        code: 'ZONE_STOREFRONTS_DISABLED',
        message: 'Zone storefronts are disabled',
      });
    }

    return true;
  }
}

/** Returns the only customer-facing reorder URL allowed for a zone order. */
export function resolveZoneStorefrontReorderUrl(input: {
  slug: string;
  isActive: boolean;
}): string | null {
  return input.isActive && isZoneStorefrontPublicOrderingEnabled()
    ? `/market/${input.slug}`
    : null;
}
