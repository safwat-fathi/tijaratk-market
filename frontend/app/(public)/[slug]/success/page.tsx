import { notFound, redirect } from "next/navigation";
import OrderSuccessView from "../_components/OrderSuccessView";
import { tenantsService } from "@/services/api/tenants.service";
import { createNoIndexMetadata } from "@/lib/marketing-seo";

export const metadata = createNoIndexMetadata(
	"تم إرسال الطلب",
	"صفحة تأكيد طلب خاصة بالعميل وليست مخصصة للفهرسة.",
);

type Props = {
	params: Promise<{ slug: string }>;
	searchParams: Promise<{ token?: string; customerCode?: string }>;
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
			<OrderSuccessView
				tenantSlug={slug}
				orderToken={token}
				customerAccessCode={customerCode}
			/>
		</div>
	);
}
