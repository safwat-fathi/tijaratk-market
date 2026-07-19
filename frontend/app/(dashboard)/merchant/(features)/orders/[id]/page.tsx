import Link from "next/link";
import { ordersService } from "@/services/api/orders.service";
import { productsService } from "@/services/api/products.service";
import { activityLogsService } from "@/services/api/activity-logs.service";
import { OrderStatus } from "@/types/enums";
import OrderItemsReplacement from "./_components/OrderItemsReplacement";
import OrderDetailsActions from "./_components/OrderDetailsActions";
import { ActivityTimeline } from "@/components/activity/ActivityTimeline";
import { formatCurrency } from "@/lib/utils/currency";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getImageUrl } from "@/lib/utils/image";
import ImageThumbnail from "@/components/ui/ImageThumbnail";
import {
	formatPrescriptionUnavailabilityAction,
} from "@/lib/orders/prescription-unavailability";
import { formatUnavailableItemAction } from "@/lib/orders/unavailable-item-action";

const statusLabelMap: Record<OrderStatus, string> = {
	[OrderStatus.DRAFT]: "جديد",
	[OrderStatus.CONFIRMED]: "مؤكد",
	[OrderStatus.OUT_FOR_DELIVERY]: "خرج للتوصيل",
	[OrderStatus.COMPLETED]: "اكتمل",
	[OrderStatus.CANCELLED]: "ملغي",
	[OrderStatus.REJECTED_BY_CUSTOMER]: "مرفوض من العميل",
};

export const dynamic = "force-dynamic";

