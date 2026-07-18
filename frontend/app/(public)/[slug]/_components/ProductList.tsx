"use client";

import { Product } from "@/types/models/product";
import { useBodyScrollLock } from "@/lib/hooks/useBodyScrollLock";
import { useDragToClose } from "@/lib/hooks/useDragToClose";
import ImageThumbnail from "@/components/ui/ImageThumbnail";
import { getImageUrl } from "@/lib/utils/image";
import { formatCurrency } from "@/lib/utils/currency";
import { formatArabicInteger, formatArabicQuantity } from "@/lib/utils/number";
import { useState } from "react";

type SelectionMode = "quantity" | "weight" | "price";
type InlineEditorMode = "weight" | "price";

export type ProductCartSelection = {
	selection_mode: SelectionMode;
	selection_quantity?: number;
	selection_grams?: number;
	selection_amount_egp?: number;
	unit_option_id?: string;
	item_note?: string;
};

export type AvailabilityRequestOutcome =
	| "created"
	| "already_requested_today"
	| "failed";

type ProductListProps = {
	products: Product[];
	selections: Record<number, ProductCartSelection>;
	onUpdateSelection: (product: Product, selection: ProductCartSelection | null) => void;
	onAdded?: () => void;
	onRequestAvailability?: (product: Product) => Promise<AvailabilityRequestOutcome>;
	onRequestCustomAvailability?: (
		requestedProductName: string,
	) => Promise<AvailabilityRequestOutcome>;
	loadMoreTriggerIndex?: number;
	setLoadMoreTarget?: (node: HTMLDivElement | null) => void;
};

type AvailabilitySheetState =
	| {
			type: "product";
			product: Product;
	  }
	| {
			type: "custom";
	  }
	| null;

const DEFAULT_WEIGHT_PRESETS = [250, 500, 1000];
const DEFAULT_PRICE_PRESETS = [100, 200, 300];
const resolveInlineEditorKey = (productId: number, mode: InlineEditorMode) =>
	`${productId}:${mode}`;

const parseProductPrice = (product: Product): number | null => {
	if (
		product.current_price === null ||
		product.current_price === undefined ||
		product.current_price === ""
	) {
		return null;
	}

	const parsedPrice = Number(product.current_price);
	if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
		return null;
	}

	return parsedPrice;
};

const resolveProductMode = (product: Product): SelectionMode => {
	if (product.order_mode === "weight" || product.order_mode === "price") {
		return product.order_mode;
	}

	return "quantity";
};

const resolveModeLabel = (mode: SelectionMode) => {
	if (mode === "quantity") {
		return "بالعدد";
	}

	if (mode === "weight") {
		return "بالوزن";
	}

	return "بالمبلغ";
};

const resolveBaseQuantityUnitLabel = (product: Product) =>
	product.order_config?.quantity?.unit_label || "قطعة";

const normalizeRequestedProductName = (value: string) =>
	value.trim().replace(/\s+/g, " ");

export type QuantityOption = {
	id: string;
	label: string;
	multiplier: number | string;
};

const resolveQuantityOptions = (product: Product): QuantityOption[] => {
	const options = product.order_config?.quantity?.unit_options;
	if (!Array.isArray(options) || options.length === 0) {
		return [];
	}

	return options.filter((option: unknown): option is QuantityOption => {
		if (!option || typeof option !== "object") return false;
		const record = option as Record<string, unknown>;
		return (
			typeof record.id === "string" &&
			typeof record.label === "string" &&
			Number(record.multiplier) > 0
		);
	});
};

const resolveSelectedQuantityOption = (
	quantityOptions: QuantityOption[],
	selectedUnitId?: string,
) => quantityOptions.find((option) => option.id === selectedUnitId) || quantityOptions[0];

type ProductListCardProps = {
	product: Product;
	selection?: ProductCartSelection;
	preferredQuantityUnitId?: string;
	loadMoreRef?: (node: HTMLDivElement | null) => void;
	onQuantityDelta: (product: Product, delta: number) => void;
	onQuantityUnitChange: (product: Product, unitOptionId: string) => void;
	onPresetSelection: (product: Product, mode: "weight" | "price", value: number) => void;
	activeInlineEditor: { productId: number; mode: InlineEditorMode } | null;
	inlineDraftByKey: Record<string, string>;
	inlineErrorByKey: Record<string, string>;
	onOpenInlineEditor: (product: Product, mode: InlineEditorMode) => void;
	onInlineDraftChange: (
		product: Product,
		mode: InlineEditorMode,
		value: string,
	) => void;
	onApplyInlineValue: (product: Product, mode: InlineEditorMode) => void;
	onCancelInlineValue: (product: Product, mode: InlineEditorMode) => void;
	onOpenAvailabilitySheet?: (product: Product) => void;
};

