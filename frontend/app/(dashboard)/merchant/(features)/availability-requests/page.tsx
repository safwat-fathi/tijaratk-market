import { getAvailabilityRequestsPageAction } from "@/actions/availability-requests-actions";
import { createNoIndexMetadata } from "@/lib/marketing-seo";
import AvailabilityRequestsView from "./_components/AvailabilityRequestsView";

export const metadata = createNoIndexMetadata(
	"طلبات توفير المنتجات",
	"متابعة طلبات العملاء للمنتجات غير المتاحة أو غير الموجودة في المتجر.",
);

export const dynamic = "force-dynamic";

type AvailabilityRequestsPageProps = {
	searchParams: Promise<{
		page?: string;
		date?: string;
		item_name?: string;
		sort_by?: "date" | "name";
		sort_order?: "asc" | "desc";
	}>;
};

const parsePage = (value?: string) => {
	const parsed = Number(value);
	return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
};

export default async function AvailabilityRequestsPage({
	searchParams,
}: AvailabilityRequestsPageProps) {
	const params = await searchParams;
	const sortBy = params.sort_by === "name" ? "name" : "date";
	const sortOrder = params.sort_order === "asc" ? "asc" : "desc";
	const page = parsePage(params.page);
	const itemName = params.item_name?.trim() || undefined;
	const date = params.date?.trim() || undefined;

	const result = await getAvailabilityRequestsPageAction({
		page,
		limit: 20,
		date,
		item_name: itemName,
		sort_by: sortBy,
		sort_order: sortOrder,
	});

	return (
		<AvailabilityRequestsView
			initialRequests={result.data}
			meta={result.meta}
			initialDate={date || ""}
			initialItemName={itemName || ""}
			initialSortBy={sortBy}
			initialSortOrder={sortOrder}
			initialError={result.success ? undefined : result.message}
		/>
	);
}
