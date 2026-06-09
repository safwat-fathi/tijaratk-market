import { useEffect, useRef } from "react";
import SafeImage from "@/components/ui/SafeImage";
import type { CatalogItem, PublicProductsMeta } from "@/types/models/product";
import { formatArabicInteger, formatArabicNumber } from "@/lib/utils/number";
import { ScrollableTabList, TabButton } from "@/components/ui/ScrollableTabs";
import type { CategoryTab } from "../_utils/product-onboarding.types";
import { SECTION_CATALOG } from "../_utils/product-onboarding.constants";
import { resolveImageUrl } from "../_utils/product-onboarding";

type CatalogSectionProps = {
  active: boolean;
  catalogItems: CatalogItem[];
  categoryTabs: CategoryTab[];
  activeCategory: string;
  onCategoryChange: (category: string) => void;
  searchQuery?: string;
  onSearchQueryChange?: (value: string) => void;
  onClearSearchQuery?: () => void;
  catalogMeta: PublicProductsMeta;
  isLoadingCatalog: boolean;
  catalogError: string | null;
  onLoadMore: () => void;
  pendingCatalogIds: Record<number, boolean>;
  onAddFromCatalog: (item: CatalogItem) => void;
};

export default function CatalogSection({
  active,
  catalogItems,
  categoryTabs,
  activeCategory,
  onCategoryChange,
  searchQuery = "",
  onSearchQueryChange,
  onClearSearchQuery,
  catalogMeta,
  isLoadingCatalog,
  catalogError,
  onLoadMore,
  pendingCatalogIds,
  onAddFromCatalog,
}: CatalogSectionProps) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const handleClearSearch = () => {
    onClearSearchQuery?.();
    searchInputRef.current?.focus();
  };

  useEffect(() => {
    if (!active || !catalogMeta.has_next || isLoadingCatalog) {
      return;
    }

    const sentinel = sentinelRef.current;
    if (!sentinel) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          onLoadMore();
        }
      },
      { rootMargin: "240px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [active, catalogMeta.has_next, isLoadingCatalog, onLoadMore]);

  return (
    <section
      id={`section-panel-${SECTION_CATALOG}`}
      role="tabpanel"
      aria-labelledby={`section-tab-${SECTION_CATALOG}`}
      className={active ? "block" : "hidden"}
    >
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900">
          اختار من منتجات جاهزة
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          اضغط إضافة ويتم حفظ المنتج فوراً. متاح الآن{" "}
          {formatArabicInteger(catalogMeta.total) || catalogMeta.total} منتج من
          قاعدة البيانات.
        </p>

        <div className="mt-4">
          <div className="relative">
            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(event) => onSearchQueryChange?.(event.target.value)}
              placeholder="ابحث بالاسم في الكتالوج"
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
        </div>

        <ScrollableTabList className="mb-4 mt-4">
          {categoryTabs.map((category) => (
            <TabButton
              key={category.key}
              variant="pill"
              isActive={activeCategory === category.key}
              onClick={() => onCategoryChange(category.key)}
              className="rounded-2xl"
            >
              <span className="flex items-center gap-2">
                <SafeImage
                  src={category.imageUrl}
                  alt={category.label}
                  width={40}
                  height={40}
                  sizes="40px"
                  loading="lazy"
                  quality={70}
                  imageClassName="h-10 w-10 rounded object-cover ring-1 ring-gray-200"
                  fallback={
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 text-[10px]">
                      🛒
                    </span>
                  }
                />
                <span className="whitespace-nowrap text-sm font-medium">
                  {category.label}
                </span>
                <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500">
                  {formatArabicInteger(category.count) || category.count}
                </span>
              </span>
            </TabButton>
          ))}
        </ScrollableTabList>

        <div className="lg:max-h-[58vh] lg:overflow-y-auto lg:pe-1">
          {catalogItems.length === 0 && !isLoadingCatalog ? (
            <p className="mt-4 rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-500">
              لا توجد منتجات في الكتالوج حالياً
            </p>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {catalogItems.map((item) => {
                const catalogItemImageUrl = resolveImageUrl(item.image_url);

                return (
                  <div
                    key={item.id}
                    className="rounded-xl border border-gray-200 p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {catalogItemImageUrl ? (
                          <SafeImage
                            src={catalogItemImageUrl}
                            alt={item.name}
                            width={56}
                            height={56}
                            sizes="56px"
                            loading="lazy"
                            quality={70}
                            imageClassName="h-14 w-14 rounded-lg border border-gray-200 bg-gray-50 object-cover"
                            fallback={
                              <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 px-1 text-center text-[10px] leading-4 text-gray-500">
                                لا توجد صورة
                              </div>
                            }
                          />
                        ) : (
                          <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 px-1 text-center text-[10px] leading-4 text-gray-500">
                            لا توجد صورة
                          </div>
                        )}

                        <div>
                          <p className="font-semibold text-gray-900">
                            {item.name}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                            <span>{item.category}</span>
                            {item.price !== null && item.price !== undefined ? (
                              <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">
                                {formatArabicNumber(item.price, {
                                  minimumFractionDigits: 0,
                                  maximumFractionDigits: 2,
                                }) || item.price}{" "}
                                {item.currency || "EGP"}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onAddFromCatalog(item)}
                        disabled={Boolean(pendingCatalogIds[item.id])}
                        className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {pendingCatalogIds[item.id] ? "...جاري" : "إضافة"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div ref={sentinelRef} className="h-1" />
          {isLoadingCatalog ? (
            <p className="mt-4 rounded-xl bg-gray-50 p-3 text-center text-sm font-medium text-gray-500">
              جاري تحميل المزيد...
            </p>
          ) : null}
          {catalogError ? (
            <div className="mt-4 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">
              <p>{catalogError}</p>
              {catalogMeta.has_next ? (
                <button
                  type="button"
                  onClick={onLoadMore}
                  className="mt-2 font-semibold text-red-800 underline"
                >
                  حاول مرة أخرى
                </button>
              ) : null}
            </div>
          ) : null}
          {!isLoadingCatalog && catalogMeta.has_next ? (
            <button
              type="button"
              onClick={onLoadMore}
              className="mt-4 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              تحميل المزيد
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
