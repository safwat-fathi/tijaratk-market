import SafeImage from "@/components/ui/SafeImage";
import type { CatalogItem } from "@/types/models/product";
import { formatArabicInteger } from "@/lib/utils/number";
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
  filteredCatalogItems: CatalogItem[];
  pendingCatalogIds: Record<number, boolean>;
  onAddFromCatalog: (item: CatalogItem) => void;
};

export default function CatalogSection({
  active,
  catalogItems,
  categoryTabs,
  activeCategory,
  onCategoryChange,
  filteredCatalogItems,
  pendingCatalogIds,
  onAddFromCatalog,
}: CatalogSectionProps) {
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
          {formatArabicInteger(catalogItems.length) || catalogItems.length} منتج
          من قاعدة البيانات.
        </p>

        <ScrollableTabList className="mb-4 mt-3">
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
                  unoptimized
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
          {filteredCatalogItems.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-500">
              لا توجد منتجات في الكتالوج حالياً. شغّل seeder لإضافة عناصر
              الكتالوج ثم حدّث الصفحة.
            </p>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {filteredCatalogItems.map((item) => {
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
                            unoptimized
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
                          <p className="text-xs text-gray-500">
                            {item.category}
                          </p>
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
        </div>
      </div>
    </section>
  );
}
