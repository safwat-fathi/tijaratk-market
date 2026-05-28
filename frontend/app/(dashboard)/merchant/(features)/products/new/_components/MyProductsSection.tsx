import { useRef } from "react";
import SafeImage from "@/components/ui/SafeImage";
import type { Product } from "@/types/models/product";
import { SECTION_MY_PRODUCTS } from "../_utils/product-onboarding.constants";
import {
  normalizeModeBadge,
  resolveImageUrl,
  resolveProductPriceText,
} from "../_utils/product-onboarding";

type MyProductsSectionProps = {
  active: boolean;
  displayedProductsCountLabel: string;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onClearSearchQuery: () => void;
  needsMoreSearchChars: boolean;
  isSearchLoading: boolean;
  searchError: string | null;
  isSearchActive: boolean;
  displayedProducts: Product[];
  confirmRemoveProductId: number | null;
  removingProductId: number | null;
  highlightedProductId: number | null;
  onStartEdit: (product: Product) => void;
  onRequestRemove: (productId: number) => void;
  onRemoveProduct: (product: Product) => void;
  onCancelRemove: () => void;
  setProductRowRef: (productId: number, node: HTMLLIElement | null) => void;
};

export default function MyProductsSection({
  active,
  displayedProductsCountLabel,
  searchQuery,
  onSearchQueryChange,
  onClearSearchQuery,
  needsMoreSearchChars,
  isSearchLoading,
  searchError,
  isSearchActive,
  displayedProducts,
  confirmRemoveProductId,
  removingProductId,
  highlightedProductId,
  onStartEdit,
  onRequestRemove,
  onRemoveProduct,
  onCancelRemove,
  setProductRowRef,
}: MyProductsSectionProps) {
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const handleClearSearch = () => {
    onClearSearchQuery();
    searchInputRef.current?.focus();
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

        <div className="lg:max-h-[58vh] lg:overflow-y-auto lg:pe-1">
          {displayedProducts.length === 0 && !isSearchLoading ? (
            <p className="mt-4 rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-500">
              {isSearchActive
                ? "لا توجد نتائج مطابقة."
                : "لا توجد منتجات حتى الآن."}
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {displayedProducts.map((product) => {
                const isConfirmingRemoval =
                  confirmRemoveProductId === product.id;
                const isRemoving = removingProductId === product.id;
                const isHighlighted = highlightedProductId === product.id;

                return (
                  <li
                    key={product.id}
                    ref={(node) => setProductRowRef(product.id, node)}
                    tabIndex={-1}
                    className={`flex items-center justify-between rounded-xl border px-3 py-2 transition ${
                      isHighlighted
                        ? "border-amber-300 bg-amber-50 ring-2 ring-amber-200"
                        : "border-gray-100"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {resolveImageUrl(product.image_url) ? (
                        <SafeImage
                          src={resolveImageUrl(product.image_url)}
                          alt={product.name}
                          width={40}
                          height={40}
                          unoptimized
                          imageClassName="h-10 w-10 rounded-lg border border-gray-200 bg-gray-50 object-cover"
                          fallback={
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 text-[10px] text-gray-500">
                              صورة
                            </div>
                          }
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 text-[10px] text-gray-500">
                          صورة
                        </div>
                      )}

                      <div>
                        <span className="block text-sm font-medium text-gray-900">
                          {product.name}
                        </span>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">
                            {product.source === "catalog" ? "كتالوج" : "يدوي"}
                          </span>
                          <span className="rounded-full bg-brand-soft px-2 py-1 text-xs font-semibold text-brand-primary">
                            {resolveProductPriceText(product.current_price) ||
                              "السعر غير محدد"}
                          </span>
                          <span className="rounded-full bg-status-success/15 px-2 py-1 text-xs font-semibold text-status-success">
                            {normalizeModeBadge(product.order_mode)}
                          </span>
                          {!product.is_available && (
                            <span className="rounded-full bg-status-error/15 px-2 py-1 text-xs font-semibold text-status-error">
                              غير متاح
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isConfirmingRemoval ? (
                        <>
                          <button
                            type="button"
                            onClick={() => onRemoveProduct(product)}
                            disabled={isRemoving}
                            className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                          >
                            {isRemoving ? "...جاري الحذف" : "تأكيد الحذف"}
                          </button>
                          <button
                            type="button"
                            onClick={onCancelRemove}
                            disabled={isRemoving}
                            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                          >
                            إلغاء
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => onStartEdit(product)}
                            disabled={isRemoving}
                            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                          >
                            تعديل
                          </button>
                          <button
                            type="button"
                            onClick={() => onRequestRemove(product.id)}
                            disabled={Boolean(removingProductId)}
                            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                          >
                            حذف
                          </button>
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
