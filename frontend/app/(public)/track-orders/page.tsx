import Link from "next/link";

import { clearTrackedOrdersAction } from "@/actions/order-tracking-actions";
import { formatCurrency } from "@/lib/utils/currency";
import {
	listTrackedOrdersFromCookie,
	type TrackedOrderCookieItem,
} from "@/lib/tracking/customer-tracking-cookie";
import { ordersService } from "@/services/api/orders.service";
import type { Order } from "@/types/models/order";
import { OrderStatus } from "@/types/enums";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";

export const metadata = {
	title: "تتبع طلباتي",
	description: "تابع جميع طلباتك السابقة وحالتها الحالية من جميع المتاجر في مكان واحد بكل سهولة وبدون الحاجة لتسجيل دخول.",
	robots: {
		index: false,
		follow: false,
	},
};

const statusConfig: Record<
	OrderStatus,
	{ label: string; className: string; hint: string }
> = {
	[OrderStatus.DRAFT]: {
		label: "قيد المراجعة",
		className: "",
		hint: "المتجر يراجع الطلب حالياً.",
	},
	[OrderStatus.CONFIRMED]: {
		label: "تم التأكيد",
		className: "",
		hint: "تم تأكيد الطلب ويجري التجهيز.",
	},
	[OrderStatus.OUT_FOR_DELIVERY]: {
		label: "خرج للتوصيل",
		className: "",
		hint: "الطلب في الطريق إليك.",
	},
	[OrderStatus.COMPLETED]: {
		label: "مكتمل",
		className: "",
		hint: "تم توصيل الطلب بنجاح.",
	},
	[OrderStatus.CANCELLED]: {
		label: "ملغي",
		className: "",
		hint: "تم إلغاء الطلب.",
	},
	[OrderStatus.REJECTED_BY_CUSTOMER]: {
		label: "مرفوض من العميل",
		className: "",
		hint: "تم رفض الطلب من العميل.",
	},
};

const statusConfigMap = new Map(
	Object.entries(statusConfig) as Array<
		[OrderStatus, { label: string; className: string; hint: string }]
	>,
);

function getStatusMeta(status: OrderStatus) {
	return statusConfigMap.get(status) ?? statusConfigMap.get(OrderStatus.DRAFT)!;
}

function formatOrderDate(value?: string) {
	if (!value) return "غير متوفر";
	return new Date(value).toLocaleString("ar-EG");
}

async function getTrackedOrders() {
	const trackedItems = await listTrackedOrdersFromCookie();
	if (trackedItems.length === 0) {
		return { trackedItems, ordersByToken: new Map<string, Order>(), hasError: false };
	}

	const response = await ordersService.getOrdersByPublicTokens(
		trackedItems.map(item => item.token),
	);

	if (!response.success || !response.data) {
		return { trackedItems, ordersByToken: new Map<string, Order>(), hasError: true };
	}

	const ordersByToken = new Map(
		response.data.map(order => [order.public_token, order]),
	);

	return { trackedItems, ordersByToken, hasError: false };
}

function resolveOrder(
	item: TrackedOrderCookieItem,
	ordersByToken: Map<string, Order>,
) {
	return ordersByToken.get(item.token);
}

export default async function TrackOrdersPage() {
	const { trackedItems, ordersByToken, hasError } = await getTrackedOrders();

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
						{trackedItems.length > 0 && (
							<form action={clearTrackedOrdersAction}>
								<button
									type="submit"
									className="inline-flex min-h-11 items-center justify-center rounded-md border border-status-error/20 bg-status-error/10 px-4 py-2 text-sm font-semibold text-status-error transition-colors hover:bg-status-error/15 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-status-error/20"
								>
									مسح الطلبات
								</button>
							</form>
						)}
					</div>
				</div>
			</Card>

			{hasError && (
				<div className="mt-4 rounded-lg border border-status-warning/30 bg-status-warning/20 px-4 py-3 text-sm text-amber-900">
					تعذر تحميل الطلبات حالياً. أعد المحاولة بعد قليل.
				</div>
			)}

			{trackedItems.length === 0 ? (
				<Card className="mt-6 p-8 text-center">
					<EmptyState
						title="لا توجد طلبات محفوظة بعد"
						description="بعد إرسال أول طلب من أي متجر، ستجده هنا مباشرة لتتبع حالته."
						icon={
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="24"
							height="24"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
							aria-hidden="true"
						>
							<path d="M8 18h8" />
							<path d="M8 14h8" />
							<path d="M8 10h8" />
							<rect width="18" height="20" x="3" y="2" rx="2" />
						</svg>
						}
					/>
				</Card>
			) : (
				<div className="mt-6 space-y-4">
					{trackedItems.map(item => {
						const order = resolveOrder(item, ordersByToken);
						const status = order?.status ?? OrderStatus.DRAFT;
							const statusMeta = getStatusMeta(status);
						const displayDate = order?.created_at ?? item.created_at;
						const storeSlug = order?.tenant?.slug ?? item.slug;
						const storeName = order?.tenant?.name || "المتجر";
						const totalText =
							order?.total !== null && order?.total !== undefined
								? formatCurrency(Number(order.total) || 0)
								: "يتم تأكيد السعر";

						return (
							<Card
								key={item.token}
								className="group overflow-hidden p-5 transition-transform hover:-translate-y-0.5"
							>
								<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
									<div>
										<p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
											{storeName}
										</p>
										<h2 className="mt-2 text-lg font-bold text-brand-text">
											طلب بتاريخ {formatOrderDate(displayDate)}
										</h2>
										<p className="mt-1 text-sm text-muted-foreground">{statusMeta.hint}</p>
										<p className="mt-2 text-xs font-medium text-muted-foreground">
											رقم التتبع: {item.token}
										</p>
									</div>

									<div className="flex flex-col items-start gap-2 sm:items-end">
										<StatusBadge status={status} label={statusMeta.label} />
										<p className="text-sm font-semibold text-brand-text">{totalText}</p>
									</div>
								</div>

								<div className="mt-5 flex flex-col gap-2 sm:flex-row">
									<Link
										href={`/track-order/${item.token}`}
										className="inline-flex min-h-11 flex-1 items-center justify-center rounded-md bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-primary-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/20"
									>
										تفاصيل التتبع
									</Link>
									<Link
										href={`/${storeSlug}?reorder=${item.token}`}
										className="inline-flex min-h-11 flex-1 items-center justify-center rounded-md border border-brand-border bg-white px-4 py-2.5 text-sm font-semibold text-brand-text transition-colors hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/20"
									>
										إعادة الطلب
									</Link>
								</div>
							</Card>
						);
					})}
				</div>
			)}
		</div>
	);
}
