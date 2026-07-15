"use client";

import {
  memo,
  type ChangeEvent,
  type ReactNode,
  type RefObject,
} from "react";
import ImageThumbnail from "@/components/ui/ImageThumbnail";
import { formatCurrency } from "@/lib/utils/currency";
import { getImageUrl } from "@/lib/utils/image";
import { formatArabicQuantity } from "@/lib/utils/number";
import { ReplacementDecisionStatus } from "@/types/enums";
import type { OrderItem } from "@/types/models/order";

export const ITEM_PRICE_CHIPS = [10, 20, 50, 100] as const;
export const MAX_ITEM_PRICE = 99_999.99;

export type ReplacementOption = {
  id: number;
  name: string;
  image_url?: string | null;
};

export type ItemActionControl = {
  label: string;
  disabled: boolean;
  onClick: () => void;
};

export const ProductThumbnail = memo(function ProductThumbnail({
  imageUrl,
  name,
  size = 36,
}: {
  imageUrl?: string | null;
  name: string;
  size?: number;
}) {
  if (imageUrl?.trim()) {
    return (
      <ImageThumbnail
        src={getImageUrl(imageUrl)}
        alt={name}
        width={size}
        height={size}
        unoptimized
        imageClassName="rounded-lg border border-gray-200 bg-gray-50 object-cover"
        thumbnailWrapperClassName="shrink-0"
        fallback={
          <div
            className="flex items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 text-[10px] text-gray-500"
            style={{ width: size, height: size }}
          >
            🛒
          </div>
        }
      />
    );
  }

  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 text-[10px] text-gray-500"
      style={{ width: size, height: size }}
    >
      🛒
    </div>
  );
});

export function getReplacementButtonLabel(item: OrderItem) {
  const decisionStatus =
    item.replacement_decision_status ?? ReplacementDecisionStatus.NONE;

  if (decisionStatus === ReplacementDecisionStatus.PENDING) {
    return "تعديل البديل المقترح";
  }

  if (item.replaced_by_product?.name) {
    return "تغيير البديل";
  }

  return "استبدال المنتج";
}

export function OrderItemActionCard({
  item,
  displayedPrice,
  replacementAction,
  priceAction,
  unavailableAction,
  helperMessages = [],
  busy = false,
  onResetDecision,
  resetDisabled = false,
  unavailableStateMessage =
    "تم حذف الصنف من إجمالي الطلب وإيقاف المنتج من المتجر.",
}: {
  item: OrderItem;
  displayedPrice?: number | string | null;
  replacementAction: ItemActionControl;
  priceAction: ItemActionControl;
  unavailableAction: ItemActionControl;
  helperMessages?: string[];
  busy?: boolean;
  onResetDecision?: () => void;
  resetDisabled?: boolean;
  unavailableStateMessage?: string;
}) {
  const decisionStatus =
    item.replacement_decision_status ?? ReplacementDecisionStatus.NONE;
  const isDecisionLocked =
    decisionStatus === ReplacementDecisionStatus.APPROVED ||
    decisionStatus === ReplacementDecisionStatus.REJECTED;
  const isOutOfStock = Boolean(item.is_out_of_stock);

  return (
    <div
      className={`rounded-xl border p-3 ${
        isOutOfStock
          ? "border-red-200 bg-red-50/50"
          : "border-gray-200"
      }`}
    >
      <div className="flex justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-gray-900">{item.name_snapshot}</p>
            {isOutOfStock ? (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700">
                غير متوفر
              </span>
            ) : null}
          </div>
          <p className="text-sm text-gray-500">
            الكمية: {formatArabicQuantity(item.quantity) || item.quantity}
          </p>
          <p className="mt-1 text-sm font-semibold text-gray-800">
            السعر:{" "}
            {isOutOfStock
              ? "محذوف من الإجمالي"
              : formatCurrency(displayedPrice ?? item.total_price) || "غير محدد"}
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={replacementAction.onClick}
          disabled={busy || replacementAction.disabled}
          className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
        >
          {replacementAction.label}
        </button>
        <button
          type="button"
          onClick={priceAction.onClick}
          disabled={busy || priceAction.disabled}
          className="rounded-md bg-brand-primary px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
        >
          {priceAction.label}
        </button>
        <button
          type="button"
          onClick={unavailableAction.onClick}
          disabled={busy || unavailableAction.disabled}
          className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
        >
          {unavailableAction.label}
        </button>
      </div>

      {helperMessages.map((message) => (
        <p key={message} className="mt-2 text-xs text-gray-500">
          {message}
        </p>
      ))}

      {isOutOfStock ? (
        <p className="mt-2 rounded-lg bg-red-100 px-3 py-2 text-xs font-semibold text-red-700">
          {unavailableStateMessage}
        </p>
      ) : null}

      {decisionStatus === ReplacementDecisionStatus.PENDING &&
      item.pending_replacement_product?.name ? (
        <div className="mt-2 flex items-center gap-2 text-sm font-medium text-amber-700">
          <ProductThumbnail
            imageUrl={item.pending_replacement_product.image_url}
            name={item.pending_replacement_product.name}
            size={28}
          />
          <p>
            بانتظار موافقة العميل على: {item.pending_replacement_product.name}
          </p>
        </div>
      ) : null}

      {decisionStatus === ReplacementDecisionStatus.APPROVED &&
      item.replaced_by_product?.name ? (
        <div className="mt-2 flex items-center gap-2 text-sm font-medium text-green-700">
          <ProductThumbnail
            imageUrl={item.replaced_by_product.image_url}
            name={item.replaced_by_product.name}
            size={28}
          />
          <p>وافق العميل على البديل: {item.replaced_by_product.name}</p>
        </div>
      ) : null}

      {decisionStatus === ReplacementDecisionStatus.REJECTED ? (
        <div className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          <p>رفض العميل البديل المقترح.</p>
          {item.replacement_decision_reason ? (
            <p className="mt-1 text-xs text-red-600">
              السبب: {item.replacement_decision_reason}
            </p>
          ) : null}
        </div>
      ) : null}

      {isDecisionLocked && onResetDecision ? (
        <button
          type="button"
          onClick={onResetDecision}
          disabled={busy || resetDisabled}
          className="mt-3 w-full rounded-md border border-brand-border bg-brand-soft px-3 py-2 text-xs font-semibold text-brand-primary disabled:opacity-60"
        >
          إعادة فتح قرار الاستبدال
        </button>
      ) : null}

      {item.notes ? (
        <p className="mt-2 text-xs text-amber-700">ملاحظة: {item.notes}</p>
      ) : null}
    </div>
  );
}

