import type { Product } from "@/types/models/product";
import ProductList, {
  type AvailabilityRequestOutcome,
  type ProductCartSelection,
} from "./ProductList";
import CategoryProductsTab from "./CategoryProductsTab";
import type { CategoryTab, PaginationState } from "../_utils/order-form";

type CategoryProductsViewProps = {
  categoryTabs: CategoryTab[];
  activeCategory: string;
  searchTerm?: string;
  activeProducts: Product[];
  activePagination: PaginationState;
  hasMoreInActiveCategory: boolean;
  activeLoadMoreIndex: number;
  cartSelections: Record<number, ProductCartSelection>;
  onBack: () => void;
  onCategoryChange: (categoryKey: string) => void;
  setCategoryPillRef: (
    categoryKey: string,
    node: HTMLElement | null,
  ) => void;
  onUpdateSelection: (
    product: Product,
    selection: ProductCartSelection | null,
  ) => void;
  onProductAdded: () => void;
  onRequestAvailability: (
    product: Product,
  ) => Promise<AvailabilityRequestOutcome>;
  onRequestCustomAvailability: (
    requestedProductName: string,
  ) => Promise<AvailabilityRequestOutcome>;
  setLoadMoreTarget: (node: HTMLDivElement | null) => void;
};

export default function CategoryProductsView({
  categoryTabs,
  activeCategory,
  searchTerm = "",
  activeProducts,
  activePagination,
  hasMoreInActiveCategory,
  activeLoadMoreIndex,
  cartSelections,
  onBack,
  onCategoryChange,
  setCategoryPillRef,
  onUpdateSelection,
  onProductAdded,
  onRequestAvailability,
  onRequestCustomAvailability,
  setLoadMoreTarget,
}: CategoryProductsViewProps) {
  const activeLabel =
    categoryTabs.find((item) => item.key === activeCategory)?.label ||
    "المنتجات";
  const hasProducts = activeProducts.length > 0;
  const isInitialCategoryLoading =
    !hasProducts && (activePagination.isLoading || !activePagination.hasLoaded);
  const shouldShowEmptyState =
    activePagination.hasLoaded &&
    !activePagination.isLoading &&
    !activePagination.error &&
    !hasProducts;
  const emptyStateMessage = searchTerm
    ? "لا توجد نتائج لهذا البحث."
    : "لا توجد منتجات في هذا القسم حالياً.";

  return (
    <div className="w-full min-w-0 rounded-lg border border-brand-border bg-white p-4 shadow-soft">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="min-h-11 rounded-md border border-brand-border px-3 py-2 text-sm font-semibold text-brand-text transition-colors hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/20"
        >
          رجوع
        </button>
        <p className="min-w-0 truncate text-sm font-semibold text-brand-text">
          {activeLabel}
        </p>
        <div className="w-16 shrink-0"></div>
      </div>

      <div className="py-2">
        <CategoryProductsTab
          categoryTabs={categoryTabs}
          activeCategory={activeCategory}
          onCategoryChange={onCategoryChange}
          setCategoryPillRef={setCategoryPillRef}
        />
      </div>

      {(hasProducts || shouldShowEmptyState) && (
        <ProductList
          products={activeProducts}
          selections={cartSelections}
          onUpdateSelection={onUpdateSelection}
          onAdded={onProductAdded}
          onRequestAvailability={onRequestAvailability}
          onRequestCustomAvailability={onRequestCustomAvailability}
          loadMoreTriggerIndex={
            hasMoreInActiveCategory ? activeLoadMoreIndex : undefined
          }
          setLoadMoreTarget={setLoadMoreTarget}
        />
      )}

      {isInitialCategoryLoading && (
        <div className="flex justify-center py-6">
          <svg
            className="h-6 w-6 animate-spin text-gray-400"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            ></path>
          </svg>
        </div>
      )}

      {shouldShowEmptyState && (
        <div className="mt-3 rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
          {emptyStateMessage}
        </div>
      )}

      {activePagination.error && (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {activePagination.error}
        </div>
      )}

      {activePagination.isLoading && hasProducts && (
        <div className="mt-4 flex justify-center">
          <svg
            className="h-6 w-6 animate-spin text-gray-400"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            ></path>
          </svg>
        </div>
      )}
    </div>
  );
}
