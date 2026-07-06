import { useCallback, useEffect, useRef } from "react";
import ImageThumbnail from "@/components/ui/ImageThumbnail";
import { getImageUrl } from "@/lib/utils/image";
import type { CategoryTab } from "../_utils/order-form";

type CategoryEntryGridProps = {
  categoryCards: CategoryTab[];
  onSelectCategory: (categoryKey: string) => void;
  onShowAll: () => void;
  onCategoryInView?: (categoryKey: string) => void;
};

export default function CategoryEntryGrid({
  categoryCards,
  onSelectCategory,
  onShowAll,
  onCategoryInView,
}: CategoryEntryGridProps) {
  const categoryButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const seenInViewRef = useRef<Set<string>>(new Set());
  const observerRef = useRef<IntersectionObserver | null>(null);

  const setCategoryButtonRef = useCallback(
    (categoryKey: string, node: HTMLButtonElement | null) => {
      const previousNode = categoryButtonRefs.current.get(categoryKey);
      if (previousNode && observerRef.current) {
        observerRef.current.unobserve(previousNode);
      }

      if (!node) {
        categoryButtonRefs.current.delete(categoryKey);
        return;
      }

      categoryButtonRefs.current.set(categoryKey, node);
      if (observerRef.current && !seenInViewRef.current.has(categoryKey)) {
        observerRef.current.observe(node);
      }
    },
    [],
  );

  useEffect(() => {
    if (!onCategoryInView) {
      observerRef.current?.disconnect();
      observerRef.current = null;
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            continue;
          }

          const categoryKey = entry.target.getAttribute("data-category-key");
          if (!categoryKey || seenInViewRef.current.has(categoryKey)) {
            continue;
          }

          seenInViewRef.current.add(categoryKey);
          onCategoryInView(categoryKey);
          observer.unobserve(entry.target);
        }
      },
      {
        root: null,
        threshold: 0.15,
        rootMargin: "200px 0px 200px 0px",
      },
    );

    observerRef.current = observer;
    for (const [categoryKey, node] of categoryButtonRefs.current.entries()) {
      if (node && !seenInViewRef.current.has(categoryKey)) {
        observer.observe(node);
      }
    }

    return () => {
      observer.disconnect();
      observerRef.current = null;
    };
  }, [categoryCards, onCategoryInView]);

  return (
    <div className="rounded-lg border border-brand-border bg-white p-4 shadow-soft">
      <h2 className="text-lg font-bold text-brand-text">اختار القسم</h2>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {categoryCards.length > 0 ? (
          categoryCards.map((category) => (
            <button
              key={category.key}
              ref={(node) => setCategoryButtonRef(category.key, node)}
              data-category-key={category.key}
              type="button"
              onClick={() => onSelectCategory(category.key)}
              className="flex min-h-[120px] flex-col items-center justify-center rounded-lg border border-brand-border bg-brand-soft/50 px-2 py-3 text-center shadow-sm transition-transform active:scale-[0.97] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/20"
            >
              <ImageThumbnail
                src={
                  category.image_url ? getImageUrl(category.image_url) : null
                }
                alt={category.label}
                width={54}
                height={54}
                sizes="56px"
                disableEnlarge={true}
                imageClassName="h-14 w-14 rounded-md object-cover ring-1 ring-brand-border"
                fallback={<span className="text-2xl">🛒</span>}
              />
              <span className="mt-2 text-sm font-semibold text-brand-text">
                {category.label}
              </span>
            </button>
          ))
        ) : (
          <div className="col-span-2 rounded-md border border-dashed border-brand-border bg-white p-4 text-center text-sm text-muted-foreground">
            لا توجد أقسام حالياً.
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onShowAll}
        className="mt-3 w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700"
      >
        عرض كل المنتجات
      </button>
    </div>
  );
}
