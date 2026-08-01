"use client";

import Link from "next/link";
import { Send, Wallet } from "lucide-react";
import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import {
  checkoutStorefrontCartAction,
  type StorefrontCheckoutState,
} from "@/actions/storefront-cart-actions";
import {
  getPublicCustomerByAccessCodeAction,
  getPublicCustomerByPhoneAction,
} from "@/actions/customer-actions";
import { sendMetaPixelEvent } from "@/lib/analytics/meta-pixel";
import {
  getGoogleAnalyticsIdentifiers,
  type GoogleAnalyticsIdentifiers,
} from "@/lib/analytics/google-analytics";
import {
  MARKETING_CONSENT_CHANGED_EVENT,
  readMarketingConsent,
} from "@/lib/analytics/marketing-consent";
import {
  trackCheckoutError,
  trackOrderSubmitted,
  type StorefrontAnalyticsContext,
} from "@/lib/analytics/storefront-ga4";
import { formatCurrency } from "@/lib/utils/currency";
import {
  formatDeferredFeeRange,
  isDeferredDeliveryFee,
} from "@/lib/delivery-configuration";
import type { PublicCustomerProfile } from "@/services/api/customers.service";
import type {
  DeliveryAvailability,
  DeliverySlot,
} from "@/types/models/delivery";
import type { StorefrontCartDraft } from "@/types/models/storefront-cart-draft";
import type { TenantDeliverySettings } from "@/types/models/tenant";
import ScheduledDeliverySelector from "./ScheduledDeliverySelector";

const initialState: StorefrontCheckoutState = { success: false, message: "" };

type StorefrontCheckoutProps = {
  tenantSlug: string;
  draft: StorefrontCartDraft;
  csrfToken: string;
  deliverySettings: TenantDeliverySettings;
  deliveryAvailability: DeliveryAvailability;
  savedCustomerProfile?: {
    name?: string;
    phone: string;
    address?: string;
    notes?: string;
  } | null;
  storeAnalytics: StorefrontAnalyticsContext;
};

