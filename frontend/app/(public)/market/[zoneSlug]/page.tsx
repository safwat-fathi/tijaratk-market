import type { Metadata } from "next";
import { notFound } from "next/navigation";
import OrderForm from "@/app/(public)/[slug]/_components/OrderForm";
import StoreHeader from "@/app/(public)/[slug]/_components/StoreHeader";
import { getCustomerProfileBySlugFromCookie } from "@/lib/tracking/customer-tracking-cookie";
import { ordersService } from "@/services/api/orders.service";
import { zoneStorefrontsService } from "@/services/api/zone-storefronts.service";
import type { Order } from "@/types/models/order";
import type { Tenant } from "@/types/models/tenant";
import type { PublicProductsMeta } from "@/types/models/product";
import CustomerAnalytics from "@/components/analytics/CustomerAnalytics";
import {
  buildCustomerAnalyticsPageLocation,
  type CustomerAnalyticsSearchParams,
} from "@/lib/analytics/google-analytics";

type ZoneSearchParams = CustomerAnalyticsSearchParams & {
  reorder?: string;
  category?: string;
};

type ZonePageProps = {
  params: Promise<{ zoneSlug: string }>;
  searchParams: Promise<ZoneSearchParams>;
};

const EMPTY_PRODUCTS_META: PublicProductsMeta = {
  total: 0,
  page: 1,
  limit: 20,
  last_page: 1,
  has_next: false,
};

export async function generateMetadata({ params }: ZonePageProps): Promise<Metadata> {
  const { zoneSlug } = await params;
  const response = await zoneStorefrontsService.getPublicZone(zoneSlug);
  if (!response.success || !response.data) return { title: "المنطقة غير متاحة" };
  return {
    title: `${response.data.name} | سوق تجارتك`,
    description: `اطلب احتياجاتك من ${response.data.area.name_ar} عبر واجهة تجارتك المركزية.`,
    alternates: { canonical: `/market/${response.data.slug}` },
  };
}

export default async function ZoneStorefrontPage({
  params,
  searchParams,
}: ZonePageProps) {
  const { zoneSlug } = await params;
  const resolvedSearchParams = await searchParams;
  const { reorder, category } = resolvedSearchParams;
  const [zoneResponse, productsResponse, categoriesResponse, orderResponse] =
    await Promise.all([
      zoneStorefrontsService.getPublicZone(zoneSlug),
      zoneStorefrontsService.getPublicProducts(zoneSlug, {
        category,
        page: 1,
        limit: 20,
      }),
      zoneStorefrontsService.getPublicCategories(zoneSlug),
      reorder ? ordersService.getOrderByPublicToken(reorder) : null,
    ]);

  if (!zoneResponse.success || !zoneResponse.data) notFound();
  const zone = zoneResponse.data;
  const initialOrder =
    orderResponse?.success &&
    orderResponse.data?.zone_storefront?.slug === zone.slug
      ? orderResponse.data
      : null;
  const savedCustomerProfile = await getCustomerProfileBySlugFromCookie(
    `market:${zone.slug}`,
  );
  const tenantPresentation: Tenant = {
    id: zone.id,
    name: zone.name,
    phone: "",
    slug: zone.slug,
    category: zone.category,
    status: "active",
    onboarding_completed: true,
    delivery_fee: zone.delivery_fee,
    delivery_available: zone.delivery_available,
    delivery_starts_at: zone.delivery_starts_at,
    delivery_ends_at: zone.delivery_ends_at,
    card_on_delivery_available: zone.card_on_delivery_available,
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background">
      <CustomerAnalytics
        pageLocation={buildCustomerAnalyticsPageLocation(
          `/market/${encodeURIComponent(zoneSlug)}`,
          resolvedSearchParams,
        )}
        pageTitle={zone.name}
      />
      <StoreHeader tenant={tenantPresentation} />
      <div className="min-w-0">
        <OrderForm
          tenantSlug={zone.slug}
          storefrontKind="zone"
          areaSlug={zone.area.slug}
          isPharmacy={zone.category === "pharmacy"}
          tenantCategory={zone.category}
          deliverySettings={tenantPresentation}
          initialCategory={category}
          initialProducts={productsResponse.data?.data ?? []}
          initialProductsMeta={productsResponse.data?.meta ?? EMPTY_PRODUCTS_META}
          initialCategories={categoriesResponse.data ?? []}
          initialOrder={initialOrder as Order | null}
          savedCustomerProfile={savedCustomerProfile}
        />
        <div className="mt-4 border-t border-brand-border p-4 text-center text-xs text-muted-foreground">
          <p className="font-semibold text-brand-text">واجهة مركزية تديرها تجارتك لمنطقة {zone.area.name_ar}</p>
          <p className="mt-1">سيظهر اسم المتجر المنفذ بعد تأكيده للطلب والسعر النهائي.</p>
        </div>
      </div>
    </div>
  );
}
