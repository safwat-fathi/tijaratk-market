import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  Archive,
  Ban,
  CheckCircle,
  CheckSquare,
  PackageOpen,
  Pencil,
  RotateCcw,
  Square,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import ImageThumbnail from "@/components/ui/ImageThumbnail";
import { Button } from "@/components/ui/Button";
import { Combobox } from "@/components/ui/Combobox";
import { formatArabicInteger } from "@/lib/utils/number";
import type { Product } from "@/types/models/product";
import { SECTION_MY_PRODUCTS } from "../_utils/product-onboarding.constants";
import type {
  ProductAvailabilityFilter,
  ProductStatusFilter,
} from "../_utils/product-onboarding.types";
import {
  normalizeModeBadge,
  resolveImageUrl,
  resolveProductPriceText,
} from "../_utils/product-onboarding";

const availabilityFilters: {
  id: ProductAvailabilityFilter;
  label: string;
}[] = [
  { id: "all", label: "كل المنتجات" },
  { id: "available", label: "متاحة للطلب" },
  { id: "unavailable", label: "غير متاحة" },
];

const productStatusFilters: {
  id: ProductStatusFilter;
  label: string;
}[] = [
  { id: "active", label: "في المتجر" },
  { id: "archived", label: "مخفية من المتجر" },
];

type MyProductsSectionProps = {
  active: boolean;
  displayedProductsCountLabel: string;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onClearSearchQuery: () => void;
  categoryFilter: string;
  onCategoryFilterChange: (value: string) => void;
  categoryFilterCounts: { category: string; count: number }[];
  categoryFilterTotalCount: number;
  allCategoryFilterKey: string;
  availabilityFilter: ProductAvailabilityFilter;
  onAvailabilityFilterChange: (value: ProductAvailabilityFilter) => void;
  availabilityFilterCounts: Record<ProductAvailabilityFilter, number>;
  productStatusFilter: ProductStatusFilter;
  onProductStatusFilterChange: (value: ProductStatusFilter) => void;
  needsMoreSearchChars: boolean;
  isSearchLoading: boolean;
  searchError: string | null;
  isSearchActive: boolean;
  displayedProducts: Product[];
  confirmRemoveProductId: number | null;
  removingProductId: number | null;
  availabilityPendingProductId: number | null;
  highlightedProductId: number | null;
  onStartEdit: (product: Product) => void;
  onToggleAvailability: (product: Product) => void;
  onRequestRemove: (productId: number) => void;
  onRemoveProduct: (product: Product) => void;
  onCancelRemove: () => void;
  allowProductRemoval?: boolean;
  setProductRowRef: (productId: number, node: HTMLLIElement | null) => void;
  onOpenBulkWizard?: () => void;
  bulkUpdateProducts?: (payload: {
    ids: number[];
    category?: string;
    is_available?: boolean;
    status?: "active" | "archived";
  }) => Promise<{
    success: boolean;
    message?: string;
  }>;
  bulkCategoryOptions?: string[];
};