/** PII-only final checkout step backed by a validated server action. */
export default function StorefrontCheckout({
  tenantSlug,
  draft,
  csrfToken,
  deliverySettings,
  deliveryAvailability,
  savedCustomerProfile,
  storeAnalytics,
}: StorefrontCheckoutProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    checkoutStorefrontCartAction.bind(null, tenantSlug),
    initialState,
  );
  const [name, setName] = useState(savedCustomerProfile?.name ?? "");
  const [phone, setPhone] = useState(savedCustomerProfile?.phone ?? "");
  const [address, setAddress] = useState(savedCustomerProfile?.address ?? "");
  const [notes, setNotes] = useState(savedCustomerProfile?.notes ?? "");
  const [suggestion, setSuggestion] = useState<PublicCustomerProfile | null>(
    null,
  );
  const [accessCode, setAccessCode] = useState("");
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);
  const [isLookingUp, startLookup] = useTransition();
  const [scheduledWindow, setScheduledWindow] = useState<DeliverySlot | null>(
    null,
  );
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [analyticsIdentifiers, setAnalyticsIdentifiers] =
    useState<GoogleAnalyticsIdentifiers | null>(null);
  const hasNavigated = useRef(false);
  const lastTrackedErrorState = useRef<StorefrontCheckoutState | null>(null);
  const invalidReportLocked = useRef(false);
  const scheduledRequired = deliveryAvailability.ordering_mode === "scheduled";
  const orderingUnavailable =
    deliveryAvailability.ordering_mode === "unavailable";
  const itemCount = draft.items.length;

  useEffect(() => {
    let isActive = true;
    let identifierRequestId = 0;

    const loadIdentifiers = () => {
      const requestId = ++identifierRequestId;
      if (readMarketingConsent() !== "granted") {
        setAnalyticsIdentifiers(null);
        return;
      }
      if (typeof getGoogleAnalyticsIdentifiers !== "function") {
        setAnalyticsIdentifiers(null);
        return;
      }

      void getGoogleAnalyticsIdentifiers()
        .then((identifiers) => {
          if (isActive && requestId === identifierRequestId) {
            setAnalyticsIdentifiers(identifiers);
          }
        })
        .catch(() => {
          if (isActive && requestId === identifierRequestId) {
            setAnalyticsIdentifiers(null);
          }
        });
    };

    loadIdentifiers();
    window.addEventListener(MARKETING_CONSENT_CHANGED_EVENT, loadIdentifiers);
    return () => {
      isActive = false;
      identifierRequestId += 1;
      window.removeEventListener(
        MARKETING_CONSENT_CHANGED_EVENT,
        loadIdentifiers,
      );
    };
  }, []);

  useEffect(() => {
    if (
      state.success ||
      !state.analytics_error ||
      lastTrackedErrorState.current === state
    ) {
      return;
    }
    lastTrackedErrorState.current = state;
    trackCheckoutError({
      store: storeAnalytics,
      errorField: state.analytics_error.error_field,
      errorType: state.analytics_error.error_type,
      httpStatus: state.analytics_error.http_status,
    });
  }, [state, storeAnalytics]);

  useEffect(() => {
    if (!state.success || !state.data?.public_token || hasNavigated.current)
      return;
    hasNavigated.current = true;
    if (state.data.meta_purchase) {
      sendMetaPixelEvent(
        "Purchase",
        {
          currency: state.data.meta_purchase.currency,
          value: state.data.meta_purchase.value,
          conversion_type: "order_created",
          storefront_type: "tenant",
          num_items: itemCount,
        },
        state.data.meta_purchase.event_id,
      );
    }
    trackOrderSubmitted({
      store: storeAnalytics,
      orderId: state.data.order_analytics.order_id,
      value: state.data.order_analytics.value,
      deliveryFee: state.data.order_analytics.delivery_fee,
      itemCount: state.data.order_analytics.item_count,
    });
    const target = new URL(
      `/${encodeURIComponent(tenantSlug)}/success`,
      window.location.origin,
    );
    target.searchParams.set("token", state.data.public_token);
    if (state.data.customer_access_code) {
      target.searchParams.set("customerCode", state.data.customer_access_code);
    }
    router.replace(`${target.pathname}${target.search}`);
  }, [
    itemCount,
    router,
    state.data,
    state.success,
    storeAnalytics,
    tenantSlug,
  ]);

  const deliveryAreaName = draft.delivery_area?.name_ar ?? "منطقة التوصيل";
  // The chosen zone may be priced after the order, in which case the estimate
  // deliberately excludes delivery and the shopper is told so explicitly.
  const isDeferredDelivery = isDeferredDeliveryFee(draft.delivery_fee_mode);
  const deferredFeeRange = isDeferredDelivery
    ? formatDeferredFeeRange(draft.delivery_fee_min, draft.delivery_fee_max)
    : null;
  const totalLabel = useMemo(
    () =>
      draft.estimated_total === null
        ? "السعر يُراجع بعد الطلب"
        : formatCurrency(draft.estimated_total),
    [draft.estimated_total],
  );

  const applyProfile = (profile: PublicCustomerProfile) => {
    setName(profile.name ?? name);
    setPhone(profile.phone || phone);
    setAddress(profile.addresses[0] ?? address);
    setNotes(profile.notes ?? notes);
    setSuggestion(null);
  };

  return (
    <main className="px-4 pb-8 pt-5" dir="rtl">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-brand-primary">
            الخطوة 2 من 2
          </p>
          <h2 className="mt-1 text-2xl font-black text-brand-text">
            بيانات التوصيل
          </h2>
        </div>
        <Link
          href={`/${encodeURIComponent(tenantSlug)}/cart`}
          className="min-h-11 rounded-xl border border-brand-border bg-white px-4 py-2.5 text-sm font-bold text-brand-text"
        >
          رجوع للسلة
        </Link>
      </div>

      <section className="rounded-2xl border border-brand-border bg-white p-5 shadow-soft">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-black text-brand-text">
              {itemCount > 0 ? `${itemCount} منتجات` : "طلب خاص"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {deliveryAreaName}
            </p>
          </div>
          <div className="text-end">
            <strong className="text-brand-primary">{totalLabel}</strong>
            {isDeferredDelivery ? (
              <span className="mt-0.5 block text-[11px] font-semibold text-muted-foreground">
                بدون التوصيل
              </span>
            ) : null}
          </div>
        </div>
        {isDeferredDelivery ? (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-900">
            رسوم التوصيل لهذه المنطقة يحددها المتجر بعد مراجعة عنوانك
            {deferredFeeRange ? ` (${deferredFeeRange})` : ""}. هيوصلك إشعار
            بالإجمالي النهائي، وتقدر ترفض الطلب لو مش مناسب.
          </p>
        ) : null}
      </section>

      {scheduledRequired ? (
        <ScheduledDeliverySelector
          availability={deliveryAvailability}
          value={scheduledWindow}
          isOpen={scheduleOpen}
          onOpenChange={setScheduleOpen}
          onChange={setScheduledWindow}
        />
      ) : null}

      <form
        action={formAction}
        className="mt-5 space-y-5"
        onInvalidCapture={(event) => {
          if (invalidReportLocked.current) return;
          invalidReportLocked.current = true;
          window.setTimeout(() => {
            invalidReportLocked.current = false;
          }, 0);
          const fieldName = (event.target as HTMLInputElement).name;
          const fieldMap: Record<string, "name" | "phone" | "address"> = {
            customer_name: "name",
            customer_phone: "phone",
            delivery_address: "address",
          };
          trackCheckoutError({
            store: storeAnalytics,
            errorField: fieldMap[fieldName] ?? "server",
            errorType: (event.target as HTMLInputElement).validity.valueMissing
              ? "required"
              : "invalid_format",
          });
        }}
      >
        <input type="hidden" name="csrf_token" value={csrfToken} />
        <input
          type="hidden"
          name="ga_client_id"
          value={analyticsIdentifiers?.clientId ?? ""}
        />
        <input
          type="hidden"
          name="ga_session_id"
          value={analyticsIdentifiers?.sessionId ?? ""}
        />
        <input
          type="hidden"
          name="delivery_slot"
          value={scheduledWindow ? JSON.stringify(scheduledWindow) : ""}
        />

        <section className="rounded-2xl border border-brand-border bg-white p-5 shadow-soft">
          <h3 className="font-black text-brand-text">لديك كود عميل؟</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            اكتب الكود ورقم الهاتف لاسترجاع بياناتك.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <input
              type="text"
              value={accessCode}
              onChange={(event) =>
                setAccessCode(event.target.value.toUpperCase())
              }
              placeholder="A7K-42Q9"
              dir="ltr"
              className="min-h-12 rounded-xl border border-brand-border px-3"
            />
            <button
              type="button"
              disabled={isLookingUp || !accessCode.trim() || !phone.trim()}
              onClick={() =>
                startLookup(async () => {
                  const result = await getPublicCustomerByAccessCodeAction({
                    code: accessCode,
                    phone,
                  });
                  if (result.success && result.data) {
                    applyProfile(result.data);
                    setLookupMessage("تم تحميل بياناتك");
                  } else {
                    setLookupMessage(result.message || "لم نجد بيانات مطابقة");
                  }
                })
              }
              className="min-h-12 rounded-xl bg-brand-primary px-4 font-bold text-white disabled:opacity-50"
            >
              {isLookingUp ? "جاري البحث…" : "استخدام الكود"}
            </button>
          </div>
          {lookupMessage ? (
            <p className="mt-2 text-sm font-semibold text-muted-foreground">
              {lookupMessage}
            </p>
          ) : null}
        </section>

        <section className="space-y-5 rounded-2xl border border-brand-border bg-white p-5 shadow-soft">
          <label className="block text-sm font-bold text-brand-text">
            الاسم
            <input
              name="customer_name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              autoComplete="name"
              className="mt-2 min-h-12 w-full rounded-xl border border-brand-border bg-brand-soft/20 px-4 text-base outline-none focus:border-brand-accent focus:ring-4 focus:ring-brand-accent/15"
            />
            {state.errors?.customer_name ? (
              <span className="mt-1 block text-sm text-status-error">
                {state.errors.customer_name[0]}
              </span>
            ) : null}
          </label>

          <label className="block text-sm font-bold text-brand-text">
            رقم الهاتف (يفضل واتساب)
            <input
              name="customer_phone"
              type="tel"
              inputMode="numeric"
              dir="ltr"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              onBlur={() => {
                if (phone.trim().length < 7) return;
                startLookup(async () => {
                  const result = await getPublicCustomerByPhoneAction({
                    slug: tenantSlug,
                    phone,
                  });
                  if (result.success && result.data) setSuggestion(result.data);
                });
              }}
              required
              autoComplete="tel"
              className="mt-2 min-h-12 w-full rounded-xl border border-brand-border bg-brand-soft/20 px-4 text-base outline-none focus:border-brand-accent focus:ring-4 focus:ring-brand-accent/15"
            />
            {state.errors?.customer_phone ? (
              <span className="mt-1 block text-sm text-status-error">
                {state.errors.customer_phone[0]}
              </span>
            ) : null}
          </label>

          {suggestion ? (
            <div className="rounded-xl border border-brand-accent/30 bg-brand-soft/50 p-4">
              <p className="text-sm font-bold text-brand-text">
                وجدنا بيانات محفوظة لهذا الرقم
              </p>
              <button
                type="button"
                onClick={() => applyProfile(suggestion)}
                className="mt-3 min-h-11 rounded-lg bg-brand-primary px-4 text-sm font-bold text-white"
              >
                استخدام البيانات
              </button>
            </div>
          ) : null}

          <label className="block text-sm font-bold text-brand-text">
            عنوان التوصيل
            <input
              name="delivery_address"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              required
              autoComplete="street-address"
              placeholder="العمارة، الشارع، الدور…"
              className="mt-2 min-h-12 w-full rounded-xl border border-brand-border bg-brand-soft/20 px-4 text-base outline-none focus:border-brand-accent focus:ring-4 focus:ring-brand-accent/15"
            />
            {state.errors?.delivery_address ? (
              <span className="mt-1 block text-sm text-status-error">
                {state.errors.delivery_address[0]}
              </span>
            ) : null}
          </label>

          <label className="block text-sm font-bold text-brand-text">
            ملاحظات التوصيل (اختياري)
            <textarea
              name="notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              maxLength={255}
              className="mt-2 min-h-24 w-full resize-y rounded-xl border border-brand-border bg-brand-soft/20 p-4 text-base outline-none focus:border-brand-accent focus:ring-4 focus:ring-brand-accent/15"
            />
          </label>
        </section>

        {deliverySettings.instapay_account_number ||
        deliverySettings.ewallet_account_number ||
        deliverySettings.card_on_delivery_available ? (
          <section className="rounded-2xl border border-brand-border bg-white p-5 shadow-soft">
            <h3 className="font-black text-brand-text">طرق الدفع المتاحة</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              يمكنك الدفع نقداً عند الاستلام أو التحويل باستخدام البيانات
              المتاحة.
            </p>
            <div className="mt-4 space-y-3 text-sm">
              {deliverySettings.instapay_account_number ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-brand-border bg-brand-soft/10 p-4 transition-all hover:border-brand-primary/30 hover:bg-brand-soft/30 hover:shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
                      <Send className="h-5 w-5" />
                    </div>
                    <div>
                      <strong className="block text-base font-bold text-brand-text">
                        InstaPay
                      </strong>
                      {deliverySettings.instapay_account_name ? (
                        <span className="mt-0.5 block text-xs font-medium text-muted-foreground">
                          {deliverySettings.instapay_account_name}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <span
                    className="inline-block rounded-lg border border-brand-border bg-white px-3 py-1.5 text-center text-sm font-bold tracking-wide text-brand-primary shadow-sm"
                    dir="ltr"
                  >
                    {deliverySettings.instapay_account_number}
                  </span>
                </div>
              ) : null}
              {deliverySettings.ewallet_account_number ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-brand-border bg-brand-soft/10 p-4 transition-all hover:border-brand-primary/30 hover:bg-brand-soft/30 hover:shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
                      <Wallet className="h-5 w-5" />
                    </div>
                    <div>
                      <strong className="block text-base font-bold text-brand-text">
                        محفظة إلكترونية
                      </strong>
                      {deliverySettings.ewallet_account_name ? (
                        <span className="mt-0.5 block text-xs font-medium text-muted-foreground">
                          {deliverySettings.ewallet_account_name}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <span
                    className="inline-block rounded-lg border border-brand-border bg-white px-3 py-1.5 text-center text-sm font-bold tracking-wide text-brand-primary shadow-sm"
                    dir="ltr"
                  >
                    {deliverySettings.ewallet_account_number}
                  </span>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {deliverySettings.card_on_delivery_available ? (
          <label className="flex min-h-14 items-center gap-3 rounded-xl border border-brand-border bg-white p-4 font-bold text-brand-text">
            <input
              type="checkbox"
              name="card_on_delivery_requested"
              className="h-5 w-5 accent-brand-primary"
            />
            أحتاج ماكينة دفع عند الاستلام
          </label>
        ) : null}

        {state.message && !state.success ? (
          <p className="rounded-xl border border-status-error/20 bg-status-error/10 p-4 text-sm font-bold text-status-error">
            {state.message}
          </p>
        ) : null}

        {orderingUnavailable ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center text-sm font-bold text-amber-900">
            المتجر لا يستقبل طلبات توصيل حالياً.
          </p>
        ) : null}

        <button
          type="submit"
          disabled={
            pending ||
            orderingUnavailable ||
            (scheduledRequired && !scheduledWindow)
          }
          className="flex min-h-14 w-full items-center justify-center rounded-xl bg-brand-primary px-5 py-3 text-lg font-black text-white shadow-soft disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "جاري تأكيد الطلب…" : "تأكيد الطلب"}
        </button>
      </form>
    </main>
  );
}