const resolveSelectionMetrics = ({
	product,
	selection,
	preferredQuantityUnitId,
}: {
	product: Product;
	selection?: ProductCartSelection;
	preferredQuantityUnitId?: string;
}) => {
	const quantityOptions = resolveQuantityOptions(product);
	const selectedQty =
		selection?.selection_mode === "quantity"
			? Number(selection.selection_quantity || 0)
			: 0;
	const selectedGrams =
		selection?.selection_mode === "weight"
			? Number(selection.selection_grams || 0)
			: 0;
	const selectedAmount =
		selection?.selection_mode === "price"
			? Number(selection.selection_amount_egp || 0)
			: 0;
	const weightPresets =
		product.order_config?.weight?.preset_grams?.length
			? product.order_config.weight.preset_grams
			: DEFAULT_WEIGHT_PRESETS;
	const pricePresets =
		product.order_config?.price?.preset_amounts_egp?.length
			? product.order_config.price.preset_amounts_egp
			: DEFAULT_PRICE_PRESETS;
	const selectedUnitId =
		preferredQuantityUnitId ||
		(selection?.selection_mode === "quantity"
			? selection.unit_option_id
			: undefined) ||
		quantityOptions[0]?.id;

	return {
		quantityOptions,
		selectedQty,
		selectedGrams,
		selectedAmount,
		weightPresets,
		pricePresets,
		selectedUnitId,
		isCustomWeightSelection:
			selectedGrams > 0 && !weightPresets.includes(selectedGrams),
	};
};

type QuantitySelectionControlsProps = {
	product: Product;
	quantityOptions: ReturnType<typeof resolveQuantityOptions>;
	selectedUnitId?: string;
	selectedQty: number;
	onQuantityDelta: (product: Product, delta: number) => void;
	onQuantityUnitChange: (product: Product, unitOptionId: string) => void;
};

const QuantitySelectionControls = ({
	product,
	quantityOptions,
	selectedUnitId,
	selectedQty,
	onQuantityDelta,
	onQuantityUnitChange,
}: QuantitySelectionControlsProps) => {
	const baseUnitLabel = resolveBaseQuantityUnitLabel(product);
	const selectedOption = resolveSelectedQuantityOption(quantityOptions, selectedUnitId);
	const selectedUnitLabel = selectedOption?.label || baseUnitLabel;
	const selectedMultiplier = Number(selectedOption?.multiplier);
	const hasMultiplierHint =
		Number.isFinite(selectedMultiplier) && selectedMultiplier > 1;
	const formattedMultiplier =
		formatArabicQuantity(selectedMultiplier) || String(selectedMultiplier);

	return (
		<div className="space-y-2">
			{quantityOptions.length > 0 && (
				<div className="flex flex-wrap gap-2">
					{quantityOptions.map((option) => (
						<button
							key={option.id}
							type="button"
							onClick={() => onQuantityUnitChange(product, option.id)}
							className={`min-h-11 rounded-full border px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/20 ${
								selectedUnitId === option.id
									? "border-brand-primary bg-brand-soft text-brand-primary"
									: "border-brand-border bg-white text-brand-text"
							}`}
						>
							{option.label}
						</button>
					))}
				</div>
			)}

			<div className="flex items-center gap-2">
				{selectedQty > 0 && (
					<>
						<button
							type="button"
							onClick={() => onQuantityDelta(product, -1)}
							className="h-11 w-11 rounded-full border border-brand-border text-lg text-brand-text transition-transform active:scale-[0.97] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/20"
						>
							-
						</button>
						<span className="min-w-8 text-center text-sm font-bold text-brand-text">
							{formatArabicInteger(selectedQty) || selectedQty}
						</span>
					</>
				)}
				<button
					type="button"
					onClick={() => onQuantityDelta(product, 1)}
					className="h-11 w-11 rounded-full bg-brand-primary text-lg text-white transition-transform active:scale-[0.97] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/20"
				>
					+
				</button>
				<div className="text-xs leading-tight text-muted-foreground">
					<div>{selectedUnitLabel}</div>
					{hasMultiplierHint && (
						<div className="text-[11px] text-muted-foreground/80">
							{`${baseUnitLabel} × ${formattedMultiplier}`}
						</div>
					)}
				</div>
			</div>
		</div>
	);
};

type WeightSelectionControlsProps = {
	product: Product;
	weightPresets: number[];
	selectedGrams: number;
	isCustomWeightSelection: boolean;
	onPresetSelection: (product: Product, mode: "weight" | "price", value: number) => void;
	isInlineEditorOpen: boolean;
	inlineDraftValue: string;
	inlineError?: string;
	onInlineDraftChange: (value: string) => void;
	onOpenInlineEditor: () => void;
	onApplyInlineValue: () => void;
	onCancelInlineValue: () => void;
};

type InlineCustomEditorProps = {
	mode: InlineEditorMode;
	value: string;
	error?: string;
	onChange: (value: string) => void;
	onApply: () => void;
	onCancel: () => void;
};