export default function MyProductsSection({
  active,
  displayedProductsCountLabel,
  searchQuery,
  onSearchQueryChange,
  onClearSearchQuery,
  categoryFilter,
  onCategoryFilterChange,
  categoryFilterCounts,
  categoryFilterTotalCount,
  allCategoryFilterKey,
  availabilityFilter,
  onAvailabilityFilterChange,
  availabilityFilterCounts,
  productStatusFilter,
  onProductStatusFilterChange,
  needsMoreSearchChars,
  isSearchLoading,
  searchError,
  isSearchActive,
  displayedProducts,
  confirmRemoveProductId,
  removingProductId,
  availabilityPendingProductId,
  highlightedProductId,
  onStartEdit,
  onToggleAvailability,
  onRequestRemove,
  onRemoveProduct,
  onCancelRemove,
  allowProductRemoval = true,
  setProductRowRef,
  onOpenBulkWizard,
  bulkUpdateProducts,
  bulkCategoryOptions = [],
}: MyProductsSectionProps) {
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const [isConfirmingBulkArchive, setIsConfirmingBulkArchive] = useState(false);
  const [isBulkPending, startBulkTransition] = useTransition();
  const visibleIds = useMemo(
    () => displayedProducts.map((product) => product.id),
    [displayedProducts],
  );
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedSet.has(id));
  const allCategoryCountLabel =
    formatArabicInteger(categoryFilterTotalCount) || categoryFilterTotalCount;
  const selectedCountLabel =
    formatArabicInteger(selectedIds.length) || selectedIds.length;
  const visibleCountLabel =
    formatArabicInteger(visibleIds.length) || visibleIds.length;
  const hasSelectedProducts = selectedIds.length > 0;

  useEffect(() => {
    setSelectedIds((current) =>
      current.filter((id) => visibleIds.includes(id)),
    );
  }, [visibleIds]);

  useEffect(() => {
    setIsConfirmingBulkArchive(false);
    setBulkMessage(null);
  }, [productStatusFilter]);

  useEffect(() => {
    if (selectedIds.length === 0) {
      setIsConfirmingBulkArchive(false);
    }
  }, [selectedIds.length]);

  const handleClearSearch = () => {
    onClearSearchQuery();
    searchInputRef.current?.focus();
  };

  const isFilteredList =
    isSearchActive ||
    productStatusFilter !== "active" ||
    availabilityFilter !== "all" ||
    categoryFilter !== allCategoryFilterKey;

  const toggleSelectedProduct = (productId: number) => {
    setSelectedIds((current) =>
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId],
    );
  };

  const runBulkAction = (payload: {
    category?: string;
    is_available?: boolean;
    status?: "active" | "archived";
  }) => {
    if (!bulkUpdateProducts) return;

    setBulkMessage(null);
    startBulkTransition(async () => {
      const response = await bulkUpdateProducts({
        ids: selectedIds,
        ...payload,
      });
      if (!response.success) {
        setBulkMessage(response.message || "تعذر تحديث المنتجات المحددة");
        return;
      }

      setSelectedIds([]);
      setBulkCategory("");
      setIsConfirmingBulkArchive(false);
      if (payload.status === "archived") {
        setBulkMessage("تم إخفاء المنتجات المحددة من المتجر");
      } else if (payload.status === "active") {
        setBulkMessage("تمت إعادة المنتجات المحددة للمتجر");
      } else if (payload.is_available === true) {
        setBulkMessage("أصبحت المنتجات المحددة متاحة للطلب");
      } else if (payload.is_available === false) {
        setBulkMessage("تم إيقاف الطلب على المنتجات المحددة");
      } else if (payload.category) {
        setBulkMessage("تم تغيير تصنيف المنتجات المحددة");
      } else {
        setBulkMessage("تم تحديث المنتجات المحددة");
      }
    });
  };

  const handleRequestBulkArchive = () => {
    if (!isConfirmingBulkArchive) {
      setIsConfirmingBulkArchive(true);
      return;
    }

    runBulkAction({ status: "archived" });
  };

  return (
    <section
      id={`section-panel-${SECTION_MY_PRODUCTS}`}
      role="tabpanel"
      aria-labelledby={`section-tab-${SECTION_MY_PRODUCTS}`}
      className={active ? "block" : "hidden"}
    >
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900">منتجاتك</h2>
        <p className="mt-1 text-sm text-gray-500">
          {displayedProductsCountLabel}
        </p>

        <div className="mt-3">
          <div className="relative">
            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              placeholder="ابحث بالاسم"
              inputMode="search"
              className="w-full rounded-md border border-brand-border px-4 py-2.5 pe-10 text-sm focus:border-brand-accent focus:outline-none focus:ring-4 focus:ring-brand-accent/15"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={handleClearSearch}
                aria-label="مسح البحث"
                className="absolute inset-y-0 end-0 pe-3 text-gray-400 transition-colors hover:text-gray-600"
              >
                <svg
                  className="h-4 w-4"
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
            )}
          </div>
          {needsMoreSearchChars && (
            <p className="mt-2 text-xs text-gray-500">
              اكتب حرفين أو أكثر لبدء البحث
            </p>
          )}
          {isSearchLoading && (
            <p className="mt-2 text-xs text-gray-500">جاري البحث...</p>
          )}
          {!isSearchLoading && searchError && (
            <p className="mt-2 text-xs text-red-600">{searchError}</p>
          )}
        </div>

        <div
          className="mt-3 flex gap-2 overflow-x-auto pb-1"
          aria-label="فلترة المنتجات حسب الحالة"
        >
          {productStatusFilters.map((filter) => {
            const isActive = productStatusFilter === filter.id;

            return (
              <button
                key={filter.id}
                type="button"
                onClick={() => onProductStatusFilterChange(filter.id)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold transition ${
                  isActive
                    ? "border-brand-primary bg-brand-primary text-white shadow-sm"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                }`}
                aria-pressed={isActive}
              >
                {filter.label}
              </button>
            );
          })}
        </div>

        <div
          className="mt-3 flex gap-2 overflow-x-auto pb-1"
          aria-label="فلترة المنتجات حسب التصنيف"
        >
          <button
            type="button"
            onClick={() => onCategoryFilterChange(allCategoryFilterKey)}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              categoryFilter === allCategoryFilterKey
                ? "border-brand-primary bg-brand-primary text-white shadow-sm"
                : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
            }`}
            aria-pressed={categoryFilter === allCategoryFilterKey}
          >
            <span>كل التصنيفات</span>
            <span
              className={`rounded-full px-1.5 py-0.5 text-[11px] ${
                categoryFilter === allCategoryFilterKey
                  ? "bg-white/20 text-white"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {allCategoryCountLabel}
            </span>
          </button>

          {categoryFilterCounts.map((category) => {
            const isActive = categoryFilter === category.category;
            const countLabel = formatArabicInteger(category.count) || category.count;

            return (
              <button
                key={category.category}
                type="button"
                onClick={() => onCategoryFilterChange(category.category)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  isActive
                    ? "border-brand-primary bg-brand-primary text-white shadow-sm"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                }`}
                aria-pressed={isActive}
              >
                <span>{category.category}</span>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[11px] ${
                    isActive ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {countLabel}
                </span>
              </button>
            );
          })}
        </div>

        <div
          className="mt-3 flex gap-2 overflow-x-auto pb-1"
          aria-label="فلترة المنتجات حسب التوفر"
        >
          {availabilityFilters.map((filter) => {
            const isActive = availabilityFilter === filter.id;
            const count = availabilityFilterCounts[filter.id] || 0;
            const countLabel = formatArabicInteger(count) || count;

            return (
              <button
                key={filter.id}
                type="button"
                onClick={() => onAvailabilityFilterChange(filter.id)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  isActive
                    ? "border-gray-900 bg-gray-900 text-white shadow-sm"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                }`}
                aria-pressed={isActive}
              >
                <span>{filter.label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[11px] ${
                    isActive ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {countLabel}
                </span>
              </button>
            );
          })}
        </div>

        <div className="lg:pe-1">
          {bulkUpdateProducts && displayedProducts.length > 0 ? (
            <div
              className={`mt-4 rounded-xl border p-3 transition-colors ${
                hasSelectedProducts
                  ? "border-brand-accent/40 bg-brand-soft/45"
                  : "border-gray-200 bg-gray-50"
              }`}
              aria-label="إجراءات على المنتجات المختارة"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-gray-900">
                    إجراءات على المنتجات المحددة
                  </h3>
                  <p
                    className="mt-1 text-xs font-semibold text-gray-600"
                    aria-live="polite"
                  >
                    {hasSelectedProducts
                      ? `تم تحديد ${selectedCountLabel} منتج`
                      : "حدد منتجات لتطبيق إجراء عليها"}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedIds(allVisibleSelected ? [] : visibleIds)
                    }
                    className="inline-flex min-h-11 items-center gap-2 rounded-md border border-gray-200 bg-white px-3 text-xs font-bold text-gray-700 shadow-sm transition hover:border-brand-accent hover:bg-white"
                    aria-pressed={allVisibleSelected}
                  >
                    {allVisibleSelected ? (
                      <CheckSquare className="h-4 w-4" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                    {allVisibleSelected
                      ? "إلغاء تحديد المعروض"
                      : "تحديد المعروض"}
                    <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500">
                      {visibleCountLabel}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedIds([])}
                    disabled={!hasSelectedProducts || isBulkPending}
                    className="inline-flex min-h-11 items-center gap-2 rounded-md border border-gray-200 bg-white px-3 text-xs font-bold text-gray-700 shadow-sm transition hover:border-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <X className="h-4 w-4" />
                    إلغاء التحديد
                  </button>
                </div>
              </div>

              {bulkMessage ? (
                <p
                  className="mt-3 rounded-md border border-brand-accent/20 bg-white px-3 py-2 text-xs font-semibold text-brand-primary"
                  role="status"
                  aria-live="polite"
                >
                  {bulkMessage}
                </p>
              ) : null}

              {productStatusFilter === "active" ? (
                <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(280px,1fr)_auto] xl:items-end">
                  <div className="grid gap-2 sm:grid-cols-[minmax(220px,1fr)_auto] sm:items-end">
                    <Combobox
                      name="bulk_category"
                      label="التصنيف الجديد"
                      options={bulkCategoryOptions}
                      value={bulkCategory}
                      onValueChange={setBulkCategory}
                      inputClassName="h-11 px-3 text-sm bg-white"
                      labelClassName="text-xs font-bold"
                      placeholder="اكتب أو اختار التصنيف"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={
                        isBulkPending ||
                        !hasSelectedProducts ||
                        !bulkCategory.trim()
                      }
                      onClick={() => runBulkAction({ category: bulkCategory })}
                      className="min-h-11 shrink-0 px-3"
                    >
                      <Tag className="h-4 w-4" />
                      غيّر التصنيف
                    </Button>
                  </div>

                  <div className="flex gap-2 overflow-x-auto pb-1 xl:justify-end xl:pb-0">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={isBulkPending || !hasSelectedProducts}
                      onClick={() => runBulkAction({ is_available: true })}
                      className="min-h-11 shrink-0 px-3"
                      title="ستصبح المنتجات ظاهرة ومتاحة للطلب"
                    >
                      <CheckCircle className="h-4 w-4" />
                      إتاحة الطلب
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={isBulkPending || !hasSelectedProducts}
                      onClick={() => runBulkAction({ is_available: false })}
                      className="min-h-11 shrink-0 px-3"
                      title="ستبقى المنتجات ظاهرة ولكن لن يتمكن العميل من طلبها"
                    >
                      <Ban className="h-4 w-4" />
                      إيقاف الطلب عليها
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={
                        isConfirmingBulkArchive ? "destructive" : "outline"
                      }
                      disabled={isBulkPending || !hasSelectedProducts}
                      onClick={handleRequestBulkArchive}
                      className="min-h-11 shrink-0 px-3"
                      title="سيتم حذف المنتجات من المتجر ويمكنك إعادتها لاحقاً"
                    >
                      <Archive className="h-4 w-4" />
                      {isConfirmingBulkArchive
                        ? "تأكيد الحذف"
                        : "حذف من المتجر"}
                    </Button>
                    {isConfirmingBulkArchive ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={isBulkPending}
                        onClick={() => setIsConfirmingBulkArchive(false)}
                        className="min-h-11 shrink-0 px-3"
                      >
                        إلغاء
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={isBulkPending || !hasSelectedProducts}
                    onClick={() => runBulkAction({ status: "active" })}
                    className="min-h-11 shrink-0 px-3"
                  >
                    <RotateCcw className="h-4 w-4" />
                    إعادة للمتجر
                  </Button>
                </div>
              )}
            </div>
          ) : null}
          {displayedProducts.length === 0 && !isSearchLoading ? (
            <div className="mt-4 flex flex-col items-center justify-center rounded-xl border border-dashed border-brand-border bg-gray-50/50 p-8 text-center">
              {isFilteredList ? (
                <p className="text-sm text-gray-500">لا توجد نتائج مطابقة.</p>
              ) : (
                <>
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft text-brand-primary">
                    <PackageOpen className="h-7 w-7" />
                  </div>
                  <h3 className="mb-2 text-lg font-bold text-gray-900">
                    متجرك فارغ؟
                  </h3>
                  <p className="mb-6 max-w-sm text-sm text-gray-500 leading-relaxed">
                    أضف أهم المنتجات الأساسية في السوق المصري بأسعار استرشادية.
                  </p>
                  <button
                    type="button"
                    onClick={onOpenBulkWizard}
                    className="rounded-lg bg-brand-primary px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-primary/90"
                  >
                    أضف التشكيلة الأساسية
                  </button>
                </>
              )}
            </div>
          ) : (
            <ul className="mt-4 space-y-2">
              {displayedProducts.map((product) => {
                const isConfirmingRemoval =
                  allowProductRemoval && confirmRemoveProductId === product.id;
                const isRemoving = removingProductId === product.id;
                const isAvailabilityPending =
                  availabilityPendingProductId === product.id;
                const isHighlighted = highlightedProductId === product.id;
                let availabilityActionLabel = "إيقاف الطلب";
                let AvailabilityIcon = Ban;
                if (isAvailabilityPending) {
                  availabilityActionLabel = "جاري...";
                } else if (product.is_available === false) {
                  availabilityActionLabel = "إتاحة الطلب";
                  AvailabilityIcon = CheckCircle;
                }
                const availabilityActionClass =
                  product.is_available === false
                    ? "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                    : "border-amber-200 text-amber-700 hover:bg-amber-50";

                return (
                  <li
                    key={product.id}
                    ref={(node) => setProductRowRef(product.id, node)}
                    tabIndex={-1}
                    className={`flex flex-wrap sm:flex-nowrap items-start sm:items-center justify-between gap-3 rounded-xl border px-3 py-3 sm:py-2 transition ${
                      isHighlighted
                        ? "border-amber-300 bg-amber-50 ring-2 ring-amber-200"
                        : "border-gray-100"
                    }`}
                  >
                    <div className="flex min-w-0 flex-1 items-start sm:items-center gap-3 w-full sm:w-auto">
                      {bulkUpdateProducts ? (
                        <button
                          type="button"
                          onClick={() => toggleSelectedProduct(product.id)}
                          className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border ${
                            selectedSet.has(product.id)
                              ? "border-brand-primary bg-brand-primary text-white"
                              : "border-gray-200 bg-white text-gray-600"
                          }`}
                          aria-label={`تحديد ${product.name}`}
                          aria-pressed={selectedSet.has(product.id)}
                        >
                          {selectedSet.has(product.id) ? (
                            <CheckSquare className="h-5 w-5" />
                          ) : (
                            <Square className="h-5 w-5" />
                          )}
                        </button>
                      ) : null}
                      {resolveImageUrl(product.image_url) ? (
                        <ImageThumbnail
                          src={resolveImageUrl(product.image_url)}
                          alt={product.name}
                          width={40}
                          height={40}
                          unoptimized
                          imageClassName="h-10 w-10 shrink-0 rounded-lg border border-gray-200 bg-gray-50 object-cover"
                          fallback={
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 text-[10px] text-gray-500">
                              صورة
                            </div>
                          }
                        />
                      ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 text-[10px] text-gray-500">
                          صورة
                        </div>
                      )}

                      <div className="min-w-0">
                        <span className="block whitespace-normal break-words text-sm font-medium leading-6 text-gray-900">
                          {product.name}
                        </span>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-brand-soft px-2 py-1 text-xs font-semibold text-brand-primary">
                            {resolveProductPriceText(product.current_price) ||
                              "السعر غير محدد"}
                          </span>
                          <span className="rounded-full bg-status-success/15 px-2 py-1 text-xs font-semibold text-status-success">
                            {normalizeModeBadge(product.order_mode)}
                          </span>
                          {!product.is_available && (
                            <span className="rounded-full bg-status-error/15 px-2 py-1 text-xs font-semibold text-status-error">
                              غير متاح للطلب
                            </span>
                          )}
                          {product.price_needs_review && (
                            <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-300">
                              راجع السعر
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2 mt-1 sm:mt-0 self-end sm:self-auto w-full sm:w-auto justify-end border-t border-gray-100 pt-3 sm:border-0 sm:pt-0">
                      {isConfirmingRemoval ? (
                        <>
                          <button
                            type="button"
                            onClick={() => onRemoveProduct(product)}
                            disabled={isRemoving}
                            className="flex items-center gap-1.5 rounded-lg bg-red-600 p-2 sm:px-3 sm:py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="max-sm:hidden">
                              {isRemoving ? "جاري الحذف..." : "تأكيد الحذف"}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={onCancelRemove}
                            disabled={isRemoving}
                            className="flex items-center gap-1.5 rounded-lg border border-gray-300 p-2 sm:px-3 sm:py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                            title="إلغاء"
                          >
                            <X className="h-4 w-4" />
                            <span className="max-sm:hidden">إلغاء</span>
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => onStartEdit(product)}
                            disabled={isRemoving || isAvailabilityPending}
                            className="flex items-center gap-1.5 rounded-lg border border-gray-300 p-2 sm:px-3 sm:py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                            title="تعديل"
                          >
                            <Pencil className="h-4 w-4" />
                            <span className="max-sm:hidden">تعديل</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onToggleAvailability(product)}
                            disabled={Boolean(removingProductId) || isAvailabilityPending}
                            className={`flex items-center gap-1.5 rounded-lg border p-2 sm:px-3 sm:py-1.5 text-xs font-semibold disabled:opacity-60 ${availabilityActionClass}`}
                            title={availabilityActionLabel}
                          >
                            <AvailabilityIcon className="h-4 w-4" />
                            <span className="max-sm:hidden">{availabilityActionLabel}</span>
                          </button>
                          {allowProductRemoval ? (
                            <button
                              type="button"
                              onClick={() => onRequestRemove(product.id)}
                              disabled={Boolean(removingProductId) || isAvailabilityPending}
                              className="flex items-center gap-1.5 rounded-lg border border-red-200 p-2 sm:px-3 sm:py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                              title="حذف من المتجر"
                            >
                              <Trash2 className="h-4 w-4" />
                              <span className="max-sm:hidden">حذف</span>
                            </button>
                          ) : null}
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