export function OrderItemBottomSheet({
  item,
  kind,
  isSearchFocused = false,
  sheetRef,
  onClose,
  headerContent,
  children,
}: {
  item: OrderItem;
  kind: "replacement" | "price";
  isSearchFocused?: boolean;
  sheetRef: RefObject<HTMLDivElement | null>;
  onClose: () => void;
  headerContent?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/40"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        aria-label="إغلاق"
        className="absolute inset-0 h-full w-full"
        onClick={onClose}
      />
      <div
        ref={sheetRef}
        className={`absolute bottom-0 left-0 right-0 flex flex-col overflow-hidden rounded-t-xl bg-white shadow-float transition-[max-height,transform] duration-300 ${
          isSearchFocused ? "h-[100dvh] max-h-[100dvh]" : "max-h-[85dvh]"
        }`}
      >
        <div className="shrink-0 border-b border-gray-100 px-4 pb-2 pt-4">
          <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-gray-300" />
          <div className="pb-2">
            <h3 className="text-lg font-bold leading-tight text-gray-900">
              {kind === "replacement"
                ? "اختر المنتج البديل"
                : "تحديد سعر الصنف"}
            </h3>
            <p className="mb-3 text-sm text-gray-500">
              {kind === "replacement" ? "بديل لـ: " : ""}
              {item.name_snapshot}
            </p>
            {headerContent}
          </div>
        </div>
        <div
          className="flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-2"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export function ReplacementSearchField({
  value,
  inputRef,
  maxLength = 120,
  onChange,
  onClear,
  onFocusChange,
}: {
  value: string;
  inputRef?: RefObject<HTMLInputElement | null>;
  maxLength?: number;
  onChange: (value: string) => void;
  onClear: () => void;
  onFocusChange: (focused: boolean) => void;
}) {
  return (
    <div className="relative">
      <input
        ref={inputRef}
        value={value}
        onFocus={() => onFocusChange(true)}
        onBlur={() => {
          window.setTimeout(() => onFocusChange(false), 200);
        }}
        onChange={(event: ChangeEvent<HTMLInputElement>) =>
          onChange(event.target.value)
        }
        maxLength={maxLength}
        placeholder="ابحث بالاسم..."
        className="w-full rounded-md border border-brand-border bg-brand-soft/40 px-4 py-3 pe-10 text-sm font-medium focus:border-brand-accent focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-accent/15"
      />
      {value ? (
        <button
          type="button"
          onClick={onClear}
          aria-label="مسح البحث"
          className="absolute inset-y-0 end-0 flex items-center pe-3 text-gray-400 transition-colors hover:text-gray-600"
        >
          <svg
            className="h-5 w-5"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      ) : null}
    </div>
  );
}

export function ReplacementProductResults({
  options,
  loading = false,
  error,
  isTextSearchActive,
  category,
  disabled = false,
  busyMessage,
  onSelect,
}: {
  options: ReplacementOption[];
  loading?: boolean;
  error?: string | null;
  isTextSearchActive: boolean;
  category?: string;
  disabled?: boolean;
  busyMessage?: string;
  onSelect: (product: ReplacementOption) => void;
}) {
  return (
    <>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
        <p className="text-xs text-gray-400">
          اكتب حرفين على الأقل للبحث
        </p>
        {category ? (
          <p className="text-xs font-medium text-brand-primary">
            الأولوية لقسم: {category}
          </p>
        ) : null}
      </div>
      <div className="mt-4 space-y-2">
        {busyMessage ? (
          <p className="rounded-lg bg-brand-soft px-3 py-2 text-sm font-medium text-brand-primary">
            {busyMessage}
          </p>
        ) : null}
        {!isTextSearchActive && options.length > 0 ? (
          <p className="text-xs font-bold uppercase tracking-wider text-brand-primary">
            منتجات مشابهة مقترحة
          </p>
        ) : null}
        {loading ? (
          <div className="flex flex-col items-center justify-center rounded-2xl bg-gray-50/50 py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-primary border-t-transparent" />
            <p className="mt-2 text-sm text-gray-500">
              {isTextSearchActive ? "جاري البحث..." : "جاري تحميل المقترحات..."}
            </p>
          </div>
        ) : null}
        {!loading && error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        ) : null}
        {!loading && !error && options.length === 0 ? (
          <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-500">
            {!isTextSearchActive && category
              ? `لا توجد نتائج مطابقة داخل قسم ${category}`
              : "لا توجد نتائج مطابقة"}
          </p>
        ) : null}
        {!loading && !error
          ? options.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => onSelect(product)}
                disabled={disabled}
                className="flex w-full items-center justify-between rounded-xl border border-gray-200 px-3 py-3 text-start disabled:opacity-60"
              >
                <span className="flex items-center gap-3">
                  <ProductThumbnail
                    imageUrl={product.image_url}
                    name={product.name}
                  />
                  <span className="font-medium text-gray-900">
                    {product.name}
                  </span>
                </span>
                <span className="text-xs text-gray-500">اختيار</span>
              </button>
            ))
          : null}
      </div>
    </>
  );
}

