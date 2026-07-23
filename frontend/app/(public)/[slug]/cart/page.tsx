import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStorefrontCartDraftAction } from "@/actions/storefront-cart-actions";
import { tenantsService } from "@/services/api/tenants.service";
import StoreHeader from "../_components/StoreHeader";
import HeaderCartButton from "../_components/HeaderCartButton";
import StorefrontCart from "../_components/StorefrontCart";
import { createUnavailableStorefrontOrderState } from "@/lib/storefront-order-availability";
import CustomerAnalytics from "@/components/analytics/CustomerAnalytics";
import type { StorefrontAnalyticsContext } from "@/lib/analytics/storefront-ga4";

export const metadata: Metadata = { title: "مراجعة الطلب | تجارتك" };

type CartPageProps = { params: Promise<{ slug: string }> };

/** Dedicated merchant cart review page. */
export default async function CartPage({ params }: CartPageProps) {
  const { slug } = await params;
  const [tenantResponse, draft, orderAvailabilityResponse] = await Promise.all([
    tenantsService.getPublicTenant(slug),
    getStorefrontCartDraftAction(slug),
    tenantsService.getStorefrontOrderAvailability(slug),
  ]);
  if (!tenantResponse.success || !tenantResponse.data) notFound();
  const tenant = tenantResponse.data;
  const orderAvailability =
    orderAvailabilityResponse.success && orderAvailabilityResponse.data
      ? orderAvailabilityResponse.data
      : createUnavailableStorefrontOrderState();
  const storeAnalytics: StorefrontAnalyticsContext = {
    storeId: tenant.id,
    storeSlug: tenant.slug,
    storeName: tenant.name,
    storeCategory: tenant.category,
    ...(tenant.directory_profile?.area?.name_ar
      ? { area: tenant.directory_profile.area.name_ar }
      : {}),
  };

  return (
    <div className="mx-auto min-h-screen w-full max-w-md bg-background">
      <CustomerAnalytics
        pageLocation={`/${encodeURIComponent(slug)}/cart`}
        pageTitle="مراجعة الطلب"
      />
      <StoreHeader
        tenant={tenant}
        cartAction={
          <HeaderCartButton
            tenantSlug={tenant.slug}
            initialCount={draft?.items.length ?? 0}
          />
        }
      />
      <StorefrontCart
        tenantSlug={tenant.slug}
        initialDraft={draft}
        deliveryAreas={tenant.tenant_delivery_areas ?? []}
        isPharmacy={tenant.category === "pharmacy"}
        orderAvailability={orderAvailability}
        storeAnalytics={storeAnalytics}
      />
    </div>
  );
}
