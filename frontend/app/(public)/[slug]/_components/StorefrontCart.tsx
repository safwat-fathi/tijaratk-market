"use client";

import Link from "next/link";
import { FileText, MapPin, Trash2, UploadCloud } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  removeStorefrontPrescriptionAction,
  saveStorefrontCartDraftAction,
  uploadStorefrontPrescriptionAction,
} from "@/actions/storefront-cart-actions";
import { formatCurrency } from "@/lib/utils/currency";
import { sendMetaPixelEvent } from "@/lib/analytics/meta-pixel";
import {
  MARKETING_CONSENT_CHANGED_EVENT,
  readMarketingConsent,
} from "@/lib/analytics/marketing-consent";
import {
  trackBeginCheckout,
  trackCartSelectionChange,
  trackViewCart,
  type StorefrontAnalyticsContext,
} from "@/lib/analytics/storefront-ga4";
import { DEFAULT_UNAVAILABLE_ITEM_ACTION } from "@/lib/orders/unavailable-item-action";
import { UnavailableItemAction } from "@/types/enums";
import type { StorefrontCartDraft } from "@/types/models/storefront-cart-draft";
import type { TenantDeliveryArea } from "@/types/models/tenant";
import type { StorefrontOrderAvailability } from "@/types/models/delivery";
import ProductList, { type ProductCartSelection } from "./ProductList";
import { STOREFRONT_CART_CHANGED_EVENT } from "./HeaderCartButton";

type StorefrontCartProps = {
  tenantSlug: string;
  initialDraft: StorefrontCartDraft | null;
  deliveryAreas: TenantDeliveryArea[];
  isPharmacy: boolean;
  orderAvailability: StorefrontOrderAvailability;
  storeAnalytics: StorefrontAnalyticsContext;
};

const selectionsFromDraft = (draft: StorefrontCartDraft | null) =>
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

