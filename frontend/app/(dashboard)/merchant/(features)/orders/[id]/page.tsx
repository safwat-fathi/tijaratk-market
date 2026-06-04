import Link from "next/link";
import { revalidatePath } from "next/cache";
import { ordersService } from "@/services/api/orders.service";
import { productsService } from "@/services/api/products.service";
import { OrderStatus } from "@/types/enums";
import OrderItemsReplacement from "./_components/OrderItemsReplacement";
import { isNextRedirectError } from "@/lib/auth/navigation-errors";
import { formatCurrency } from "@/lib/utils/currency";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";

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

	const [orderResponse, productsResponse] = await Promise.all([
		ordersService.getOrder(Number(id)),
		productsService.getProducts(),
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
	const products =
		productsResponse.success && productsResponse.data
			? productsResponse.data
			: [];

	async function updateStatus(newStatus: OrderStatus) {
		"use server";

		try {
			await ordersService.updateOrder(Number(id), { status: newStatus });
			revalidatePath(`/merchant/orders/${id}`);
			revalidatePath("/merchant/orders");
		} catch (error) {
			if (isNextRedirectError(error)) {
				throw error;
			}
			console.error("Update failed", error);
		}
	}

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

					{customer.address && (
						<div className="mt-3 rounded-md bg-brand-soft/60 p-3 text-sm text-brand-text">
							📍 {customer.address}
						</div>
					)}
				</Card>

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

				{order.notes && (
					<section className="rounded-lg border border-status-warning/30 bg-status-warning/20 p-4 shadow-soft">
						<p className="text-sm text-amber-900">
							<strong>ملاحظة:</strong> {order.notes}
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
			</div>

			<div className="safe-bottom-padding fixed bottom-0 left-0 right-0 border-t border-brand-border bg-white p-4 shadow-float">
				<div className="mx-auto flex max-w-md gap-3">
					{order.status === OrderStatus.DRAFT && (
						<>
							<form
								action={updateStatus.bind(null, OrderStatus.CANCELLED)}
								className="flex-1"
							>
								<Button type="submit" variant="secondary" className="w-full">
									رفض الطلب
								</Button>
							</form>
							<form
								action={updateStatus.bind(null, OrderStatus.CONFIRMED)}
								className="flex-[2]"
							>
								<Button type="submit" className="w-full">
									تأكيد الطلب
								</Button>
							</form>
						</>
					)}

					{order.status === OrderStatus.CONFIRMED && (
						<form
							action={updateStatus.bind(null, OrderStatus.OUT_FOR_DELIVERY)}
							className="w-full"
						>
							<Button type="submit" className="w-full bg-status-warning text-brand-text hover:bg-status-warning/90">
								تأكيد التوصيل
							</Button>
						</form>
					)}

					{order.status === OrderStatus.OUT_FOR_DELIVERY && (
						<form
							action={updateStatus.bind(null, OrderStatus.COMPLETED)}
							className="w-full"
						>
							<Button type="submit" className="w-full bg-status-completed hover:bg-status-completed/90">
								تم التوصيل
							</Button>
						</form>
					)}

					{(order.status === OrderStatus.COMPLETED ||
						order.status === OrderStatus.CANCELLED ||
						order.status === OrderStatus.REJECTED_BY_CUSTOMER) && (
						<div className="w-full py-2 text-center font-medium text-muted-foreground">
							حالة الطلب: {statusLabelMap[order.status] || order.status}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