const InlineCustomEditor = ({
	mode,
	value,
	error,
	onChange,
	onApply,
	onCancel,
}: InlineCustomEditorProps) => (
	<div className="mt-2 space-y-1.5 rounded-md border border-brand-border bg-brand-soft/40 p-2.5">
		<div className="flex items-center gap-2">
			<input
				type="text"
				inputMode="decimal"
				value={value}
				onChange={(event) => onChange(event.target.value)}
				placeholder={mode === "weight" ? "مثال: 750" : "مثال: 150"}
				className="h-11 w-full rounded-md border border-brand-border bg-white px-3 text-sm focus:border-brand-accent focus:outline-none focus:ring-4 focus:ring-brand-accent/15"
			/>
			<button
				type="button"
				onClick={onApply}
				className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-primary text-white active:scale-[0.97] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/20"
				aria-label={mode === "weight" ? "تأكيد الكمية المخصصة" : "تأكيد المبلغ المخصص"}
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="18"
					height="18"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2.25"
					strokeLinecap="round"
					strokeLinejoin="round"
				>
					<path d="m20 6-11 11-5-5" />
				</svg>
			</button>
			<button
				type="button"
				onClick={onCancel}
				className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-brand-border bg-white text-brand-text active:scale-[0.97] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/20"
				aria-label="إلغاء وإرجاع للقيمة السابقة"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="18"
					height="18"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2.25"
					strokeLinecap="round"
					strokeLinejoin="round"
				>
					<path d="M18 6 6 18" />
					<path d="m6 6 12 12" />
				</svg>
			</button>
		</div>
		{error && <p className="text-[11px] font-medium text-status-error">{error}</p>}
	</div>
);

const WeightSelectionControls = ({
	product,
	weightPresets,
	selectedGrams,
	isCustomWeightSelection,
	onPresetSelection,
	isInlineEditorOpen,
	inlineDraftValue,
	inlineError,
	onInlineDraftChange,
	onOpenInlineEditor,
	onApplyInlineValue,
	onCancelInlineValue,
}: WeightSelectionControlsProps) => (
	<div className="space-y-2">
		<p className="text-xs font-semibold text-brand-text">اختار الكمية:</p>
		<div className="flex flex-wrap gap-2">
			{weightPresets.map((grams) => (
				<button
					key={grams}
					type="button"
					onClick={() => onPresetSelection(product, "weight", grams)}
					aria-pressed={selectedGrams === grams}
					className={`min-h-11 rounded-full border px-3 py-2 text-xs font-medium active:scale-[0.97] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/20 ${
						selectedGrams === grams
							? "border-brand-primary bg-brand-soft text-brand-primary"
							: "border-brand-border bg-white text-brand-text"
					}`}
				>
					{formatArabicInteger(grams) || grams} جم
				</button>
			))}
			<button
				type="button"
				onClick={onOpenInlineEditor}
				aria-pressed={isCustomWeightSelection}
				className={`min-h-11 rounded-full border border-dashed px-3 py-2 text-xs font-medium active:scale-[0.97] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/20 ${
					isCustomWeightSelection
						? "border-brand-primary bg-brand-soft text-brand-primary"
						: "border-brand-border text-brand-text"
				}`}
				>
				{isCustomWeightSelection
					? `كمية مخصصة (${formatArabicInteger(selectedGrams) || selectedGrams} جم)`
					: "كمية مخصصة"}
			</button>
		</div>
		{isInlineEditorOpen && (
			<InlineCustomEditor
				mode="weight"
				value={inlineDraftValue}
				error={inlineError}
				onChange={onInlineDraftChange}
				onApply={onApplyInlineValue}
				onCancel={onCancelInlineValue}
			/>
		)}
	</div>
);

type PriceSelectionControlsProps = {
	product: Product;
	pricePresets: number[];
	selectedAmount: number;
	onPresetSelection: (product: Product, mode: "weight" | "price", value: number) => void;
	isInlineEditorOpen: boolean;
	inlineDraftValue: string;
	inlineError?: string;
	onInlineDraftChange: (value: string) => void;
	onOpenInlineEditor: () => void;
	onApplyInlineValue: () => void;
	onCancelInlineValue: () => void;
};

