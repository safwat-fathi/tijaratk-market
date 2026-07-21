import { ordersService } from "@/services/api/orders.service";
import OrdersView from "./_components/OrdersView";
import { isNextRedirectError } from "@/lib/auth/navigation-errors";
import { createNoIndexMetadata } from "@/lib/marketing-seo";
import { assignedOrdersService } from "@/services/api/assigned-orders.service";
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
	assigned_counts: { pending: 0, accepted: 0, total: 0 },
	new_orders_count: 0,
};

const VALID_TABS = new Set<string>([
	...Object.values(OrderStatus),
	"assigned",
]);

const normalizeTab = (tab?: string): OrdersTab =>
	tab && VALID_TABS.has(tab) ? (tab as OrdersTab) : OrderStatus.DRAFT;

export default async function OrdersPage({
	searchParams,
}: {
	searchParams: Promise<{ date?: string; tab?: string }>;
}) {
	const { date, tab } = await searchParams;

	// Use today's date in Cairo timezone if date is not provided
	const effectiveDate =
		date ||
		new Date(
			new Date().toLocaleString("en-US", { timeZone: "Africa/Cairo" }),
		)
			.toISOString()
			.split("T")[0];

	const [orders, assignedResponse, summaryResponse] = await Promise.all([
		getOrders(effectiveDate),
		assignedOrdersService.getAssignedOrders(),
		ordersService.getInboxSummary(effectiveDate),
	]);
	const assignedOrders = assignedResponse.data?.filter(Boolean) ?? [];
	const inboxSummary =
		summaryResponse.success && summaryResponse.data
			? summaryResponse.data
			: EMPTY_INBOX_SUMMARY;

	return (
		<OrdersView
			key={normalizeTab(tab)}
			initialOrders={orders}
			initialAssignedOrders={assignedOrders}
			inboxSummary={inboxSummary}
			initialTab={normalizeTab(tab)}
			selectedDate={date}
		/>
	);
}
