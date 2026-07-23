import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { isZoneStorefrontEnabled } from "@/lib/zone-storefront-feature";

/** Prevents direct access to zone administration while the feature is off. */
export default function AdminZonesLayout({
  children,
}: {
  children: ReactNode;
}) {
  if (!isZoneStorefrontEnabled()) notFound();

  return children;
}
