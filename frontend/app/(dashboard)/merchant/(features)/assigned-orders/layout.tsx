import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { isZoneStorefrontEnabled } from "@/lib/zone-storefront-feature";

/** Prevents direct access to assigned zone orders while the feature is off. */
export default function AssignedOrdersLayout({
  children,
}: {
  children: ReactNode;
}) {
  if (!isZoneStorefrontEnabled()) notFound();

  return children;
}
