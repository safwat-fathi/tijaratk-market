"use client";

import { Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  loadStorefrontProductsAction,
  saveStorefrontCartDraftAction,
} from "@/actions/storefront-cart-actions";
import { formatCurrency } from "@/lib/utils/currency";
import { sendMetaPixelEvent } from "@/lib/analytics/meta-pixel";
import { sendCustomerAnalyticsEvent } from "@/lib/analytics/google-analytics";
import type {
  Product,
  PublicProductCategory,
  PublicProductsMeta,
} from "@/types/models/product";
import type { StorefrontCartDraft } from "@/types/models/storefront-cart-draft";
import type { Order } from "@/types/models/order";
import type { StorefrontOrderAvailability } from "@/types/models/delivery";
import { OrderSource } from "@/types/enums";
import CategoryProductsTab from "./CategoryProductsTab";
import { STOREFRONT_CART_CHANGED_EVENT } from "./HeaderCartButton";
import ProductList, { type ProductCartSelection } from "./ProductList";
import {
  ALL_PRODUCTS_CATEGORY,
  buildCategoryTabs,
  calculateCartSummary,
  resolveSelectionLineTotal,
} from "../_utils/order-form";

type StorefrontCatalogProps = {
  tenantSlug: string;
  initialProducts: Product[];
  initialMeta: PublicProductsMeta;
  categories: PublicProductCategory[];
  initialDraft: StorefrontCartDraft | null;
  reorderOrder?: Order | null;
  initialCategory?: string;
  orderSource?: OrderSource;
  sourceMetadata?: Record<string, unknown>;
  orderAvailability: StorefrontOrderAvailability;
};

const draftSelections = (draft: StorefrontCartDraft | null) =>
  Object.fromEntries(
    (draft?.items ?? []).map((item) => [
      item.product_id,
      {
        selection_mode: item.selection_mode,
        selection_quantity: item.selection_quantity,
        selection_grams: item.selection_grams,
        selection_amount_egp: item.selection_amount_egp,
        unit_option_id: item.unit_option_id,
        item_note: item.item_note,
      } satisfies ProductCartSelection,
    ] as const),
  ) as Record<number, ProductCartSelection>;

