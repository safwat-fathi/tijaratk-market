import "server-only";

/** Returns whether the complete zone storefront experiment is enabled. */
export const isZoneStorefrontEnabled = () =>
  String(process.env.ZONE_STOREFRONTS_ENABLED).trim().toLowerCase() === "true";
