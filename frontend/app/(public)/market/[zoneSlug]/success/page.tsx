import { notFound, redirect } from "next/navigation";
import OrderSuccessView from "@/app/(public)/[slug]/_components/OrderSuccessView";
import { createNoIndexMetadata } from "@/lib/marketing-seo";
import { ordersService } from "@/services/api/orders.service";
import CustomerAnalytics from "@/components/analytics/CustomerAnalytics";

export const metadata = createNoIndexMetadata(
  "تم إرسال طلب المنطقة",
  "صفحة تأكيد خاصة بطلب واجهة المنطقة.",
);

type ZoneSuccessPageProps = {
  params: Promise<{ zoneSlug: string }>;
  searchParams: Promise<{
    token?: string;
    customerCode?: string;
  }>;
};

export default async function ZoneOrderSuccessPage({
  params,
  searchParams,
}: ZoneSuccessPageProps) {
  const { zoneSlug } = await params;
  const resolvedSearchParams = await searchParams;
  const { token, customerCode } = resolvedSearchParams;
  if (!token) redirect(`/market/${zoneSlug}`);

  const orderResponse = await ordersService.getOrderByPublicToken(token);
  const zoneStorefront = orderResponse.data?.zone_storefront;
  if (
    !orderResponse.success ||
    !zoneStorefront ||
    zoneStorefront.slug !== zoneSlug
  ) {
    notFound();
  }

  return (
    <div className="relative mx-auto min-h-screen w-full max-w-md overflow-x-hidden bg-background">
      <CustomerAnalytics
        pageLocation={`/market/${encodeURIComponent(zoneSlug)}/success`}
        pageTitle="تم إرسال طلب المنطقة"
      />
      <OrderSuccessView
        tenantSlug={zoneSlug}
        orderToken={token}
        customerAccessCode={customerCode}
        newOrderHref={zoneStorefront.reorder_url}
        newOrderLabel="عمل طلب جديد"
      />
    </div>
  );
}