const PriceSelectionControls = ({
	product,
	pricePresets,
	selectedAmount,
	onPresetSelection,
	isInlineEditorOpen,
	inlineDraftValue,
	inlineError,
	onInlineDraftChange,
	onOpenInlineEditor,
	onApplyInlineValue,
	onCancelInlineValue,
}: PriceSelectionControlsProps) => (
	<div className="space-y-2">
		<p className="text-xs font-semibold text-brand-text">اختار المبلغ:</p>
		<div className="flex flex-wrap gap-2">
			{pricePresets.map((amount) => (
				<button
					key={amount}
					type="button"
					onClick={() => onPresetSelection(product, "price", amount)}
					className={`min-h-11 rounded-full border px-3 py-2 text-xs font-medium active:scale-[0.97] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/20 ${
						selectedAmount === amount
							? "border-brand-primary bg-brand-soft text-brand-primary"
							: "border-brand-border bg-white text-brand-text"
					}`}
				>
					{formatArabicInteger(amount) || amount} جنيه
				</button>
			))}
			<button
				type="button"
				onClick={onOpenInlineEditor}
				className="min-h-11 rounded-full border border-dashed border-brand-border px-3 py-2 text-xs font-medium text-brand-text active:scale-[0.97] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/20"
			>
				مبلغ مخصص
			</button>
		</div>
		{isInlineEditorOpen && (
			<InlineCustomEditor
				mode="price"
				value={inlineDraftValue}
				error={inlineError}
				onChange={onInlineDraftChange}
				onApply={onApplyInlineValue}
				onCancel={onCancelInlineValue}
			/>
		)}
	</div>
);

type ProductSelectionControlsProps = {
	product: Product;
	mode: SelectionMode;
	isUnavailable: boolean;
	quantityOptions: ReturnType<typeof resolveQuantityOptions>;
	selectedUnitId?: string;
	selectedQty: number;
	selectedGrams: number;
	selectedAmount: number;
	weightPresets: number[];
	pricePresets: number[];
	isCustomWeightSelection: boolean;
	onQuantityDelta: (product: Product, delta: number) => void;
	onQuantityUnitChange: (product: Product, unitOptionId: string) => void;
	onPresetSelection: (product: Product, mode: "weight" | "price", value: number) => void;
	isWeightInlineEditorOpen: boolean;
	inlineWeightDraftValue: string;
	inlineWeightError?: string;
	isPriceInlineEditorOpen: boolean;
	inlinePriceDraftValue: string;
	inlinePriceError?: string;
	onOpenInlineEditor: (product: Product, mode: InlineEditorMode) => void;
	onInlineDraftChange: (
		product: Product,
		mode: InlineEditorMode,
		value: string,
	) => void;
	onApplyInlineValue: (product: Product, mode: InlineEditorMode) => void;
	onCancelInlineValue: (product: Product, mode: InlineEditorMode) => void;
	onOpenAvailabilitySheet?: (product: Product) => void;
};

const ProductSelectionControls = ({
	product,
	mode,
	isUnavailable,
	quantityOptions,
	selectedUnitId,
	selectedQty,
	selectedGrams,
	selectedAmount,
	weightPresets,
	pricePresets,
	isCustomWeightSelection,
	onQuantityDelta,
	onQuantityUnitChange,
	onPresetSelection,
	isWeightInlineEditorOpen,
	inlineWeightDraftValue,
	inlineWeightError,
	isPriceInlineEditorOpen,
	inlinePriceDraftValue,
	inlinePriceError,
	onOpenInlineEditor,
	onInlineDraftChange,
	onApplyInlineValue,
	onCancelInlineValue,
	onOpenAvailabilitySheet,
}: ProductSelectionControlsProps) => {
	if (isUnavailable) {
		if (!onOpenAvailabilitySheet) return null;

		return (
			<button
				type="button"
				onClick={() => onOpenAvailabilitySheet(product)}
				className="w-full rounded-xl border border-amber-300 bg-white px-4 py-3 text-sm font-semibold text-amber-800"
			>
				اطلب توفير المنتج
			</button>
		);
	}

	if (mode === "quantity") {
		return (
			<QuantitySelectionControls
				product={product}
				quantityOptions={quantityOptions}
				selectedUnitId={selectedUnitId}
				selectedQty={selectedQty}
				onQuantityDelta={onQuantityDelta}
				onQuantityUnitChange={onQuantityUnitChange}
			/>
		);
	}

	if (mode === "weight") {
		return (
			<WeightSelectionControls
				product={product}
				weightPresets={weightPresets}
				selectedGrams={selectedGrams}
				isCustomWeightSelection={isCustomWeightSelection}
				onPresetSelection={onPresetSelection}
				isInlineEditorOpen={isWeightInlineEditorOpen}
				inlineDraftValue={inlineWeightDraftValue}
				inlineError={inlineWeightError}
				onInlineDraftChange={(value) =>
					onInlineDraftChange(product, "weight", value)
				}
				onOpenInlineEditor={() => onOpenInlineEditor(product, "weight")}
				onApplyInlineValue={() => onApplyInlineValue(product, "weight")}
				onCancelInlineValue={() => onCancelInlineValue(product, "weight")}
			/>
		);
	}

	return (
		<PriceSelectionControls
			product={product}
			pricePresets={pricePresets}
			selectedAmount={selectedAmount}
			onPresetSelection={onPresetSelection}
			isInlineEditorOpen={isPriceInlineEditorOpen}
			inlineDraftValue={inlinePriceDraftValue}
			inlineError={inlinePriceError}
			onInlineDraftChange={(value) => onInlineDraftChange(product, "price", value)}
			onOpenInlineEditor={() => onOpenInlineEditor(product, "price")}
			onApplyInlineValue={() => onApplyInlineValue(product, "price")}
			onCancelInlineValue={() => onCancelInlineValue(product, "price")}
		/>
	);
};

