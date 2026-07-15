import { notFound, redirect } from "next/navigation";
import OrderSuccessView from "../_components/OrderSuccessView";
import { tenantsService } from "@/services/api/tenants.service";
import { createNoIndexMetadata } from "@/lib/marketing-seo";
import CustomerAnalytics from "@/components/analytics/CustomerAnalytics";
import {
	buildCustomerAnalyticsPageLocation,
	type CustomerAnalyticsSearchParams,
} from "@/lib/analytics/google-analytics";

export const metadata = createNoIndexMetadata(
	"تم إرسال الطلب",
	"صفحة تأكيد طلب خاصة بالعميل وليست مخصصة للفهرسة.",
);

type Props = {
	params: Promise<{ slug: string }>;
	searchParams: Promise<
		CustomerAnalyticsSearchParams & {
			token?: string;
			customerCode?: string;
		}
	>;
};

export default async function OrderSuccessPage({ params, searchParams }: Props) {
	const { slug } = await params;
	const resolvedSearchParams = await searchParams;
	const { token, customerCode } = resolvedSearchParams;

	if (!token) {
		redirect(`/${slug}`);
	}

	const response = await tenantsService.getPublicTenant(slug);
	if (!response.success || !response.data) {
		notFound();
	}

	return (
		<div className="mx-auto min-h-screen w-full max-w-md overflow-x-hidden bg-background relative">
			<CustomerAnalytics
				pageLocation={buildCustomerAnalyticsPageLocation(
					`/${encodeURIComponent(slug)}/success`,
					resolvedSearchParams,
				)}
				pageTitle="تم إرسال الطلب"
			/>
			<OrderSuccessView
				tenantSlug={slug}
				orderToken={token}
				customerAccessCode={customerCode}
			/>
		</div>
	);
}
