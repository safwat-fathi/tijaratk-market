"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useBodyScrollLock } from "@/lib/hooks/useBodyScrollLock";
import { useDragToClose } from "@/lib/hooks/useDragToClose";
import { formatCurrency } from "@/lib/utils/currency";
import { formatArabicInteger } from "@/lib/utils/number";
import type { Product } from "@/types/models/product";
import type { ProductCartSelection } from "./ProductList";
import { resolveSelectionLineTotal } from "../_utils/order-form";

type OrderReviewSheetProps = {
	isOpen: boolean;
	isPending: boolean;
	totalItems: number;
	estimatedTotal: number;
	hasPricedItems: boolean;
	orderRequest: string;
	deliveryAvailable?: boolean;
	hasPrescription?: boolean;
	selections: Record<number, ProductCartSelection>;
	knownProductsById: Record<number, Product>;
	onClose: () => void;
	onEditManualRequest: () => void;
	onUpdateSelection: (
		productId: number,
		nextSelection: ProductCartSelection | null,
	) => void;
};

const MAX_NOTE_LENGTH = 255;

const formatNumericValue = (value: number) => {
	if (Number.isInteger(value)) {
		return formatArabicInteger(value) || String(value);
	}

	return value.toLocaleString("ar-EG", {
		maximumFractionDigits: 3,
		useGrouping: false,
	});
};

const resolveQuantityLabel = (
	selection: ProductCartSelection,
	product?: Product,
) => {
	const quantity = Number(selection.selection_quantity || 0);
	const unitOptions = product?.order_config?.quantity?.unit_options;
	const selectedOption = Array.isArray(unitOptions)
		? unitOptions.find((option) => option.id === selection.unit_option_id)
		: undefined;
	const unitLabel =
		selectedOption?.label || product?.order_config?.quantity?.unit_label || "قطعة";
	return `${formatNumericValue(quantity)} ${unitLabel}`;
};

const resolveSelectionSummary = (
	selection: ProductCartSelection,
	product?: Product,
) => {
	if (selection.selection_mode === "weight") {
		const grams = Number(selection.selection_grams || 0);
		return `${formatNumericValue(grams)} جم`;
	}

	if (selection.selection_mode === "price") {
		const amount = Number(selection.selection_amount_egp || 0);
		return formatCurrency(amount);
	}

	return resolveQuantityLabel(selection, product);
};

const resolveModeLabel = (selectionMode: ProductCartSelection["selection_mode"]) => {
	if (selectionMode === "weight") {
		return "بالوزن";
	}

	if (selectionMode === "price") {
		return "بالمبلغ";
	}

	return "بالعدد";
};

type ReviewItemCardProps = {
	productId: number;
	product?: Product;
	selection: ProductCartSelection;
	isPending: boolean;
	onUpdateSelection: (
		productId: number,
		nextSelection: ProductCartSelection | null,
	) => void;
};

