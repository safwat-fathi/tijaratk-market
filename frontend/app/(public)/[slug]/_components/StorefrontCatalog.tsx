"use client";

import { FileText, Search, UploadCloud } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  loadStorefrontProductsAction,
  saveStorefrontCartDraftAction,
  uploadStorefrontPrescriptionAction,
} from "@/actions/storefront-cart-actions";
import { formatCurrency } from "@/lib/utils/currency";
import { formatArabicTimeWindow } from "@/lib/delivery-configuration";
import { isScheduledOnlyOrdering } from "@/lib/storefront-order-availability";
import { sendMetaPixelEvent } from "@/lib/analytics/meta-pixel";
import {
  trackCartSelectionChange,
  trackViewItem,
  type StorefrontAnalyticsContext,
} from "@/lib/analytics/storefront-ga4";
import type {
  Product,
  PublicProductCategory,
  PublicProductsMeta,
} from "@/types/models/product";
import type {
  SaveStorefrontCartDraftInput,
  StorefrontCartDraft,
} from "@/types/models/storefront-cart-draft";
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
  initialDeliveryAreaId?: number;
  initialDeliveryAreaSlug?: string;
  isPharmacy: boolean;
  orderAvailability: StorefrontOrderAvailability;
  storeAnalytics: StorefrontAnalyticsContext;
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
  initialDeliveryAreaId,
  initialDeliveryAreaSlug,
  isPharmacy,
  orderAvailability,
  storeAnalytics,
}: StorefrontCatalogProps) {
  const router = useRouter();
  const scheduledOnly = isScheduledOnlyOrdering(orderAvailability);
  const operatingHoursLabel = formatArabicTimeWindow(
    orderAvailability.delivery_availability.operating_hours.starts_at,
    orderAvailability.delivery_availability.operating_hours.ends_at,
  );
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
  const [cartOpenError, setCartOpenError] = useState<string | null>(null);
  const [prescriptionUploadError, setPrescriptionUploadError] = useState<
    string | null
  >(null);
  const [isCatalogBoundaryVisible, setIsCatalogBoundaryVisible] = useState(false);
  const [draftProducts, setDraftProducts] = useState(
    initialDraft?.items.map((item) => item.product) ?? [],
  );
  const [isLoading, startLoading] = useTransition();
  const [isOpeningCart, startOpeningCart] = useTransition();
  const [isUploadingPrescription, startPrescriptionUpload] = useTransition();
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const openingCartRef = useRef(false);
  const prescriptionUploadRef = useRef(false);
  const searchRequest = useRef(0);
  const catalogBoundaryRef = useRef<HTMLDivElement | null>(null);
  const viewedProductIds = useRef(new Set<number>());

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
  const isOrderActionPending = isOpeningCart || isUploadingPrescription;

  const buildDraftInput = (
    next: Record<number, ProductCartSelection>,
  ): SaveStorefrontCartDraftInput => ({
    items: Object.entries(next).map(([productId, selection]) => ({
      product_id: Number(productId),
      ...selection,
    })),
    free_text_payload: initialDraft?.free_text_payload || undefined,
    delivery_area_id:
      initialDeliveryAreaId ??
      initialDraft?.delivery_area_id ??
      undefined,
    unavailable_item_action: initialDraft?.unavailable_item_action,
    order_source: initialDraft?.order_source || orderSource,
    source_metadata:
      initialDraft?.source_metadata || sourceMetadata || undefined,
    prescription_unavailability_action:
      initialDraft?.prescription_unavailability_action || undefined,
  });

  const saveSelections = async (
    next: Record<number, ProductCartSelection>,
  ) => {
    try {
      const result = await saveStorefrontCartDraftAction(
        tenantSlug,
        buildDraftInput(next),
      );
      if (!result.success) {
        setMessage(result.message || "تعذر حفظ السلة");
      }
      return result;
    } catch {
      const failure = { success: false, message: "تعذر حفظ السلة" } as const;
      setMessage(failure.message);
      return failure;
    }
  };

  const persistSelections = (next: Record<number, ProductCartSelection>) => {
    saveQueue.current = saveQueue.current
      .catch(() => undefined)
      .then(async () => {
        await saveSelections(next);
      });
  };

  const openCart = () => {
    if (openingCartRef.current || prescriptionUploadRef.current) return;

    openingCartRef.current = true;
    setMessage(null);
    setCartOpenError(null);
    startOpeningCart(async () => {
      try {
        await saveQueue.current;
        const result = await saveSelections(selectionsRef.current);
        if (!result.success) {
          setMessage(null);
          setCartOpenError(
            result.message || "تعذر حفظ السلة. حاول مرة أخرى.",
          );
          openingCartRef.current = false;
          return;
        }
        const areaQuery = initialDeliveryAreaSlug
          ? `?areaSlug=${encodeURIComponent(initialDeliveryAreaSlug)}`
          : "";
        router.push(`/${encodeURIComponent(tenantSlug)}/cart${areaQuery}`);
      } catch {
        const failureMessage = "تعذر حفظ السلة. حاول مرة أخرى.";
        setMessage(null);
        setCartOpenError(failureMessage);
        openingCartRef.current = false;
      }
    });
  };

  const uploadPrescription = (
    file: File,
    input: HTMLInputElement,
  ) => {
    if (
      !orderAvailability.accepting_orders ||
      openingCartRef.current ||
      prescriptionUploadRef.current
    ) {
      input.value = "";
      return;
    }

    prescriptionUploadRef.current = true;
    setMessage(null);
    setCartOpenError(null);
    setPrescriptionUploadError(null);

    startPrescriptionUpload(async () => {
      try {
        await saveQueue.current;
        const savedDraft = await saveSelections(selectionsRef.current);
        if (!savedDraft.success) {
          setMessage(null);
          setPrescriptionUploadError(
            savedDraft.message || "تعذر تجهيز الطلب. حاول مرة أخرى.",
          );
          return;
        }

        const payload = new FormData();
        payload.set("prescription_file", file);
        const uploaded = await uploadStorefrontPrescriptionAction(
          tenantSlug,
          payload,
        );
        if (!uploaded.success || !uploaded.data) {
          setPrescriptionUploadError(
            uploaded.message || "تعذر رفع الروشتة. حاول مرة أخرى.",
          );
          return;
        }

        const areaQuery = initialDeliveryAreaSlug
          ? `?areaSlug=${encodeURIComponent(initialDeliveryAreaSlug)}`
          : "";
        router.push(`/${encodeURIComponent(tenantSlug)}/cart${areaQuery}`);
      } catch {
        setPrescriptionUploadError("تعذر رفع الروشتة. حاول مرة أخرى.");
      } finally {
        input.value = "";
        prescriptionUploadRef.current = false;
      }
    });
  };

  const updateSelection = (
    product: Product,
    selection: ProductCartSelection | null,
  ) => {
    if (
      !orderAvailability.accepting_orders ||
      openingCartRef.current ||
      prescriptionUploadRef.current
    ) {
      return;
    }
    setMessage(null);
    setCartOpenError(null);
    const next = { ...selectionsRef.current };
    const previousSelection = next[product.id];
    const wasPresent = Boolean(next[product.id]);
    if (selection) next[product.id] = selection;
    else delete next[product.id];
    setSelections(next);
    selectionsRef.current = next;
    trackCartSelectionChange({
      store: storeAnalytics,
      product,
      previousSelection,
      nextSelection: selection ?? undefined,
    });
    if (!wasPresent && selection) {
      const lineTotal = resolveSelectionLineTotal(selection, product);
      sendMetaPixelEvent("AddToCart", {
        content_ids: [String(product.id)],
        content_type: "product",
        currency: "EGP",
        value: lineTotal ?? 0,
        storefront_type: "tenant",
      });
    }
    const nextCount = Object.keys(next).length;
    window.dispatchEvent(
      new CustomEvent(STOREFRONT_CART_CHANGED_EVENT, { detail: nextCount }),
    );
    persistSelections(next);
  };

  const trackProductView = (product: Product) => {
    if (viewedProductIds.current.has(product.id)) return;
    if (trackViewItem(storeAnalytics, product)) {
      viewedProductIds.current.add(product.id);
    }
  };

  const replaceWithReorder = async () => {
    if (
      !reorderOrder ||
      !orderAvailability.accepting_orders ||
      openingCartRef.current ||
      prescriptionUploadRef.current
    ) {
      return;
    }
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

      {scheduledOnly ? (
        <div
          className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center"
          role="status"
        >
          <span className="inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
            حجز مسبق
          </span>
          <p className="mt-2 font-black text-amber-950">المتجر مغلق حالياً</p>
          <p className="mt-1 text-sm font-semibold leading-6 text-amber-900">
            تقدر تكمّل طلبك دلوقتي وتختار معاد التوصيل المناسب ليك من المواعيد
            المتاحة.
          </p>
          {operatingHoursLabel ? (
            <p className="mt-1 text-xs text-amber-800">
              مواعيد التوصيل: {operatingHoursLabel}
            </p>
          ) : null}
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
            disabled={isOrderActionPending}
            className="mt-3 min-h-11 rounded-xl bg-brand-primary px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            استبدال السلة وإعادة الطلب
          </button>
        </div>
      ) : null}

      {isPharmacy ? (
        <section
          data-customer-tour="prescription"
          className="mb-4 rounded-2xl border border-brand-accent/30 bg-brand-soft/50 p-4 shadow-soft"
          aria-labelledby="catalog-prescription-title"
        >
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-brand-primary shadow-sm">
              <FileText className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2
                id="catalog-prescription-title"
                className="font-black text-brand-text"
              >
                اطلب بالروشتة
              </h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                ارفع صورة الروشتة أو ملف PDF وكمّل بيانات التوصيل مباشرة.
              </p>
            </div>
          </div>

          {initialDraft?.has_prescription ? (
            <div className="mt-4">
              <p className="break-words text-xs font-semibold text-brand-text">
                {initialDraft.prescription_original_filename ||
                  "تم رفع الروشتة"}
              </p>
              <button
                type="button"
                onClick={openCart}
                disabled={
                  !orderAvailability.accepting_orders || isOrderActionPending
                }
                aria-busy={isOpeningCart}
                className="mt-3 flex min-h-12 w-full items-center justify-center rounded-xl bg-brand-primary px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isOpeningCart
                  ? "جاري فتح مراجعة الطلب…"
                  : "متابعة طلب الروشتة"}
              </button>
            </div>
          ) : (
            <label
              aria-disabled={
                !orderAvailability.accepting_orders || isOrderActionPending
              }
              className={`mt-4 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand-primary px-4 py-3 text-sm font-black text-white ${
                !orderAvailability.accepting_orders || isOrderActionPending
                  ? "cursor-not-allowed opacity-60"
                  : "cursor-pointer"
              }`}
            >
              <UploadCloud className="h-5 w-5" aria-hidden="true" />
              <span aria-live="polite">
                {isUploadingPrescription
                  ? "جاري رفع الروشتة…"
                  : "التقط صورة أو ارفع ملف"}
              </span>
              <input
                type="file"
                accept="image/*,.pdf"
                capture="environment"
                disabled={
                  !orderAvailability.accepting_orders || isOrderActionPending
                }
                className="sr-only"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  if (!file) return;
                  uploadPrescription(file, event.currentTarget);
                }}
              />
            </label>
          )}

          {prescriptionUploadError ? (
            <p
              role="alert"
              className="mt-3 rounded-xl border border-status-error/20 bg-white px-3 py-2 text-sm font-semibold text-status-error"
            >
              {prescriptionUploadError}
            </p>
          ) : null}
        </section>
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
          disabled={
            !orderAvailability.accepting_orders || isOrderActionPending
          }
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
            onProductViewed={trackProductView}
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
          {cartOpenError ? (
            <p
              role="alert"
              aria-live="assertive"
              className="mx-auto mb-2 max-w-md rounded-xl border border-status-error/20 bg-status-error/10 px-4 py-2 text-center text-sm font-semibold text-status-error"
            >
              {cartOpenError}
            </p>
          ) : null}
          <button
            type="button"
            disabled={isOrderActionPending}
            aria-busy={isOrderActionPending}
            onClick={openCart}
            className="mx-auto flex min-h-14 w-full max-w-md items-center justify-between rounded-xl bg-brand-primary px-5 py-3 text-white shadow-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/30 disabled:cursor-wait disabled:opacity-70"
          >
            <span className="font-black">
              {isOpeningCart ? "جاري فتح الطلب…" : "عرض الطلب"}
            </span>
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
