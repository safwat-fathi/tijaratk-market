import { getCustomersPageAction } from "@/actions/customer-actions";
import CustomersView from "./_components/CustomersView";
import { createNoIndexMetadata } from "@/lib/marketing-seo";

export const metadata = createNoIndexMetadata(
	"قاعدة بيانات العملاء",
	"إدارة سجلات عملائك، متابعة نشاطهم وبناء علاقات قوية ومستدامة.",
);

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
	const initialResult = await getCustomersPageAction({
		page: 1,
		limit: 20,
	});

	return (
		<CustomersView
			initialCustomers={initialResult.data}
			initialPage={initialResult.meta.page}
			initialLastPage={initialResult.meta.last_page}
			initialError={initialResult.success ? undefined : initialResult.message}
			initialSearch=""
		/>
	);
}