const ProductListCard = ({
	product,
	selection,
	preferredQuantityUnitId,
	loadMoreRef,
	onQuantityDelta,
	onQuantityUnitChange,
	onPresetSelection,
	activeInlineEditor,
	inlineDraftByKey,
	inlineErrorByKey,
	onOpenInlineEditor,
	onInlineDraftChange,
	onApplyInlineValue,
	onCancelInlineValue,
	onOpenAvailabilitySheet,
}: ProductListCardProps) => {
	const mode = resolveProductMode(product);
	const isUnavailable = product.is_available === false;
	const priceValue = parseProductPrice(product);
	const priceText = priceValue ? formatCurrency(priceValue) : null;
	const {
		quantityOptions,
		selectedQty,
		selectedGrams,
		selectedAmount,
		weightPresets,
		pricePresets,
		selectedUnitId,
		isCustomWeightSelection,
	} = resolveSelectionMetrics({
		product,
		selection,
		preferredQuantityUnitId,
	});
	const inlineWeightKey = resolveInlineEditorKey(product.id, "weight");
	const inlinePriceKey = resolveInlineEditorKey(product.id, "price");
	const isWeightInlineEditorOpen =
		activeInlineEditor?.productId === product.id &&
		activeInlineEditor.mode === "weight";
	const isPriceInlineEditorOpen =
		activeInlineEditor?.productId === product.id &&
		activeInlineEditor.mode === "price";

	return (
		<div
			ref={loadMoreRef}
			className={`rounded-2xl border p-4 shadow-sm ${
				isUnavailable ? "border-gray-200 bg-gray-50" : "border-gray-200 bg-white"
			}`}
		>
			<div className="flex items-center gap-3">
				<div
					className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg ring-1 transition-colors ${
						isUnavailable ? "bg-gray-100 ring-gray-200" : "bg-gray-100 ring-gray-100"
					}`}
				>
					{product.image_url ? (
						<ImageThumbnail
							src={getImageUrl(product.image_url)}
							alt={product.name}
							width={56}
							height={56}
							loading="lazy"
							sizes="56px"
							thumbnailWrapperClassName="block h-full w-full"
							imageClassName={`h-full w-full object-cover ${isUnavailable ? "grayscale" : ""}`}
							fallback={
								<div className="flex h-full w-full items-center justify-center text-base">
									🛒
								</div>
							}
						/>
					) : (
						<div className="flex h-full w-full items-center justify-center text-base">
							🛒
						</div>
					)}
				</div>

				<div className="min-w-0 flex-1">
					<h3
						className={`truncate text-base font-semibold ${
							isUnavailable ? "text-muted-foreground" : "text-brand-text"
						}`}
					>
						{product.name}
					</h3>
					<p
						className={`truncate text-xs ${
							isUnavailable ? "text-muted-foreground/70" : "text-muted-foreground"
						}`}
					>
						{priceText ? `السعر: ${priceText}` : "السعر يتم تأكيده بعد الطلب"}
					</p>
					<div className="mt-1 flex items-center gap-2">
						<p
							className={`text-[11px] font-semibold ${
								isUnavailable ? "text-muted-foreground" : "text-brand-primary"
							}`}
						>
							{resolveModeLabel(mode)}
						</p>
						{isUnavailable && (
							<span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
								غير متاح حالياً
							</span>
						)}
					</div>
				</div>
			</div>

			<div className="mt-3">
				<ProductSelectionControls
					product={product}
					mode={mode}
					isUnavailable={isUnavailable}
					quantityOptions={quantityOptions}
					selectedUnitId={selectedUnitId}
					selectedQty={selectedQty}
					selectedGrams={selectedGrams}
					selectedAmount={selectedAmount}
					weightPresets={weightPresets}
					pricePresets={pricePresets}
					isCustomWeightSelection={isCustomWeightSelection}
					onQuantityDelta={onQuantityDelta}
					onQuantityUnitChange={onQuantityUnitChange}
					onPresetSelection={onPresetSelection}
					isWeightInlineEditorOpen={isWeightInlineEditorOpen}
					inlineWeightDraftValue={inlineDraftByKey[inlineWeightKey] || ""}
					inlineWeightError={inlineErrorByKey[inlineWeightKey]}
					isPriceInlineEditorOpen={isPriceInlineEditorOpen}
					inlinePriceDraftValue={inlineDraftByKey[inlinePriceKey] || ""}
					inlinePriceError={inlineErrorByKey[inlinePriceKey]}
					onOpenInlineEditor={onOpenInlineEditor}
					onInlineDraftChange={onInlineDraftChange}
					onApplyInlineValue={onApplyInlineValue}
					onCancelInlineValue={onCancelInlineValue}
					onOpenAvailabilitySheet={onOpenAvailabilitySheet}
				/>
			</div>
		</div>
	);
};

export default function ProductList({
	products,
	selections,
	onUpdateSelection,
	onAdded,
	onRequestAvailability,
	onRequestCustomAvailability,
	loadMoreTriggerIndex,
	setLoadMoreTarget,
}: ProductListProps) {
	const [preferredQuantityUnitByProduct, setPreferredQuantityUnitByProduct] =
		useState<Record<number, string>>({});
	const [activeInlineEditor, setActiveInlineEditor] = useState<{
		productId: number;
		mode: InlineEditorMode;
	} | null>(null);
	const [inlineDraftByKey, setInlineDraftByKey] = useState<Record<string, string>>({});
	const [lastPresetByKey, setLastPresetByKey] = useState<Record<string, number>>({});
	const [inlineErrorByKey, setInlineErrorByKey] = useState<Record<string, string>>({});
	const [availabilitySheet, setAvailabilitySheet] =
		useState<AvailabilitySheetState>(null);
	const [customAvailabilityName, setCustomAvailabilityName] = useState("");
	const [customAvailabilityError, setCustomAvailabilityError] = useState("");
	const [isAvailabilitySubmitting, setIsAvailabilitySubmitting] = useState(false);
	useBodyScrollLock(Boolean(availabilitySheet));
	const selectedAvailabilityProduct =
		availabilitySheet?.type === "product" ? availabilitySheet.product : null;

	const closeAvailabilitySheet = (force = false) => {
		if (!force && isAvailabilitySubmitting) {
			return;
		}

		setAvailabilitySheet(null);
		setCustomAvailabilityError("");
	};

	const sheetRef = useDragToClose<HTMLDivElement>({
		onClose: () => closeAvailabilitySheet(true),
		dragThreshold: 80,
		isOpen: Boolean(availabilitySheet),
	});

	const closeInlineEditor = (
		productId: number,
		mode: InlineEditorMode,
		clearDraft = false,
	) => {
		const editorKey = resolveInlineEditorKey(productId, mode);
		setActiveInlineEditor((prev) =>
			prev?.productId === productId && prev.mode === mode ? null : prev,
		);
		setInlineErrorByKey((prev) => {
			if (!(editorKey in prev)) {
				return prev;
			}
			const next = { ...prev };
			delete next[editorKey];
			return next;
		});
		if (!clearDraft) {
			return;
		}
		setInlineDraftByKey((prev) => {
			if (!(editorKey in prev)) {
				return prev;
			}
			const next = { ...prev };
			delete next[editorKey];
			return next;
		});
	};

	const handleOpenInlineEditor = (product: Product, mode: InlineEditorMode) => {
		if (!product.is_available) {
			return;
		}

		const editorKey = resolveInlineEditorKey(product.id, mode);
		const current = selections[product.id];
		let currentSelectionDraft = "";
		if (mode === "weight" && current?.selection_mode === "weight") {
			currentSelectionDraft = String(Number(current.selection_grams || 0) || "");
		}
		if (mode === "price" && current?.selection_mode === "price") {
			currentSelectionDraft = String(Number(current.selection_amount_egp || 0) || "");
		}
		const nextDraft = currentSelectionDraft || inlineDraftByKey[editorKey] || "";

		setInlineDraftByKey((prev) => ({
			...prev,
			[editorKey]: nextDraft,
		}));
		setInlineErrorByKey((prev) => {
			if (!(editorKey in prev)) {
				return prev;
			}
			const next = { ...prev };
			delete next[editorKey];
			return next;
		});
		setActiveInlineEditor({ productId: product.id, mode });
	};

	const handleInlineDraftChange = (
		product: Product,
		mode: InlineEditorMode,
		value: string,
	) => {
		const editorKey = resolveInlineEditorKey(product.id, mode);
		setInlineDraftByKey((prev) => ({
			...prev,
			[editorKey]: value,
		}));
		setInlineErrorByKey((prev) => {
			if (!(editorKey in prev)) {
				return prev;
			}
			const next = { ...prev };
			delete next[editorKey];
			return next;
		});
	};

	const handleQuantityDelta = (product: Product, delta: number) => {
		if (!product.is_available) {
			return;
		}

		const selection = selections[product.id];
		const itemNote =
			selection?.item_note !== undefined ? selection.item_note : undefined;
		const currentQty =
			selection?.selection_mode === "quantity"
				? Number(selection.selection_quantity || 0)
				: 0;
		const nextQty = Math.max(0, currentQty + delta);
		const quantityOptions = resolveQuantityOptions(product);
		const preferredOptionId = preferredQuantityUnitByProduct[product.id];
		const unitOptionId =
			preferredOptionId ||
			(selection?.selection_mode === "quantity"
				? selection.unit_option_id
				: undefined) ||
			quantityOptions[0]?.id;

		if (nextQty === 0) {
			onUpdateSelection(product, null);
			return;
		}

		onUpdateSelection(product, {
			selection_mode: "quantity",
			selection_quantity: nextQty,
			unit_option_id: unitOptionId,
			item_note: itemNote,
		});

		if (delta > 0) {
			onAdded?.();
		}
	};

	const handleQuantityUnitChange = (product: Product, unitOptionId: string) => {
		if (!product.is_available) {
			return;
		}

		setPreferredQuantityUnitByProduct(prev => ({
			...prev,
			[product.id]: unitOptionId,
		}));

		const current = selections[product.id];
		if (current?.selection_mode !== "quantity") {
			return;
		}

		onUpdateSelection(product, {
			...current,
			unit_option_id: unitOptionId,
		});
	};

	const handlePresetSelection = (
		product: Product,
		mode: "weight" | "price",
		value: number,
	) => {
		if (!product.is_available) {
			return;
		}

		const editorKey = resolveInlineEditorKey(product.id, mode);
		setLastPresetByKey((prev) => ({
			...prev,
			[editorKey]: Number(value),
		}));
		closeInlineEditor(product.id, mode, true);

		if (mode === "weight") {
			const nextGrams = Math.round(value);
			const currentSelection = selections[product.id];
			const itemNote =
				currentSelection?.item_note !== undefined
					? currentSelection.item_note
					: undefined;
			const currentGrams =
				currentSelection?.selection_mode === "weight"
					? Number(currentSelection.selection_grams || 0)
					: 0;

			if (currentGrams === nextGrams) {
				onUpdateSelection(product, null);
				return;
			}

			onUpdateSelection(product, {
				selection_mode: "weight",
				selection_grams: nextGrams,
				item_note: itemNote,
			});
		} else {
			const currentSelection = selections[product.id];
			const itemNote =
				currentSelection?.item_note !== undefined
					? currentSelection.item_note
					: undefined;
			onUpdateSelection(product, {
				selection_mode: "price",
				selection_amount_egp: Number(value.toFixed(2)),
				item_note: itemNote,
			});
		}

		onAdded?.();
	};

	const handleApplyInlineValue = (product: Product, mode: InlineEditorMode) => {
		if (!product.is_available) {
			return;
		}

		const editorKey = resolveInlineEditorKey(product.id, mode);
		const parsed = Number((inlineDraftByKey[editorKey] || "").trim().replace(",", "."));
		if (!Number.isFinite(parsed) || parsed <= 0) {
			setInlineErrorByKey((prev) => ({
				...prev,
				[editorKey]:
					mode === "weight"
						? "أدخل وزن صحيح أكبر من صفر"
						: "أدخل مبلغ صحيح أكبر من صفر",
			}));
			return;
		}

		const currentSelection = selections[product.id];
		const itemNote =
			currentSelection?.item_note !== undefined
				? currentSelection.item_note
				: undefined;

		if (mode === "weight") {
			onUpdateSelection(product, {
				selection_mode: "weight",
				selection_grams: Math.round(parsed),
				item_note: itemNote,
			});
		} else {
			onUpdateSelection(product, {
				selection_mode: "price",
				selection_amount_egp: Number(parsed.toFixed(2)),
				item_note: itemNote,
			});
		}

		onAdded?.();
		closeInlineEditor(product.id, mode, true);
	};

	const handleCancelInlineValue = (product: Product, mode: InlineEditorMode) => {
		const editorKey = resolveInlineEditorKey(product.id, mode);
		const fallbackPreset =
			mode === "weight"
				? product.order_config?.weight?.preset_grams?.[0] || DEFAULT_WEIGHT_PRESETS[0]
				: product.order_config?.price?.preset_amounts_egp?.[0] || DEFAULT_PRICE_PRESETS[0];
		const revertValue = lastPresetByKey[editorKey] ?? fallbackPreset;
		handlePresetSelection(product, mode, revertValue);
		closeInlineEditor(product.id, mode, true);
	};

	const submitAvailabilityRequest = async () => {
		if (availabilitySheet?.type === "custom") {
			if (!onRequestCustomAvailability) {
				return;
			}

			const requestedProductName = normalizeRequestedProductName(customAvailabilityName);
			if (!requestedProductName) {
				setCustomAvailabilityError("اكتب اسم المنتج المطلوب");
				return;
			}

			if (requestedProductName.length > 120) {
				setCustomAvailabilityError("اسم المنتج طويل جداً");
				return;
			}

			setIsAvailabilitySubmitting(true);
			try {
				const result = await onRequestCustomAvailability(requestedProductName);
				if (result === "created" || result === "already_requested_today") {
					setCustomAvailabilityName("");
					closeAvailabilitySheet(true);
				}
			} finally {
				setIsAvailabilitySubmitting(false);
			}
			return;
		}

		if (!selectedAvailabilityProduct || !onRequestAvailability) {
			return;
		}

		setIsAvailabilitySubmitting(true);
		try {
			const result = await onRequestAvailability(selectedAvailabilityProduct);
			if (result === "created" || result === "already_requested_today") {
				closeAvailabilitySheet(true);
			}
		} finally {
			setIsAvailabilitySubmitting(false);
		}
	};

	return (
		<>
			<div className="space-y-4">
				{onRequestCustomAvailability && (
					<div
						data-customer-tour="missing-product"
						className="rounded-2xl border border-dashed border-brand-accent/70 bg-brand-soft/60 p-4 shadow-soft"
					>
						<p className="text-sm font-bold text-brand-text">مش لاقي المنتج؟</p>
						<p className="mt-1 text-sm text-muted-foreground">
							اكتب اسمه وهنبلغ التاجر إنك محتاجه.
						</p>
						<button
							type="button"
							onClick={() => setAvailabilitySheet({ type: "custom" })}
							className="mt-3 min-h-11 w-full rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-primary/90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/20"
						>
							اطلب منتج غير موجود
						</button>
					</div>
				)}
					{products.map((product, index) => {
						const selection = selections[product.id];
						const shouldAttachLoadMoreRef =
							typeof loadMoreTriggerIndex === "number" &&
							loadMoreTriggerIndex >= 0 &&
							index === loadMoreTriggerIndex;

						return (
							<ProductListCard
								key={product.id}
								product={product}
								selection={selection}
								preferredQuantityUnitId={preferredQuantityUnitByProduct[product.id]}
								loadMoreRef={
									shouldAttachLoadMoreRef ? setLoadMoreTarget : undefined
								}
								onQuantityDelta={handleQuantityDelta}
								onQuantityUnitChange={handleQuantityUnitChange}
								onPresetSelection={handlePresetSelection}
								activeInlineEditor={activeInlineEditor}
								inlineDraftByKey={inlineDraftByKey}
								inlineErrorByKey={inlineErrorByKey}
								onOpenInlineEditor={handleOpenInlineEditor}
								onInlineDraftChange={handleInlineDraftChange}
								onApplyInlineValue={handleApplyInlineValue}
								onCancelInlineValue={handleCancelInlineValue}
								onOpenAvailabilitySheet={
									onRequestAvailability
										? (selectedProduct) =>
												setAvailabilitySheet({
													type: "product",
													product: selectedProduct,
												})
										: undefined
								}
							/>
						);
					})}
				</div>

			{availabilitySheet &&
				(selectedAvailabilityProduct || availabilitySheet.type === "custom") && (
				<div
					className="fixed inset-0 z-75 flex items-end bg-black/40"
					role="dialog"
					aria-modal="true"
				>
					<button
						type="button"
						onClick={() => closeAvailabilitySheet()}
						className="absolute inset-0"
						aria-label="إغلاق"
					/>
					<div
						ref={sheetRef}
						className="relative max-h-[85dvh] w-full overflow-y-auto overscroll-contain rounded-t-xl bg-white p-4 shadow-float transition-transform [-webkit-overflow-scrolling:touch]"
					>
						<div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-brand-border" />
						{availabilitySheet.type === "custom" ? (
							<>
								<p className="text-base font-bold text-brand-text">
									اطلب منتج غير موجود
								</p>
								<label className="mt-3 block text-sm font-semibold text-brand-text">
									اسم المنتج
									<input
										type="text"
										value={customAvailabilityName}
										onChange={(event) => {
											setCustomAvailabilityName(event.target.value);
											setCustomAvailabilityError("");
										}}
										maxLength={120}
										placeholder="مثلاً: رز بسمتي"
										className="mt-2 w-full rounded-xl border border-brand-border bg-white px-3 py-3 text-sm font-normal text-brand-text outline-none transition focus:border-brand-primary focus:ring-4 focus:ring-brand-accent/20"
										disabled={isAvailabilitySubmitting}
									/>
								</label>
								{customAvailabilityError && (
									<p className="mt-2 text-sm text-red-600">{customAvailabilityError}</p>
								)}
							</>
						) : (
							<>
								<p className="text-base font-bold text-brand-text">
									العنصر غير متاح حالياً
								</p>
								<p className="mt-1 text-sm text-muted-foreground">
									تحب نبلغ التاجر إنك محتاجه؟
								</p>
							</>
						)}
						<div className="mt-4 grid grid-cols-2 gap-2">
							<button
								type="button"
								onClick={submitAvailabilityRequest}
								disabled={isAvailabilitySubmitting}
								className="rounded-md bg-brand-primary px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
							>
								{isAvailabilitySubmitting ? "جاري الإرسال…" : "تأكيد الطلب"}
							</button>
							<button
								type="button"
								onClick={() => closeAvailabilitySheet()}
								disabled={isAvailabilitySubmitting}
								className="rounded-md border border-brand-border px-4 py-3 text-sm font-semibold text-brand-text disabled:opacity-60"
							>
								إلغاء
							</button>
						</div>
					</div>
				</div>
			)}
		</>
	);
}
