import { notFound, redirect } from "next/navigation";
import OrderSuccessView from "../_components/OrderSuccessView";
import { tenantsService } from "@/services/api/tenants.service";
import { ordersService } from "@/services/api/orders.service";
import { createNoIndexMetadata } from "@/lib/marketing-seo";
import CustomerAnalytics from "@/components/analytics/CustomerAnalytics";

export const metadata = createNoIndexMetadata(
	"تم إرسال الطلب",
	"صفحة تأكيد طلب خاصة بالعميل وليست مخصصة للفهرسة.",
);

type Props = {
	params: Promise<{ slug: string }>;
	searchParams: Promise<{
		token?: string;
		customerCode?: string;
	}>;
};

export default async function OrderSuccessPage({ params, searchParams }: Props) {
	const { slug } = await params;
	const resolvedSearchParams = await searchParams;
	const { token, customerCode } = resolvedSearchParams;

	if (!token) {
		redirect(`/${slug}`);
	}

	const [tenantResponse, orderResponse] = await Promise.all([
		tenantsService.getPublicTenant(slug),
		ordersService.getOrderByPublicToken(token),
	]);
	if (
		!tenantResponse.success ||
		!tenantResponse.data ||
		!orderResponse.success ||
		!orderResponse.data ||
		orderResponse.data.tenant_id !== tenantResponse.data.id
	) {
		notFound();
	}

	return (
		<div className="mx-auto min-h-screen w-full max-w-md overflow-x-hidden bg-background relative">
			<CustomerAnalytics
				pageLocation={`/${encodeURIComponent(slug)}/success`}
				pageTitle="تم إرسال الطلب"
			/>
			<OrderSuccessView
				tenantSlug={slug}
				orderToken={token}
				customerAccessCode={customerCode}
				clearStorefrontCartOnMount
				scheduledDeliveryLabel={
					orderResponse.data.scheduled_delivery_date
						? orderResponse.data.delivery_time_window_snapshot
						: null
				}
			/>
		</div>
	);
}
