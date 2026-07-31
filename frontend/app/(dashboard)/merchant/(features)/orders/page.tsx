import { ordersService } from "@/services/api/orders.service";
import { getInboxSummaryCached } from "@/lib/server/dashboard-request-cache";
import OrdersView from "./_components/OrdersView";
import { isNextRedirectError } from "@/lib/auth/navigation-errors";
import { createNoIndexMetadata } from "@/lib/marketing-seo";
import { OrderStatus } from "@/types/enums";
import type { MerchantOrderInboxSummary } from "@/types/services/orders";
import type { OrdersTab } from "./_components/StatusTabs";

export const metadata = createNoIndexMetadata(
	"إدارة الطلبات",
	"تتبع وإدارة جميع طلبات عملائك من مكان واحد بكل كفاءة.",
);

export const dynamic = "force-dynamic";

async function getOrders(date?: string) {
	try {
		const response = await ordersService.getOrders(date);
		if (response.success && response.data) {
			return response.data;
		}
		return [];
	} catch (error) {
		if (isNextRedirectError(error)) {
			throw error;
		}
		console.error("Failed to fetch orders", error);
		return [];
	}
}

const EMPTY_INBOX_SUMMARY: MerchantOrderInboxSummary = {
	owned_status_counts: {
		[OrderStatus.DRAFT]: 0,
		[OrderStatus.CONFIRMED]: 0,
		[OrderStatus.OUT_FOR_DELIVERY]: 0,
		[OrderStatus.COMPLETED]: 0,
		[OrderStatus.CANCELLED]: 0,
		[OrderStatus.REJECTED_BY_CUSTOMER]: 0,
	},
	new_orders_count: 0,
};

const VALID_TABS = new Set<string>(Object.values(OrderStatus));

const normalizeTab = (tab: string | undefined): OrdersTab =>
	tab && VALID_TABS.has(tab) ? (tab as OrdersTab) : OrderStatus.DRAFT;

export default async function OrdersPage({
	searchParams,
}: {
	searchParams: Promise<{ date?: string; tab?: string }>;
}) {
	const { date, tab } = await searchParams;

	const [orders, summaryResponse] = await Promise.all([
		getOrders(date),
		getInboxSummaryCached(date),
	]);
	const inboxSummary =
		summaryResponse.success && summaryResponse.data
			? summaryResponse.data
			: EMPTY_INBOX_SUMMARY;

	return (
		<OrdersView
			key={normalizeTab(tab)}
			initialOrders={orders}
			inboxSummary={inboxSummary}
			initialTab={normalizeTab(tab)}
			selectedDate={date}
		/>
	);
}
