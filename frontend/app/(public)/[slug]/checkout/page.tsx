import { notFound, redirect } from "next/navigation";
import { getStorefrontCartDraftAction } from "@/actions/storefront-cart-actions";
import {
  deriveStorefrontCheckoutCsrf,
  getStorefrontCartToken,
} from "@/lib/storefront-cart-cookie";
import { getCustomerProfileBySlugFromCookie } from "@/lib/tracking/customer-tracking-cookie";
import { tenantsService } from "@/services/api/tenants.service";
import { createUnavailableStorefrontOrderState } from "@/lib/storefront-order-availability";
import StoreHeader from "../_components/StoreHeader";
import HeaderCartButton from "../_components/HeaderCartButton";
import StorefrontCheckout from "../_components/StorefrontCheckout";
import CustomerAnalytics from "@/components/analytics/CustomerAnalytics";
import type { StorefrontAnalyticsContext } from "@/lib/analytics/storefront-ga4";
import { createNoIndexMetadata } from "@/lib/marketing-seo";

export const metadata = createNoIndexMetadata(
  "إتمام الطلب",
  "صفحة إتمام الطلب الخاصة بالعميل وليست مخصصة للفهرسة.",
);

type CheckoutPageProps = { params: Promise<{ slug: string }> };

/** Dedicated customer-details checkout page guarded by the server cart. */
export default async function CheckoutPage({ params }: CheckoutPageProps) {
  const { slug } = await params;
  const [tenantResponse, draft, orderAvailabilityResponse, profile, token] =
    await Promise.all([
      tenantsService.getPublicTenant(slug),
      getStorefrontCartDraftAction(slug),
      tenantsService.getStorefrontOrderAvailability(slug),
      getCustomerProfileBySlugFromCookie(slug),
      getStorefrontCartToken(),
    ]);
  if (!tenantResponse.success || !tenantResponse.data) notFound();
  if (
    !draft ||
    !token ||
    !draft.delivery_area_id ||
    (draft.items.length === 0 &&
      !draft.free_text_payload.trim() &&
      !draft.has_prescription)
  ) {
    redirect(`/${encodeURIComponent(slug)}/cart`);
  }
  const tenant = tenantResponse.data;
  const orderAvailability =
    orderAvailabilityResponse.success && orderAvailabilityResponse.data
      ? orderAvailabilityResponse.data
      : createUnavailableStorefrontOrderState();
  if (!orderAvailability.accepting_orders) {
    redirect(`/${encodeURIComponent(slug)}/cart`);
  }
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
        pageLocation={`/${encodeURIComponent(slug)}/checkout`}
        pageTitle="إتمام الطلب"
      />
      <StoreHeader
        tenant={tenant}
        cartAction={
          <HeaderCartButton
            tenantSlug={tenant.slug}
            initialCount={draft.items.length}
          />
        }
      />
      <StorefrontCheckout
        tenantSlug={tenant.slug}
        draft={draft}
        csrfToken={deriveStorefrontCheckoutCsrf(token)}
        deliverySettings={tenant}
        deliveryAvailability={orderAvailability.delivery_availability}
        savedCustomerProfile={profile}
        storeAnalytics={storeAnalytics}
      />
    </div>
  );
}
