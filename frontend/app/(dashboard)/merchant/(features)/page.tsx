import { getCookieAction } from "@/app/actions/cookie-store";
import { STORAGE_KEYS } from "@/constants";
import { ordersService } from "@/services/api/orders.service";
import { tenantsService } from "@/services/api/tenants.service";
import { availabilityRequestsService } from "@/services/api/availability-requests.service";
import { OrderStatus } from "@/types/enums";
import { DayCloseTodayStatusResponse } from "@/types/services/orders";
import { MerchantAvailabilitySummaryResponse } from "@/types/services/availability-requests";
import TodaySnapshot from "./_components/TodaySnapshot";
import EndOfDayTeaser from "./_components/EndOfDayTeaser";
import StorefrontLinkCard from "./_components/StorefrontLinkCard";
import AvailabilityRequestsCard from "./_components/AvailabilityRequestsCard";
import DeliverySettingsCard from "./_components/DeliverySettingsCard";
import { DashboardStats } from "./_components/dashboard.types";
import { createNoIndexMetadata } from "@/lib/marketing-seo";

export const metadata = createNoIndexMetadata(
	"لوحة التحكم",
	"نظرة عامة على نشاط متجرك، الطلبات اليومية، وحالة المبيعات.",
);

function isToday(dateString: string): boolean {
	const date = new Date(dateString);
	const today = new Date();
	return (
		date.getDate() === today.getDate() &&
		date.getMonth() === today.getMonth() &&
		date.getFullYear() === today.getFullYear()
	);
}

export default async function Dashboard() {
	const userCookie = await getCookieAction(STORAGE_KEYS.USER);
	const user = userCookie ? JSON.parse(userCookie) : null;
	const name = user?.name || "تاجر";

	const [ordersResponse, tenantResponse, dayCloseStatusResponse, availabilityResponse] =
		await Promise.all([
			ordersService.getOrders(),
			tenantsService.getMyTenant(),
			ordersService.getTodayDayCloseStatus(),
			availabilityRequestsService.getMerchantSummary({ days: 1, limit: 5 }),
		]);

	const allOrders =
		ordersResponse.success && ordersResponse.data ? ordersResponse.data : [];
	const tenantSlug =
		tenantResponse.success && tenantResponse.data
			? tenantResponse.data.slug
			: undefined;
	const tenant = tenantResponse.success ? tenantResponse.data : undefined;

	// 1. Process Today's Snapshot
	const todayOrders = allOrders.filter(o => isToday(o.created_at));

	const stats: DashboardStats = {
		totalEgp: todayOrders.reduce((sum, o) => sum + Number(o.total || 0), 0),
		ordersCount: todayOrders.length,
		pendingOrdersCount: todayOrders.filter(
			o => o.status === OrderStatus.DRAFT || o.status === OrderStatus.CONFIRMED,
		).length,
		deliveryFees: todayOrders.reduce(
			(sum, o) => sum + Number(o.delivery_fee || 0),
			0,
		),
	};

	const dayCloseStatusFallback: DayCloseTodayStatusResponse = {
		is_closed: false,
		closure: null,
		preview: {
			orders_count: stats.ordersCount,
			cancelled_count: todayOrders.filter(
				o =>
					o.status === OrderStatus.CANCELLED ||
					o.status === OrderStatus.REJECTED_BY_CUSTOMER,
			).length,
			completed_sales_total: todayOrders
				.filter(o => o.status === OrderStatus.COMPLETED)
				.reduce((sum, o) => sum + Number(o.total || 0), 0),
		},
	};

	const dayCloseStatus =
		dayCloseStatusResponse.success && dayCloseStatusResponse.data
			? dayCloseStatusResponse.data
			: dayCloseStatusFallback;

	const availabilitySummaryFallback: MerchantAvailabilitySummaryResponse = {
		today_total_requests: 0,
		top_products: [],
	};

	const availabilitySummary =
		availabilityResponse.success && availabilityResponse.data
			? availabilityResponse.data
			: availabilitySummaryFallback;

	return (
		<div className="flex flex-col gap-6 pb-20">
			{/* Header / Welcome - Minimal */}
			<div className="flex justify-between items-center">
				<h1 className="text-2xl font-bold tracking-tight">
					{new Date().getHours() < 12 ? "صباح الخير" : "مساء الخير"} {name}
				</h1>
			</div>
			<StorefrontLinkCard slug={tenantSlug} />

			{/* 1. Today Snapshot */}
			<TodaySnapshot stats={stats} />
			<AvailabilityRequestsCard summary={availabilitySummary} />

			{/* 2. Action Center */}
			{/* <ActionCenter items={actionItems} /> */}

			{/* 4. Quick Actions */}
			{/* <QuickActions /> */}

			{/* 3. Latest Orders */}
			{/* <LatestOrders orders={latestOrdersData} /> */}

			{/* 6. End-of-Day Teaser */}
			<DeliverySettingsCard tenant={tenant} />
			<EndOfDayTeaser initialStatus={dayCloseStatus} />
		</div>
	);
}