export function ItemPriceEditor({
  value,
  error,
  disabled = false,
  onChange,
  onSave,
}: {
  value: string;
  error?: string | null;
  disabled?: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
}) {
  return (
    <>
      <div className="mt-2 rounded-xl border border-gray-200 p-3">
        <label className="mb-2 block text-sm font-medium text-gray-700">
          السعر النهائي للصنف (ج.م)
        </label>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          disabled={disabled}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="مثال: 45"
          className="w-full rounded-md border border-brand-border px-3 py-3 text-sm focus:border-brand-accent focus:outline-none focus:ring-4 focus:ring-brand-accent/15 disabled:cursor-wait disabled:bg-gray-100"
        />
        <p className="mt-2 text-xs text-gray-500">
          سيتم حفظ السعر كإجمالي هذا الصنف.
        </p>
      </div>
      <div className="mt-3">
        <p className="mb-2 text-xs font-semibold text-gray-500">أسعار سريعة</p>
        <div className="grid grid-cols-4 gap-2">
          {ITEM_PRICE_CHIPS.map((price) => (
            <button
              key={price}
              type="button"
              disabled={disabled}
              onClick={() => onChange(String(price))}
              className="rounded-lg border border-gray-300 px-2 py-2 text-sm font-semibold text-gray-700 disabled:cursor-wait disabled:bg-gray-100 disabled:text-gray-400"
            >
              {price}
            </button>
          ))}
        </div>
      </div>
      {error ? (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        onClick={onSave}
        disabled={disabled}
        className="mt-4 w-full rounded-md bg-brand-primary px-4 py-3 text-sm font-semibold text-white shadow-soft disabled:opacity-60"
      >
        {disabled ? "جاري الحفظ..." : "حفظ السعر"}
      </button>
    </>
  );
}
