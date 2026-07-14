import { notFound, redirect } from "next/navigation";
import OrderSuccessView from "@/app/(public)/[slug]/_components/OrderSuccessView";
import { createNoIndexMetadata } from "@/lib/marketing-seo";
import { ordersService } from "@/services/api/orders.service";
export const metadata = createNoIndexMetadata(
  "تم إرسال طلب المنطقة",
  "صفحة تأكيد خاصة بطلب واجهة المنطقة.",
);

type ZoneSuccessPageProps = {
  params: Promise<{ zoneSlug: string }>;
  searchParams: Promise<{ token?: string; customerCode?: string }>;
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
  if (
    !orderResponse.success ||
    orderResponse.data?.zone_storefront?.slug !== zoneSlug
  ) {
    notFound();
  }

  return (
    <div className="relative mx-auto min-h-screen w-full max-w-md overflow-x-hidden bg-background">
      <OrderSuccessView
        tenantSlug={zoneSlug}
        orderToken={token}
        customerAccessCode={customerCode}
        newOrderHref={`/market/${zoneSlug}`}
        newOrderLabel="عمل طلب جديد من نفس المنطقة"
        successDescription="استلمت عمليات المنطقة طلبك وسيتم اختيار متجر التنفيذ يدوياً."
      />
    </div>
  );
}