/** Cart review step: quantities, special requests, prescription, area, and totals. */
export default function StorefrontCart({
  tenantSlug,
  initialDraft,
  deliveryAreas,
  isPharmacy,
  orderAvailability,
  storeAnalytics,
}: StorefrontCartProps) {
  const router = useRouter();
  const [draft, setDraft] = useState(initialDraft);
  const [selections, setSelections] = useState(() => selectionsFromDraft(initialDraft));
  const selectionsRef = useRef(selections);
  const [freeText, setFreeText] = useState(initialDraft?.free_text_payload ?? "");
  const [deliveryAreaId, setDeliveryAreaId] = useState<number | undefined>(
    initialDraft?.delivery_area_id ?? undefined,
  );
  const [unavailableAction, setUnavailableAction] = useState(
    initialDraft?.unavailable_item_action ?? DEFAULT_UNAVAILABLE_ITEM_ACTION,
  );
  const [prescriptionAction, setPrescriptionAction] = useState(
    initialDraft?.prescription_unavailability_action ?? "call",
  );
  const [message, setMessage] = useState<string | null>(null);
  const [isUploading, startUploading] = useTransition();
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const lastSaveSucceeded = useRef(true);
  const freeTextSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasReportedCartView = useRef(false);

  const products = useMemo(() => draft?.items.map((item) => item.product) ?? [], [draft]);
  const hasContent =
    Object.keys(selections).length > 0 ||
    freeText.trim().length > 0 ||
    Boolean(draft?.has_prescription);

  const persist = (
    nextSelections = selections,
    nextFreeText = freeText,
    nextAreaId = deliveryAreaId,
    nextUnavailableAction = unavailableAction,
    nextPrescriptionAction = prescriptionAction,
    includePrescriptionAction = Boolean(draft?.has_prescription),
  ) => {
    saveQueue.current = saveQueue.current.catch(() => undefined).then(async () => {
      const result = await saveStorefrontCartDraftAction(tenantSlug, {
        items: Object.entries(nextSelections).map(([productId, selection]) => ({
          product_id: Number(productId),
          ...selection,
        })),
        free_text_payload: nextFreeText.trim() || undefined,
        delivery_area_id: nextAreaId,
        unavailable_item_action: nextUnavailableAction,
        order_source: draft?.order_source,
        source_metadata: draft?.source_metadata || undefined,
        prescription_unavailability_action:
          isPharmacy && includePrescriptionAction
            ? nextPrescriptionAction
            : undefined,
      });
      if (!result.success) {
        lastSaveSucceeded.current = false;
        setMessage(result.message || "تعذر حفظ السلة");
        return;
      }
      lastSaveSucceeded.current = true;
      if (result.data) setDraft(result.data);
    }).catch(() => {
      lastSaveSucceeded.current = false;
      setMessage("تعذر حفظ السلة");
    });
  };

  useEffect(() => {
    return () => {
      if (freeTextSaveTimer.current) clearTimeout(freeTextSaveTimer.current);
    };
  }, []);

  useEffect(() => {
    const reportCartView = () => {
      if (
        hasReportedCartView.current ||
        readMarketingConsent() !== "granted"
      ) {
        return;
      }
      if (trackViewCart(storeAnalytics, initialDraft)) {
        hasReportedCartView.current = true;
      }
    };

    reportCartView();
    window.addEventListener(MARKETING_CONSENT_CHANGED_EVENT, reportCartView);
    return () =>
      window.removeEventListener(
        MARKETING_CONSENT_CHANGED_EVENT,
        reportCartView,
      );
  }, [initialDraft, storeAnalytics]);

  const updateSelection = (
    product: (typeof products)[number],
    selection: ProductCartSelection | null,
  ) => {
    const next = { ...selectionsRef.current };
    const previousSelection = next[product.id];
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
    window.dispatchEvent(
      new CustomEvent(STOREFRONT_CART_CHANGED_EVENT, {
        detail: Object.keys(next).length,
      }),
    );
    persist(next);
  };

  const selectedArea = deliveryAreas.find((area) => area.area_id === deliveryAreaId);
  const deliveryFee = selectedArea ? Number(selectedArea.delivery_fee) : null;
  const estimatedTotal =
    deliveryFee === null ? null : Number((Number(draft?.subtotal ?? 0) + deliveryFee).toFixed(2));

  return (
    <main className="px-4 pb-8 pt-5" dir="rtl">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-brand-primary">الخطوة 1 من 2</p>
          <h2 className="mt-1 text-2xl font-black text-brand-text">مراجعة الطلب</h2>
        </div>
        <Link
          href={`/${encodeURIComponent(tenantSlug)}`}
          className="min-h-11 rounded-xl border border-brand-border bg-white px-4 py-2.5 text-sm font-bold text-brand-text"
        >
          إضافة منتجات
        </Link>
      </div>

      {!orderAvailability.accepting_orders ? (
        <div
          className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center"
          role="status"
        >
          <p className="font-black text-amber-950">لا يمكن إتمام الطلب الآن</p>
          <p className="mt-1 text-sm font-semibold leading-6 text-amber-900">
            {orderAvailability.message ||
              "هذا المتجر لا يستقبل الطلبات حالياً."}
          </p>
          <p className="mt-1 text-xs text-amber-800">
            ستظل محتويات سلتك محفوظة ويمكنك مراجعتها لاحقاً.
          </p>
        </div>
      ) : null}

      {products.length > 0 ? (
        <ProductList
          products={products}
          selections={selections}
          onUpdateSelection={updateSelection}
        />
      ) : (
        <div className="rounded-2xl border border-dashed border-brand-border bg-white p-6 text-center">
          <p className="font-bold text-brand-text">لا توجد منتجات في السلة</p>
          <p className="mt-1 text-sm text-muted-foreground">يمكنك إضافة منتجات أو كتابة طلب خاص.</p>
        </div>
      )}

      {(draft?.invalid_product_ids.length ?? 0) > 0 ? (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
          أزلنا منتجات لم تعد متاحة من عرض السلة. راجع طلبك قبل المتابعة.
        </p>
      ) : null}

      <section className="mt-5 rounded-2xl border border-brand-border bg-white p-5 shadow-soft">
        <label htmlFor="cart-special-request" className="text-base font-black text-brand-text">
          طلب خاص أو منتج غير موجود
        </label>
        <textarea
          id="cart-special-request"
          value={freeText}
          onChange={(event) => {
            const next = event.target.value;
            setFreeText(next);
            if (freeTextSaveTimer.current) {
              clearTimeout(freeTextSaveTimer.current);
            }
            freeTextSaveTimer.current = setTimeout(
              () => persist(selectionsRef.current, next, deliveryAreaId),
              400,
            );
          }}
          maxLength={2000}
          placeholder="اكتب اسم المنتج والكمية أو أي تفاصيل مهمة…"
          className="mt-3 min-h-28 w-full resize-y rounded-xl border border-brand-border bg-brand-soft/30 p-4 text-base outline-none focus:border-brand-accent focus:ring-4 focus:ring-brand-accent/15"
        />
      </section>

      {isPharmacy ? (
        <section className="mt-5 rounded-2xl border border-brand-border bg-white p-5 shadow-soft">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-brand-primary" />
            <h3 className="font-black text-brand-text">الروشتة</h3>
          </div>
          {draft?.has_prescription ? (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="break-words text-sm font-bold text-emerald-900">
                {draft.prescription_original_filename || "تم رفع الروشتة"}
              </p>
              <button
                type="button"
                onClick={() =>
                  startUploading(async () => {
                    const result = await removeStorefrontPrescriptionAction(tenantSlug);
                    if (result.success) setDraft(result.data ?? null);
                    else setMessage(result.message || "تعذر حذف الروشتة");
                  })
                }
                className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-bold text-red-700"
              >
                <Trash2 className="h-4 w-4" /> حذف الروشتة
              </button>
            </div>
          ) : (
            <label className="mt-4 flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-brand-accent/40 bg-brand-soft/30 p-5 text-center">
              <UploadCloud className="h-8 w-8 text-brand-primary" />
              <span className="mt-2 text-sm font-bold text-brand-text">
                {isUploading ? "جاري الرفع…" : "التقط صورة أو ارفع PDF"}
              </span>
              <input
                type="file"
                accept="image/*,.pdf"
                capture="environment"
                disabled={isUploading}
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  startUploading(async () => {
                    const payload = new FormData();
                    payload.set("prescription_file", file);
                    const result = await uploadStorefrontPrescriptionAction(
                      tenantSlug,
                      payload,
                    );
                    if (result.success && result.data) {
                      setDraft(result.data);
                      persist(
                        selections,
                        freeText,
                        deliveryAreaId,
                        unavailableAction,
                        prescriptionAction,
                        true,
                      );
                    } else setMessage(result.message || "تعذر رفع الروشتة");
                  });
                }}
              />
            </label>
          )}
          {draft?.has_prescription ? (
            <label className="mt-4 block text-sm font-bold text-brand-text">
              في حالة عدم التوفر
              <select
                value={prescriptionAction}
                onChange={(event) => {
                  const next = event.target.value;
                  setPrescriptionAction(next);
                  persist(selections, freeText, deliveryAreaId, unavailableAction, next);
                }}
                className="mt-2 min-h-12 w-full rounded-xl border border-brand-border bg-white px-3"
              >
                <option value="call">اتصل بي للاستشارة</option>
                <option value="alternative">أرسل البديل المتاح</option>
                <option value="cancel">إلغاء المنتج</option>
              </select>
            </label>
          ) : null}
        </section>
      ) : null}

      <section className="mt-5 rounded-2xl border border-brand-border bg-white p-5 shadow-soft">
        <div className="flex items-center gap-3">
          <MapPin className="h-5 w-5 text-brand-primary" />
          <h3 className="font-black text-brand-text">منطقة التوصيل</h3>
        </div>
        <select
          value={deliveryAreaId ?? ""}
          onChange={(event) => {
            const next = event.target.value ? Number(event.target.value) : undefined;
            setDeliveryAreaId(next);
            persist(selections, freeText, next);
          }}
          className="mt-4 min-h-12 w-full rounded-xl border border-brand-border bg-white px-3 text-base"
        >
          <option value="">اختر منطقتك</option>
          {deliveryAreas.map((area) => (
            <option key={area.area_id} value={area.area_id}>
              {area.area?.name_ar || `منطقة ${area.area_id}`} — {Number(area.delivery_fee) > 0 ? formatCurrency(Number(area.delivery_fee)) : "مجاني"}
            </option>
          ))}
        </select>
      </section>

      <section className="mt-5 rounded-2xl border border-brand-border bg-white p-5 shadow-soft">
        <label className="text-sm font-bold text-brand-text">
          لو منتج غير متاح
          <select
            value={unavailableAction}
            onChange={(event) => {
              const next = event.target.value as UnavailableItemAction;
              setUnavailableAction(next);
              persist(selections, freeText, deliveryAreaId, next);
            }}
            className="mt-2 min-h-12 w-full rounded-xl border border-brand-border bg-white px-3"
          >
            <option value={UnavailableItemAction.SUGGEST_REPLACEMENT}>اقترح بديلاً</option>
            <option value={UnavailableItemAction.DELETE_ITEM}>احذف المنتج</option>
            <option value={UnavailableItemAction.CANCEL_ORDER}>ألغِ الطلب</option>
          </select>
        </label>
      </section>

      <section className="mt-5 space-y-3 rounded-2xl border border-brand-border bg-white p-5 shadow-soft">
        <div className="flex justify-between text-sm"><span>الإجمالي الفرعي</span><strong>{formatCurrency(Number(draft?.subtotal ?? 0))}</strong></div>
        <div className="flex justify-between text-sm"><span>التوصيل</span><strong>{deliveryFee === null ? "حدد المنطقة" : (deliveryFee > 0 ? formatCurrency(deliveryFee) : "مجاني")}</strong></div>
        <div className="flex justify-between border-t border-brand-border pt-3 text-lg"><span className="font-black">الإجمالي المتوقع</span><strong className="text-brand-primary">{estimatedTotal === null ? "—" : formatCurrency(estimatedTotal)}</strong></div>
      </section>

      {message ? <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{message}</p> : null}

      {!orderAvailability.accepting_orders ? (
        <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-center text-sm font-bold text-amber-900">
          متابعة الطلب غير متاحة حتى يبدأ المتجر في استقبال الطلبات.
        </p>
      ) : hasContent && deliveryAreaId ? (
        <button
          type="button"
          onClick={async () => {
            if (freeTextSaveTimer.current) {
              clearTimeout(freeTextSaveTimer.current);
              freeTextSaveTimer.current = null;
            }
            persist(selectionsRef.current, freeText, deliveryAreaId);
            await saveQueue.current;
            if (!lastSaveSucceeded.current) return;
            sendMetaPixelEvent("InitiateCheckout", {
              currency: "EGP",
              value: estimatedTotal ?? Number(draft?.subtotal ?? 0),
              num_items: Object.keys(selections).length,
              storefront_type: "tenant",
            });
            trackBeginCheckout(
              storeAnalytics,
              draft,
              estimatedTotal ?? Number(draft?.subtotal ?? 0),
              deliveryFee ?? 0,
            );
            router.push(`/${encodeURIComponent(tenantSlug)}/checkout`);
          }}
          className="mt-5 flex min-h-14 w-full items-center justify-center rounded-xl bg-brand-primary px-5 py-3 text-lg font-black text-white shadow-soft"
        >
          متابعة لإدخال العنوان
        </button>
      ) : (
        <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-center text-sm font-bold text-amber-900">
          أضف طلباً وحدد منطقة التوصيل للمتابعة.
        </p>
      )}
    </main>
  );
}
