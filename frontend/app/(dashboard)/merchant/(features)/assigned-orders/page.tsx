import { notFound, redirect } from "next/navigation";
import { isZoneStorefrontEnabled } from "@/lib/zone-storefront-feature";

export const dynamic = "force-dynamic";

export default function AssignedOrdersPage() {
  if (!isZoneStorefrontEnabled()) notFound();

  redirect("/merchant/orders?tab=assigned");
}
