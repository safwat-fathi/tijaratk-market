/** Returns whether new public zone discovery and checkout are enabled. */
export function isZoneStorefrontPublicOrderingEnabled(): boolean {
  return (
    String(process.env.ZONE_STOREFRONTS_ENABLED).trim().toLowerCase() === 'true'
  );
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
