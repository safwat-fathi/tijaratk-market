export const dynamic = "force-dynamic";

import Link from "next/link";

import {
	listTrackedOrdersFromCookie,
	getSavedAccessCodesFromCookie,
} from "@/lib/tracking/customer-tracking-cookie";
import { ordersService } from "@/services/api/orders.service";
import { Card } from "@/components/ui/Card";
import CustomerAccessOrdersLookup from "./CustomerAccessOrdersLookup";

export const metadata = {
	title: "تتبع طلباتي",
	description: "تابع جميع طلباتك السابقة وحالتها الحالية من جميع المتاجر في مكان واحد بكل سهولة وبدون الحاجة لتسجيل دخول.",
	robots: {
		index: false,
		follow: false,
	},
};

async function getTrackedOrders() {
	const trackedItems = await listTrackedOrdersFromCookie();
	if (trackedItems.length === 0) {
		return { trackedItems, ordersByToken: {}, hasError: false };
	}

	const response = await ordersService.getOrdersByPublicTokens(
		trackedItems.map(item => item.token),
	);

	if (!response.success || !response.data) {
		return { trackedItems, ordersByToken: {}, hasError: true };
	}

	const ordersByTokenObj = Object.fromEntries(
		response.data.map(order => [order.public_token, order]),
	);

	return { trackedItems, ordersByToken: ordersByTokenObj, hasError: false };
}

export default async function TrackOrdersPage() {
	const { trackedItems, ordersByToken, hasError } = await getTrackedOrders();
	const savedCodes = await getSavedAccessCodesFromCookie();

	return (
		<div className="mx-auto w-full max-w-3xl px-4 py-8">
			<Card className="relative overflow-hidden p-6">
				<div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-brand-soft blur-2xl" />
				<div className="pointer-events-none absolute -bottom-24 -left-20 h-56 w-56 rounded-full bg-brand-accent/10 blur-2xl" />

				<div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
							بدون تسجيل دخول
						</p>
						<h1 className="mt-2 text-3xl font-black tracking-tight text-brand-text">
							طلباتي
						</h1>
						<p className="mt-2 text-sm text-muted-foreground">
							كل طلب جديد ترسله من هذا الجهاز يظهر هنا تلقائياً.
						</p>
					</div>

					<div className="flex items-center gap-2">
						<Link
							href="/"
							className="inline-flex min-h-11 items-center justify-center rounded-md border border-brand-border bg-white px-4 py-2 text-sm font-semibold text-brand-text transition-colors hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/20"
						>
							المتاجر
						</Link>
					</div>
				</div>
			</Card>

			<CustomerAccessOrdersLookup
				initialTrackedItems={trackedItems}
				initialOrdersByToken={ordersByToken}
				hasError={hasError}
				initialSavedCodes={savedCodes}
			/>
		</div>
	);
}