const ReviewItemCard = ({
	productId,
	product,
	selection,
	isPending,
	onUpdateSelection,
}: ReviewItemCardProps) => {
	const [weightInput, setWeightInput] = useState(
		String(Number(selection.selection_grams || 0) || ""),
	);
	const [priceInput, setPriceInput] = useState(
		String(Number(selection.selection_amount_egp || 0) || ""),
	);
	const [inlineError, setInlineError] = useState<string | null>(null);
	const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

	const lineTotal = resolveSelectionLineTotal(selection, product);
	const name = product?.name || "منتج";

	const handleRemove = () => {
		onUpdateSelection(productId, null);
	};

	const handleQuantityDelta = (delta: number) => {
		const currentQty = Number(selection.selection_quantity || 0);
		const nextQty = Math.max(0, currentQty + delta);

		if (nextQty === 0) {
			onUpdateSelection(productId, null);
			return;
		}

		onUpdateSelection(productId, {
			selection_mode: "quantity",
			selection_quantity: nextQty,
			unit_option_id: selection.unit_option_id,
			item_note: selection.item_note,
		});
	};

	const handleWeightSave = () => {
		const parsed = Number(weightInput.trim().replace(",", "."));
		if (!Number.isFinite(parsed) || parsed <= 0) {
			setInlineError("أدخل وزن صحيح أكبر من صفر");
			return;
		}

		onUpdateSelection(productId, {
			selection_mode: "weight",
			selection_grams: Math.round(parsed),
			item_note: selection.item_note,
		});
	};

	const handlePriceSave = () => {
		const parsed = Number(priceInput.trim().replace(",", "."));
		if (!Number.isFinite(parsed) || parsed <= 0) {
			setInlineError("أدخل مبلغ صحيح أكبر من صفر");
			return;
		}

		onUpdateSelection(productId, {
			selection_mode: "price",
			selection_amount_egp: Number(parsed.toFixed(2)),
			item_note: selection.item_note,
		});
	};

	return (
		<div className="rounded-lg border border-brand-border bg-white p-3 shadow-soft">
			<div className="flex items-start justify-between gap-3">
				<div>
					<p className="text-sm font-bold text-brand-text">{name}</p>
					<div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
						<span>{resolveSelectionSummary(selection, product)}</span>
						<span className="rounded-full bg-brand-soft px-2 py-0.5 font-semibold text-brand-primary">
							{resolveModeLabel(selection.selection_mode)}
						</span>
					</div>
					{lineTotal !== null && (
						<p className="mt-1 text-xs font-semibold text-brand-primary">
							إجمالي تقديري: {formatCurrency(lineTotal)}
						</p>
					)}
				</div>

				{isConfirmingDelete ? (
					<div className="flex items-center gap-1.5 shrink-0">
						<button
							type="button"
							onClick={handleRemove}
							disabled={isPending}
							className="flex h-11 items-center rounded-md bg-status-error px-3 text-sm font-bold text-white disabled:opacity-60"
						>
							تأكيد
						</button>
						<button
							type="button"
							onClick={() => setIsConfirmingDelete(false)}
							disabled={isPending}
							className="flex h-11 items-center rounded-md border border-brand-border bg-white px-3 text-sm font-bold text-brand-text disabled:opacity-60"
						>
							إلغاء
						</button>
					</div>
				) : (
					<button
						type="button"
						onClick={() => setIsConfirmingDelete(true)}
						disabled={isPending}
					className="flex h-11 shrink-0 items-center rounded-md border border-status-error/30 px-3 text-sm font-semibold text-status-error disabled:opacity-60"
					>
						حذف
					</button>
				)}
			</div>

			<div className="mt-3 rounded-md border border-brand-border bg-brand-soft/40 p-2.5">
				{selection.selection_mode === "quantity" && (
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={() => handleQuantityDelta(-1)}
							disabled={isPending}
							className="flex h-11 w-11 items-center justify-center rounded-md border border-brand-border bg-white text-lg font-bold text-brand-text disabled:opacity-60"
						>
							-
						</button>
						<div className="min-w-12 text-center text-sm font-bold text-brand-text">
							{formatNumericValue(Number(selection.selection_quantity || 0))}
						</div>
						<button
							type="button"
							onClick={() => handleQuantityDelta(1)}
							disabled={isPending}
							className="flex h-11 w-11 items-center justify-center rounded-md bg-brand-primary text-lg font-bold text-white disabled:opacity-60"
						>
							+
						</button>
					</div>
				)}

				{selection.selection_mode === "weight" && (
					<div className="flex items-end gap-2">
						<div className="flex-1">
							<label className="mb-1 block text-xs font-semibold text-brand-text">
								الوزن بالجرام
							</label>
							<input
								type="number"
								min="1"
								step="1"
								inputMode="numeric"
								value={weightInput}
								onChange={event => {
									setWeightInput(event.target.value);
									setInlineError(null);
								}}
								disabled={isPending}
								className="h-11 w-full rounded-md border border-brand-border bg-white px-3 text-sm focus:border-brand-accent focus:outline-none focus:ring-4 focus:ring-brand-accent/15 disabled:opacity-60"
							/>
						</div>
						<button
							type="button"
							onClick={handleWeightSave}
							disabled={isPending}
						className="flex h-11 items-center rounded-md bg-brand-primary px-4 text-sm font-semibold text-white disabled:opacity-60"
						>
							حفظ
						</button>
					</div>
				)}

				{selection.selection_mode === "price" && (
					<div className="flex items-end gap-2">
						<div className="flex-1">
							<label className="mb-1 block text-xs font-semibold text-brand-text">
								المبلغ بالجنيه
							</label>
							<input
								type="number"
								min="0.01"
								step="0.01"
								inputMode="decimal"
								value={priceInput}
								onChange={event => {
									setPriceInput(event.target.value);
									setInlineError(null);
								}}
								disabled={isPending}
								className="h-11 w-full rounded-md border border-brand-border bg-white px-3 text-sm focus:border-brand-accent focus:outline-none focus:ring-4 focus:ring-brand-accent/15 disabled:opacity-60"
							/>
						</div>
						<button
							type="button"
							onClick={handlePriceSave}
							disabled={isPending}
						className="flex h-11 items-center rounded-md bg-brand-primary px-4 text-sm font-semibold text-white disabled:opacity-60"
						>
							حفظ
						</button>
					</div>
				)}

				{inlineError && (
				<p className="mt-2 text-xs font-medium text-status-error">{inlineError}</p>
				)}
			</div>

			<div className="mt-3">
				<label className="mb-1 block text-xs font-semibold text-brand-text">
					ملاحظة على الصنف
				</label>
				<input
					type="text"
					maxLength={MAX_NOTE_LENGTH}
					value={selection.item_note || ""}
					onChange={event => {
						const value = event.target.value;
						onUpdateSelection(productId, {
							...selection,
							item_note: value.length > 0 ? value : undefined,
						});
					}}
					disabled={isPending}
					placeholder="مثال: طازة / بدون كيس"
					className="h-11 w-full rounded-md border border-brand-border bg-white px-3 text-sm focus:border-brand-accent focus:outline-none focus:ring-4 focus:ring-brand-accent/15 disabled:opacity-60"
				/>
				<p className="mt-1 text-end text-[11px] text-muted-foreground">
					{formatNumericValue((selection.item_note || "").length)}/
					{formatNumericValue(MAX_NOTE_LENGTH)}
				</p>
			</div>
		</div>
	);
};