export async function generateMetadata({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	return {
		title: `تفاصيل الطلب #${id}`,
		description: `عرض وتعديل تفاصيل الطلب رقم ${id} وإدارة حالته.`,
		robots: {
			index: false,
			follow: false,
		},
	};
}

export default async function OrderDetailsPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;

	const orderId = Number(id);

	const [orderResponse, productsResponse, logsResponse] = await Promise.all([
		ordersService.getOrder(orderId),
		productsService.getProducts(),
		activityLogsService.getActivityLogs({
			entity_type: "order",
			entity_id: orderId,
			limit: 20,
		}),
	]);

	if (!orderResponse.success || !orderResponse.data) {
		return (
			<div className="p-8 text-center text-status-error">
				{orderResponse.message}
			</div>
		);
	}

	const order = orderResponse.data;
	const customer = order.customer || {};
	const deliveryAreaLabel =
		order.delivery_area?.name_ar || order.delivery_area?.name_en || null;
	const prescriptionUnavailabilityLabel =
		formatPrescriptionUnavailabilityAction(
			order.prescription_unavailability_action,
		);
	const unavailableItemActionLabel = formatUnavailableItemAction(
		order.unavailable_item_action,
	);
	const products =
		productsResponse.success && productsResponse.data
			? productsResponse.data
			: [];
	const activityLogs =
		logsResponse.success && logsResponse.data ? logsResponse.data.items : [];

	return (
		<div className="flex min-h-screen flex-col bg-background">
			<div className="sticky top-0 z-10 flex items-center gap-3 border-b border-brand-border bg-white px-4 py-3 shadow-soft">
				<Link
					href="/merchant/orders"
					className="inline-flex min-h-10 items-center gap-2 rounded-md px-2 py-1 text-sm font-medium text-muted-foreground transition-colors hover:bg-brand-soft hover:text-brand-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/20"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						strokeWidth={2}
						stroke="currentColor"
						className="h-5 w-5 rtl:rotate-180"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
						/>
					</svg>
					<span className="whitespace-nowrap">الرجوع الى الطلبات</span>
				</Link>

				<h1 className="text-lg font-bold text-brand-text">الطلب #{order.id}</h1>

				<StatusBadge className="ms-auto" status={order.status} label={statusLabelMap[order.status] || order.status} />
			</div>

			<div className="flex-1 space-y-4 p-4 pb-24">
				<Card className="p-4">
					<h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
						معلومات العميل
					</h2>

					<div className="flex items-center gap-4">
						<div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft text-lg font-bold text-brand-primary">
							{(customer.name?.[0] || "C").toUpperCase()}
						</div>
						<div>
							<p className="font-bold text-brand-text">
								{customer.name || "Unknown"}
							</p>
							<a
								href={`tel:${customer.phone}`}
								className="mt-0.5 text-sm font-medium text-brand-primary hover:text-brand-primary-hover"
							>
								{customer.phone}
							</a>
						</div>
					</div>

					{(deliveryAreaLabel || customer.address) && (
						<div className="mt-3 space-y-1 rounded-md bg-brand-soft/60 p-3 text-sm text-brand-text">
							{deliveryAreaLabel && <p>📍 المنطقة: {deliveryAreaLabel}</p>}
							{customer.address && <p>العنوان: {customer.address}</p>}
						</div>
					)}
				</Card>

				{order.scheduled_delivery_date &&
				order.delivery_time_window_snapshot ? (
					<Card className="border-amber-200 bg-amber-50 p-4">
						<h2 className="text-sm font-semibold text-amber-800">
							موعد التوصيل المجدول
						</h2>
						<p className="mt-1 font-bold text-amber-950">
							{order.delivery_time_window_snapshot}
						</p>
					</Card>
				) : null}

				<OrderItemsReplacement
					orderId={order.id}
					orderStatus={order.status}
					initialItems={order.items || []}
					products={products}
				/>

				{order.free_text_payload?.text && (
					<Card className="p-4">
						<h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
							طلب نصي
						</h2>
						<p className="whitespace-pre-wrap rounded-md bg-brand-soft/60 p-3 text-sm text-brand-text">
							{order.free_text_payload.text}
						</p>
					</Card>
				)}

				{order.prescription_file_url && (
					<Card className="p-4">
						<h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
							الوصفة الطبية
						</h2>
						{prescriptionUnavailabilityLabel && (
							<div className="mb-3 rounded-md border border-brand-accent/20 bg-brand-soft/40 p-3 text-sm text-brand-text">
								<span className="font-semibold text-brand-primary">
									في حالة عدم التوفر:
								</span>{" "}
								{prescriptionUnavailabilityLabel}
							</div>
						)}
						{order.prescription_mime_type?.startsWith("image/") ? (
							<div className="relative mt-2 flex justify-center w-full overflow-hidden rounded-md border border-brand-border bg-brand-soft/20">
								<ImageThumbnail
									src={getImageUrl(order.prescription_file_url)}
									alt="Prescription"
									imageClassName="max-h-96 object-contain"
									thumbnailWrapperClassName="block max-h-96 w-full"
									fallback={<span className="text-gray-500">لا توجد صورة</span>}
								/>
							</div>
						) : (
							<a
								href={getImageUrl(order.prescription_file_url)}
								target="_blank"
								rel="noopener noreferrer"
								className="mt-2 flex items-center gap-2 rounded-md border border-brand-accent/20 bg-brand-soft/20 p-3 text-brand-primary hover:bg-brand-soft/40 transition-colors"
							>
								<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
								  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
								</svg>
								<span className="font-medium text-sm">عرض الوصفة الطبية</span>
							</a>
						)}
					</Card>
				)}

				{order.notes && (
					<section className="rounded-lg border border-status-warning/30 bg-status-warning/20 p-4 shadow-soft">
						<p className="text-sm text-amber-900">
							<strong>ملاحظة:</strong> {order.notes}
						</p>
					</section>
				)}

				{order.card_on_delivery_requested && (
					<section className="rounded-lg border border-brand-accent/30 bg-brand-soft p-4 shadow-soft">
						<p className="text-sm font-semibold text-brand-primary">
							العميل طلب الدفع بالكارت مع التوصيل.
						</p>
					</section>
				)}

				{unavailableItemActionLabel && (
					<section className="rounded-lg border border-brand-accent/30 bg-brand-soft p-4 shadow-soft">
						<p className="text-sm text-brand-text">
							<strong className="text-brand-primary">
								في حالة عدم توفر منتج:
							</strong>{" "}
							{unavailableItemActionLabel}
						</p>
					</section>
				)}

				{order.merchant_cancellation_reason && (
					<section className="rounded-lg border border-status-error/20 bg-status-error/10 p-4 shadow-soft">
						<p className="text-sm text-status-error">
							<strong>سبب إلغاء التاجر:</strong>{" "}
							{order.merchant_cancellation_reason}
						</p>
					</section>
				)}

				{order.customer_rejection_reason && (
					<section className="rounded-lg border border-status-error/20 bg-status-error/10 p-4 shadow-soft">
						<p className="text-sm text-status-error">
							<strong>سبب رفض العميل:</strong> {order.customer_rejection_reason}
						</p>
					</section>
				)}

				<Card className="p-4">
					<div className="space-y-2">
						<div className="flex justify-between text-sm text-muted-foreground">
							<span>الإجمالي الفرعي</span>
							<span>
								{order.subtotal !== null && order.subtotal !== undefined
									? formatCurrency(order.subtotal) || "غير محدد"
									: "غير محدد"}
							</span>
						</div>

						<div className="flex justify-between text-sm text-muted-foreground">
							<span>رسوم التوصيل</span>
							<span>{formatCurrency(order.delivery_fee) || "غير محدد"}</span>
						</div>

						<div className="flex items-end justify-between border-t border-brand-border pt-3">
							<span className="font-bold text-brand-text">الإجمالي</span>
							<span className="text-xl font-bold text-brand-text">
								{order.total !== null && order.total !== undefined
									? formatCurrency(order.total) || "غير محدد"
									: "غير محدد"}
							</span>
						</div>
					</div>
				</Card>

				<section>
					<h2 className="mb-3 text-lg font-semibold text-brand-text">
						سجل الطلب
					</h2>
					<ActivityTimeline
						items={activityLogs}
						emptyMessage="لا يوجد نشاط مسجل لهذا الطلب حتى الآن"
					/>
				</section>
			</div>

			<OrderDetailsActions
				orderId={order.id}
				status={order.status}
				statusLabel={statusLabelMap[order.status] || order.status}
			/>
		</div>
	);
}
