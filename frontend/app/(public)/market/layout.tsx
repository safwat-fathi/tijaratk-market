import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { isZoneStorefrontEnabled } from "@/lib/zone-storefront-feature";

/** Prevents every public zone storefront route from rendering while disabled. */
export default function MarketLayout({ children }: { children: ReactNode }) {
  if (!isZoneStorefrontEnabled()) notFound();

  return children;
}