/** Merchant catalog browser with explicit pagination and durable cart writes. */
export default function StorefrontCatalog({
  tenantSlug,
  initialProducts,
  initialMeta,
  categories,
  initialDraft,
  reorderOrder,
  initialCategory,
  orderSource = OrderSource.STOREFRONT,
  sourceMetadata,
  orderAvailability,
}: StorefrontCatalogProps) {
  const router = useRouter();
  const [selections, setSelections] = useState(() => draftSelections(initialDraft));
  const selectionsRef = useRef(selections);
  const [products, setProducts] = useState(initialProducts);
  const [meta, setMeta] = useState(initialMeta);
  const [activeCategory, setActiveCategory] = useState(
    initialCategory || ALL_PRODUCTS_CATEGORY,
  );
  const [search, setSearch] = useState("");
  const normalizedSearch = search.trim();
  const validSearch = normalizedSearch.length >= 2 ? normalizedSearch : "";
  const [message, setMessage] = useState<string | null>(null);
  const [isCatalogBoundaryVisible, setIsCatalogBoundaryVisible] = useState(false);
  const [draftProducts, setDraftProducts] = useState(
    initialDraft?.items.map((item) => item.product) ?? [],
  );
  const [isLoading, startLoading] = useTransition();
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const lastSaveSucceeded = useRef(true);
  const searchRequest = useRef(0);
  const catalogBoundaryRef = useRef<HTMLDivElement | null>(null);

  const knownProducts = useMemo(
    () =>
      Object.fromEntries(
        [...draftProducts, ...products].map(
          (product) => [product.id, product] as const,
        ),
      ) as Record<number, Product>,
    [draftProducts, products],
  );
  const categoryTabs = useMemo(
    () => buildCategoryTabs(categories, initialProducts, initialMeta.total),
    [categories, initialMeta.total, initialProducts],
  );
  const summary = useMemo(
    () => calculateCartSummary(selections, knownProducts),
    [knownProducts, selections],
  );

  const persistSelections = (next: Record<number, ProductCartSelection>) => {
    saveQueue.current = saveQueue.current.catch(() => undefined).then(async () => {
      const result = await saveStorefrontCartDraftAction(tenantSlug, {
        items: Object.entries(next).map(([productId, selection]) => ({
          product_id: Number(productId),
          ...selection,
        })),
        free_text_payload: initialDraft?.free_text_payload || undefined,
        delivery_area_id: initialDraft?.delivery_area_id || undefined,
        unavailable_item_action: initialDraft?.unavailable_item_action,
        order_source: initialDraft?.order_source || orderSource,
        source_metadata:
          initialDraft?.source_metadata || sourceMetadata || undefined,
        prescription_unavailability_action:
          initialDraft?.prescription_unavailability_action || undefined,
      });
      lastSaveSucceeded.current = result.success;
      if (!result.success) setMessage(result.message || "تعذر حفظ السلة");
    }).catch(() => {
      lastSaveSucceeded.current = false;
      setMessage("تعذر حفظ السلة");
    });
  };

  const updateSelection = (
    product: Product,
    selection: ProductCartSelection | null,
  ) => {
    if (!orderAvailability.accepting_orders) return;
    setMessage(null);
    const next = { ...selectionsRef.current };
    const wasPresent = Boolean(next[product.id]);
    if (selection) next[product.id] = selection;
    else delete next[product.id];
    setSelections(next);
    selectionsRef.current = next;
    if (!wasPresent && selection) {
      const lineTotal = resolveSelectionLineTotal(selection, product);
      sendMetaPixelEvent("AddToCart", {
        content_ids: [String(product.id)],
        content_type: "product",
        currency: "EGP",
        value: lineTotal ?? 0,
        storefront_type: "tenant",
      });
      sendCustomerAnalyticsEvent("add_to_cart", {
        store_slug: tenantSlug,
        product_id: product.id,
      });
    }
    const nextCount = Object.keys(next).length;
    window.dispatchEvent(
      new CustomEvent(STOREFRONT_CART_CHANGED_EVENT, { detail: nextCount }),
    );
    persistSelections(next);
  };

  const replaceWithReorder = async () => {
    if (!reorderOrder || !orderAvailability.accepting_orders) return;
    const next = Object.fromEntries(
      reorderOrder.items.flatMap((item) => {
        if (!item.product_id) return [];
        const mode = item.selection_mode || "quantity";
        const selection: ProductCartSelection =
          mode === "weight"
            ? { selection_mode: "weight", selection_grams: Number(item.selection_grams || 0) }
            : mode === "price"
              ? { selection_mode: "price", selection_amount_egp: Number(item.selection_amount_egp || 0) }
              : {
                  selection_mode: "quantity",
                  selection_quantity:
                    Number(item.selection_quantity || 0) || Number(item.quantity || 1),
                  unit_option_id: item.unit_option_id || undefined,
                };
        return [[item.product_id, selection] as const];
      }),
    ) as Record<number, ProductCartSelection>;
    const result = await saveStorefrontCartDraftAction(tenantSlug, {
      items: Object.entries(next).map(([productId, selection]) => ({
        product_id: Number(productId),
        ...selection,
      })),
      free_text_payload: reorderOrder.free_text_payload?.text,
      unavailable_item_action:
        reorderOrder.unavailable_item_action || undefined,
      order_source: orderSource,
      source_metadata: sourceMetadata,
    });
    if (!result.success || !result.data) {
      setMessage(result.message || "تعذر إعادة الطلب");
      return;
    }
    const reorderedSelections = draftSelections(result.data);
    setSelections(reorderedSelections);
    selectionsRef.current = reorderedSelections;
    setDraftProducts(result.data.items.map((item) => item.product));
    window.dispatchEvent(
      new CustomEvent(STOREFRONT_CART_CHANGED_EVENT, {
        detail: result.data.items.length,
      }),
    );
    setMessage("تم استبدال السلة بمنتجات الطلب السابق");
  };

  const fetchProducts = useCallback((
    page: number,
    category: string,
    searchTerm: string,
    append: boolean,
  ) => {
    const requestId = ++searchRequest.current;
    startLoading(async () => {
      const result = await loadStorefrontProductsAction(tenantSlug, {
        category: category === ALL_PRODUCTS_CATEGORY ? undefined : category,
        search: searchTerm || undefined,
        page,
      });
      if (requestId !== searchRequest.current) return;
      if (!result.success || !result.data) {
        setMessage(result.message || "تعذر تحميل المنتجات");
        return;
      }
      setMessage(null);
      const pageData = result.data;
      setProducts((current) =>
        append
          ? Array.from(
              new Map(
                [...current, ...pageData.data].map(
                  (item) => [item.id, item] as const,
                ),
              ).values(),
            )
          : pageData.data,
      );
      setMeta(pageData.meta);
    });
  }, [tenantSlug]);

  useEffect(() => {
    const timeout = window.setTimeout(
      () => fetchProducts(1, activeCategory, validSearch, false),
      300,
    );
    return () => window.clearTimeout(timeout);
  }, [activeCategory, fetchProducts, validSearch]);

  useEffect(() => {
    if (!validSearch) return;
    sendMetaPixelEvent("Search", {
      search_string: validSearch.slice(0, 100),
      storefront_type: "tenant",
    });
  }, [validSearch]);

  useEffect(() => {
    const catalogBoundary = catalogBoundaryRef.current;
    if (!catalogBoundary) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsCatalogBoundaryVisible(entry.isIntersecting),
      { rootMargin: "0px 0px 96px 0px" },
    );
    observer.observe(catalogBoundary);

    return () => observer.disconnect();
  }, []);

  return (
    <div className="px-4 pb-4 pt-5" dir="rtl">
      {!orderAvailability.accepting_orders ? (
        <div
          id="storefront-ordering-unavailable"
          className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center"
          role="status"
        >
          <p className="font-black text-amber-950">الطلبات متوقفة حالياً</p>
          <p className="mt-1 text-sm font-semibold leading-6 text-amber-900">
            {orderAvailability.message ||
              "هذا المتجر لا يستقبل الطلبات حالياً."}
          </p>
          <p className="mt-1 text-xs text-amber-800">
            يمكنك تصفح المنتجات والعودة لاحقاً.
          </p>
        </div>
      ) : null}

      {reorderOrder && orderAvailability.accepting_orders ? (
        <div className="mb-4 rounded-2xl border border-brand-accent/30 bg-brand-soft p-4">
          <p className="font-black text-brand-text">إعادة الطلب السابق</p>
          <p className="mt-1 text-sm text-muted-foreground">
            سيؤدي هذا إلى استبدال محتويات السلة الحالية.
          </p>
          <button
            type="button"
            onClick={replaceWithReorder}
            className="mt-3 min-h-11 rounded-xl bg-brand-primary px-4 text-sm font-bold text-white"
          >
            استبدال السلة وإعادة الطلب
          </button>
        </div>
      ) : null}
      <div className="sticky z-30 rounded-2xl border border-brand-border bg-white/95 p-4 shadow-soft backdrop-blur-xl" style={{ top: '131px' }}>
        <label className="relative block">
          <span className="sr-only">ابحث عن منتج</span>
          <Search className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(event) => {
              searchRequest.current += 1;
              setMessage(null);
              setSearch(event.target.value);
            }}
            placeholder="بحث عن منتج..."
            className="min-h-12 w-full rounded-xl border border-brand-border bg-brand-soft/30 py-3 pr-12 pl-4 text-base outline-none focus:border-brand-accent focus:ring-4 focus:ring-brand-accent/15"
          />
        </label>
        <div className="mt-4">
          <CategoryProductsTab
            categoryTabs={categoryTabs}
            activeCategory={activeCategory}
            onCategoryChange={(category) => {
              searchRequest.current += 1;
              setMessage(null);
              setActiveCategory(category);
            }}
            updateUrl={false}
          />
        </div>
      </div>

      <div className="mt-4">
        <fieldset
          disabled={!orderAvailability.accepting_orders}
          aria-describedby={
            orderAvailability.accepting_orders
              ? undefined
              : "storefront-ordering-unavailable"
          }
          className="m-0 min-w-0 border-0 p-0 [&_button]:disabled:cursor-not-allowed [&_button]:disabled:opacity-50"
        >
          <ProductList
            products={products}
            selections={selections}
            onUpdateSelection={updateSelection}
          />
        </fieldset>
      </div>

      {message ? (
        <p className="mt-4 rounded-xl border border-status-error/20 bg-status-error/10 p-3 text-sm font-semibold text-status-error">
          {message}
        </p>
      ) : null}

      {meta.has_next ? (
        <button
          type="button"
          disabled={isLoading}
          onClick={() => fetchProducts(meta.page + 1, activeCategory, validSearch, true)}
          className="mt-5 min-h-12 w-full rounded-xl border border-brand-primary bg-white px-4 py-3 font-bold text-brand-primary disabled:opacity-60"
        >
          {isLoading ? "جاري التحميل…" : "تحميل المزيد"}
        </button>
      ) : null}

      <div ref={catalogBoundaryRef} aria-hidden="true" />

      {summary.totalItems > 0 && orderAvailability.accepting_orders ? (
        <div
          className={
            isCatalogBoundaryVisible
              ? "mt-4"
              : "fixed inset-x-0 bottom-0 z-40 border-t border-brand-border bg-white/95 p-4 safe-bottom-padding shadow-float backdrop-blur-xl"
          }
        >
          <button
            type="button"
            onClick={async () => {
              await saveQueue.current;
              if (!lastSaveSucceeded.current) return;
              router.push(`/${encodeURIComponent(tenantSlug)}/cart`);
            }}
            className="mx-auto flex min-h-14 w-full max-w-md items-center justify-between rounded-xl bg-brand-primary px-5 py-3 text-white shadow-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/30"
          >
            <span className="font-black">عرض الطلب</span>
            <span className="text-sm font-bold">
              {summary.totalItems} منتجات
              {summary.hasPricedItems
                ? ` — ${formatCurrency(summary.estimatedTotal)}`
                : ""}
            </span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
