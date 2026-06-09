"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import type {
	MerchantAvailabilityRequestItem,
	MerchantAvailabilityRequestsMeta,
} from "@/types/services/availability-requests";

type AvailabilityRequestsViewProps = {
	initialRequests: MerchantAvailabilityRequestItem[];
	meta: MerchantAvailabilityRequestsMeta;
	initialDate: string;
	initialItemName: string;
	initialSortBy: "date" | "name";
	initialSortOrder: "asc" | "desc";
	initialError?: string;
};

const formatDateTime = (value: string) => {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return "";
	}

	return new Intl.DateTimeFormat("ar-EG", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(date);
};

const buildHref = ({
	page,
	date,
	itemName,
	sortBy,
	sortOrder,
}: {
	page?: number;
	date: string;
	itemName: string;
	sortBy: "date" | "name";
	sortOrder: "asc" | "desc";
}) => {
	const params = new URLSearchParams();
	if (page && page > 1) params.set("page", String(page));
	if (date) params.set("date", date);
	if (itemName) params.set("item_name", itemName);
	params.set("sort_by", sortBy);
	params.set("sort_order", sortOrder);

	const query = params.toString();
	return query ? `/merchant/availability-requests?${query}` : "/merchant/availability-requests";
};

export default function AvailabilityRequestsView({
	initialRequests,
	meta,
	initialDate,
	initialItemName,
	initialSortBy,
	initialSortOrder,
	initialError,
}: AvailabilityRequestsViewProps) {
	const router = useRouter();
	const [date, setDate] = useState(initialDate);
	const [itemName, setItemName] = useState(initialItemName);
	const [sortBy, setSortBy] = useState(initialSortBy);
	const [sortOrder, setSortOrder] = useState(initialSortOrder);

	const applyFilters = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		router.push(
			buildHref({
				date: date.trim(),
				itemName: itemName.trim(),
				sortBy,
				sortOrder,
			}),
		);
	};

	const clearHref = buildHref({
		date: "",
		itemName: "",
		sortBy: "date",
		sortOrder: "desc",
	});
	const previousHref = buildHref({
		page: Math.max(1, meta.page - 1),
		date: initialDate,
		itemName: initialItemName,
		sortBy: initialSortBy,
		sortOrder: initialSortOrder,
	});
	const nextHref = buildHref({
		page: meta.page + 1,
		date: initialDate,
		itemName: initialItemName,
		sortBy: initialSortBy,
		sortOrder: initialSortOrder,
	});

	return (
		<div className="min-h-screen bg-background pb-20">
			<div className="mb-4 rounded-2xl border border-brand-border bg-white p-4 shadow-soft">
				<div className="flex items-center justify-between gap-3">
					<div>
						<h1 className="text-xl font-bold text-brand-text">
							طلبات توفير المنتجات
						</h1>
						<p className="mt-1 text-sm text-muted-foreground">
							كل طلبات العملاء للمنتجات غير المتاحة أو غير الموجودة.
						</p>
					</div>
					<span className="rounded-full bg-brand-soft px-3 py-1 text-sm font-semibold text-brand-primary">
						{meta.total} طلب
					</span>
				</div>

				<form onSubmit={applyFilters} className="mt-4 grid gap-3 md:grid-cols-5">
					<label className="text-sm font-semibold text-brand-text md:col-span-2">
						اسم المنتج
						<input
							type="search"
							value={itemName}
							onChange={(event) => setItemName(event.target.value)}
							placeholder="ابحث باسم المنتج"
							className="mt-2 w-full rounded-xl border border-brand-border bg-white px-3 py-2 text-sm font-normal outline-none focus:border-brand-primary focus:ring-4 focus:ring-brand-accent/20"
						/>
					</label>
					<label className="text-sm font-semibold text-brand-text">
						التاريخ
						<input
							type="date"
							value={date}
							onChange={(event) => setDate(event.target.value)}
							className="mt-2 w-full rounded-xl border border-brand-border bg-white px-3 py-2 text-sm font-normal outline-none focus:border-brand-primary focus:ring-4 focus:ring-brand-accent/20"
						/>
					</label>
					<label className="text-sm font-semibold text-brand-text">
						ترتيب حسب
						<select
							value={sortBy}
							onChange={(event) => setSortBy(event.target.value as "date" | "name")}
							className="mt-2 w-full rounded-xl border border-brand-border bg-white px-3 py-2 text-sm font-normal outline-none focus:border-brand-primary focus:ring-4 focus:ring-brand-accent/20"
						>
							<option value="date">التاريخ</option>
							<option value="name">اسم المنتج</option>
						</select>
					</label>
					<label className="text-sm font-semibold text-brand-text">
						الاتجاه
						<select
							value={sortOrder}
							onChange={(event) =>
								setSortOrder(event.target.value as "asc" | "desc")
							}
							className="mt-2 w-full rounded-xl border border-brand-border bg-white px-3 py-2 text-sm font-normal outline-none focus:border-brand-primary focus:ring-4 focus:ring-brand-accent/20"
						>
							<option value="desc">تنازلي</option>
							<option value="asc">تصاعدي</option>
						</select>
					</label>
					<div className="flex gap-2 md:col-span-5">
						<button
							type="submit"
							className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-white"
						>
							تطبيق الفلاتر
						</button>
						<Link
							href={clearHref}
							className="rounded-xl border border-brand-border px-4 py-2 text-sm font-semibold text-brand-text"
						>
							مسح
						</Link>
					</div>
				</form>
			</div>

			{initialError && (
				<div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
					{initialError}
				</div>
			)}

			{initialRequests.length === 0 ? (
				<EmptyState
					title="لا توجد طلبات توفير"
					description="ستظهر هنا طلبات العملاء عند تسجيلها من المتجر."
				/>
			) : (
				<div className="space-y-3">
					{initialRequests.map((request) => (
						<article
							key={request.id}
							className="rounded-2xl border border-brand-border bg-white p-4 shadow-soft"
						>
							<div className="flex items-start justify-between gap-3">
								<div>
									<p className="text-base font-bold text-brand-text">
										{request.item_name}
									</p>
									<p className="mt-1 text-xs text-muted-foreground">
										{formatDateTime(request.requested_at)}
									</p>
								</div>
								<span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
									{request.product_id ? "منتج غير متاح" : "منتج غير موجود"}
								</span>
							</div>

							<div className="mt-3 rounded-xl bg-brand-soft/60 p-3 text-sm text-brand-text">
								<p className="font-semibold">
									{request.customer_name || "عميل غير معروف"}
								</p>
								{request.customer_phone && <p>{request.customer_phone}</p>}
								{request.customer_address && (
									<p className="mt-1 text-muted-foreground">
										{request.customer_address}
									</p>
								)}
								{request.customer_notes && (
									<p className="mt-1 text-muted-foreground">
										ملاحظات: {request.customer_notes}
									</p>
								)}
								{!request.customer_phone && !request.customer_address && (
									<p className="text-muted-foreground">لا توجد بيانات عميل.</p>
								)}
							</div>
						</article>
					))}
				</div>
			)}

			{meta.last_page > 1 && (
				<div className="mt-4 flex items-center justify-between gap-3">
					{meta.page > 1 ? (
						<Link
							href={previousHref}
							className="rounded-xl border border-brand-border bg-white px-4 py-2 text-sm font-semibold text-brand-text"
						>
							السابق
						</Link>
					) : (
						<span />
					)}
					<span className="text-sm text-muted-foreground">
						صفحة {meta.page} من {meta.last_page}
					</span>
					{meta.page < meta.last_page ? (
						<Link
							href={nextHref}
							className="rounded-xl border border-brand-border bg-white px-4 py-2 text-sm font-semibold text-brand-text"
						>
							التالي
						</Link>
					) : (
						<span />
					)}
				</div>
			)}
		</div>
	);
}