export default function OrderReviewSheet({
	isOpen,
	isPending,
	totalItems,
	estimatedTotal,
	hasPricedItems,
	orderRequest,
	deliveryAvailable = true,
	hasPrescription = false,
	selections,
	knownProductsById,
	onClose,
	onEditManualRequest,
	onUpdateSelection,
}: OrderReviewSheetProps) {
	useBodyScrollLock(isOpen);
	const closeButtonRef = useRef<HTMLButtonElement | null>(null);
	const sheetRef = useDragToClose<HTMLDivElement>({
		onClose,
		dragThreshold: 80,
		isOpen,
	});

	const selectionEntries = useMemo(
		() =>
			Object.entries(selections).map(([productId, selection]) => ({
				productId: Number(productId),
				selection,
				product: knownProductsById[Number(productId)],
			})),
		[knownProductsById, selections],
	);

	const hasOrderRequest = orderRequest.trim().length > 0;
	const canSubmit = deliveryAvailable && (selectionEntries.length > 0 || hasOrderRequest || hasPrescription);

	useEffect(() => {
		if (!isOpen) {
			return;
		}

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				onClose();
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => {
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [isOpen, onClose]);

	useEffect(() => {
		if (!isOpen) {
			return;
		}

		const raf = requestAnimationFrame(() => {
			closeButtonRef.current?.focus();
		});
		return () => cancelAnimationFrame(raf);
	}, [isOpen]);

	if (!isOpen) {
		return null;
	}

	return (
		<div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true">
			<button
				type="button"
				onClick={onClose}
				aria-label="إغلاق نافذة مراجعة الطلب"
				className="absolute inset-0 bg-black/45"
			/>

			<div className="absolute inset-x-0 bottom-0">
				<div 
					ref={sheetRef}
					className="mx-auto flex max-h-[90dvh] w-full max-w-md flex-col overflow-hidden rounded-t-xl bg-white shadow-float transition-transform"
				>
					<div className="shrink-0 border-b border-gray-100 px-4 pb-3 pt-3">
						<div className="mb-2 h-1.5 w-10 rounded-full bg-gray-300 mx-auto" />
						<div className="relative flex items-center justify-center min-h-11">
							<h2 className="text-sm font-bold text-gray-900">
								راجع الطلب قبل التأكيد
							</h2>
							<button
								ref={closeButtonRef}
								type="button"
								onClick={onClose}
								className="absolute left-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md border border-brand-border text-brand-text"
							>
								×
							</button>
						</div>
					</div>

					<div
						className="flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4"
						style={{ WebkitOverflowScrolling: "touch" }}
					>
						{selectionEntries.length > 0 ? (
							selectionEntries.map(({ productId, product, selection }) => (
								<ReviewItemCard
									key={`${productId}-${selection.selection_mode}-${selection.selection_grams || ""}-${selection.selection_amount_egp || ""}-${selection.selection_quantity || ""}`}
									productId={productId}
									product={product}
									selection={selection}
									isPending={isPending}
									onUpdateSelection={onUpdateSelection}
								/>
							))
						) : (
							<div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center text-sm text-gray-600">
								لا توجد عناصر في السلة حالياً.
							</div>
						)}

						{hasOrderRequest && (
							<div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
								<div className="flex items-center justify-between gap-3">
									<p className="text-sm font-bold text-amber-900">طلب يدوي</p>
									<button
										type="button"
										onClick={onEditManualRequest}
										className="flex h-11 items-center rounded-xl border border-amber-300 bg-white px-3 text-sm font-semibold text-amber-900"
									>
										تعديل
									</button>
								</div>
								<p
									className="mt-2 whitespace-pre-line text-sm text-amber-900"
									style={{
										display: "-webkit-box",
										WebkitLineClamp: 2,
										WebkitBoxOrient: "vertical",
										overflow: "hidden",
									}}
								>
									{orderRequest}
								</p>
							</div>
						)}

						{hasPrescription && (
							<div className="rounded-2xl border border-brand-accent/30 bg-brand-soft/30 p-3">
								<div className="flex items-center gap-2">
									<p className="text-sm font-bold text-brand-text">وصفة طبية مرفقة</p>
								</div>
							</div>
						)}

						{!deliveryAvailable && (
							<div className="rounded-2xl border border-status-error/20 bg-status-error/10 p-3 text-sm font-semibold text-status-error">
								التوصيل غير متاح حالياً. يمكنك الرجوع للمتجر لاحقاً عند فتح استقبال الطلبات.
							</div>
						)}
					</div>

					<div
						className="shrink-0 border-t border-gray-100 bg-white px-4 pb-4 pt-3"
						style={{
							paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)",
						}}
					>
						<div className="mb-3 flex items-end justify-between gap-2">
							<p className="text-sm font-semibold text-gray-600">
								العناصر: {formatNumericValue(totalItems)}
							</p>
							{hasPricedItems ? (
								<p className="text-sm font-bold text-brand-primary">
									إجمالي تقريبي: {formatCurrency(estimatedTotal)}
								</p>
							) : (
								<p className="text-xs font-medium text-gray-500">
									الأسعار النهائية يتم تأكيدها بعد الطلب
								</p>
							)}
						</div>
						<button
							type="submit"
							data-review-confirm-submit
							disabled={isPending || !canSubmit}
							className="flex h-12 w-full items-center justify-center rounded-lg bg-brand-primary text-base font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
						>
							{isPending ? "جاري الإرسال..." : "تأكيد الطلب"}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
