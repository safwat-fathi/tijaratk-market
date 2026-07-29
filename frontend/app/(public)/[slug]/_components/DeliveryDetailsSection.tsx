import type { TenantDeliverySettings } from "@/types/models/tenant";
import type { PublicCustomerProfile } from "@/services/api/customers.service";
import { formatCurrency } from "@/lib/utils/currency";
import { formatArabicTimeWindow } from "@/lib/delivery-configuration";
import { useState } from "react";
import BottomSheet from "@/components/ui/BottomSheet";
import type { DeliveryAvailability } from "@/types/models/delivery";

type DeliveryDetailsSectionProps = {
  deliverySettings: TenantDeliverySettings;
  deliveryAvailability?: DeliveryAvailability;
  deliveryFee: number | null;
  notes: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  suggestedCustomerProfile: PublicCustomerProfile | null;
  savedAddressOptions: string[];
  onCustomerNameChange: (value: string) => void;
  onCustomerPhoneChange: (value: string) => void;
  onDeliveryAddressChange: (value: string) => void;
  onUseSavedCustomerProfile: () => void;
  onSavedAddressSelect: (value: string) => void;
  onNotesChange: (value: string) => void;
  onCustomerAccessCodeLookup: (input: {
    code: string;
    phone: string;
  }) => Promise<{ success: boolean; message?: string }>;
  errors?: Record<string, string[]>;
  message?: string;
  success?: boolean;
};

export default function DeliveryDetailsSection({
  deliverySettings,
  deliveryAvailability,
  deliveryFee,
  notes,
  customerName,
  customerPhone,
  deliveryAddress,
  suggestedCustomerProfile,
  savedAddressOptions,
  onCustomerNameChange,
  onCustomerPhoneChange,
  onDeliveryAddressChange,
  onUseSavedCustomerProfile,
  onSavedAddressSelect,
  onNotesChange,
  onCustomerAccessCodeLookup,
  errors,
  message,
  success,
}: DeliveryDetailsSectionProps) {
  const [isAddressSheetOpen, setIsAddressSheetOpen] = useState(false);
  const [customerAccessCode, setCustomerAccessCode] = useState("");
  const [accessCodePhone, setAccessCodePhone] = useState("");
  const [accessCodeMessage, setAccessCodeMessage] = useState<string | null>(null);
  const [accessCodeLookupState, setAccessCodeLookupState] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const deliveryConfigured =
    deliverySettings?.delivery_available !== false &&
    (deliverySettings.tenant_delivery_areas?.length || 0) > 0;
  const deliveryState =
    deliveryAvailability?.state ??
    (deliveryConfigured ? "open" : "unavailable");
  const deliveryAvailableNow = deliveryConfigured && deliveryState === "open";
  const schedulingAvailable = deliveryConfigured && deliveryState === "closed";
  const canOrderDelivery = deliveryAvailableNow || schedulingAvailable;
  const hasMultipleSavedAddresses = savedAddressOptions.length > 1;
  const hasSavedCustomerSuggestion = Boolean(suggestedCustomerProfile);
  const hasSingleSavedAddress = savedAddressOptions.length === 1;
  let savedCustomerSuggestionMessage =
    "يمكنك استخدام بيانات العميل المحفوظة لهذا الرقم.";
  if (hasMultipleSavedAddresses) {
    savedCustomerSuggestionMessage =
      "اختر العنوان المناسب لهذا الطلب من العناوين المحفوظة.";
  } else if (hasSingleSavedAddress) {
    savedCustomerSuggestionMessage =
      "يمكنك استخدام البيانات المحفوظة لتعبئة تفاصيل التوصيل.";
  }
  const deliveryFeeLabel =
    deliveryFee === null
      ? "اختر منطقة التوصيل"
      : Number(deliveryFee) > 0
        ? formatCurrency(deliveryFee)
        : "مجاني";

  const deliveryStartsAt = deliveryAvailability
    ? deliveryAvailability.operating_hours.starts_at
    : deliverySettings?.delivery_starts_at;
  const deliveryEndsAt = deliveryAvailability
    ? deliveryAvailability.operating_hours.ends_at
    : deliverySettings?.delivery_ends_at;
  const deliveryTimeWindow = formatArabicTimeWindow(
    deliveryStartsAt,
    deliveryEndsAt,
  );
  const deliveryTimeWindowLabel = deliveryTimeWindow || "طوال اليوم";

  return (
    <div
      id="delivery-details-section"
      data-customer-tour="delivery-details"
      className="mt-8 scroll-mt-24 rounded-lg border border-brand-border bg-white p-5 shadow-soft"
    >
      <div className="mb-4 flex items-center gap-3 border-b border-brand-border pb-4">
        <div className="rounded-md bg-brand-soft p-2.5 text-brand-primary">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-brand-text">تفاصيل التوصيل</h2>
      </div>

      <div
        className={`mb-5 rounded-lg border p-4 ${
          deliveryAvailableNow
            ? "border-brand-primary/15 bg-brand-soft/50"
            : schedulingAvailable
              ? "border-amber-200 bg-amber-50"
              : "border-status-error/20 bg-status-error/10"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-brand-text">
              {deliveryAvailableNow
                ? "التوصيل متاح حالياً"
                : schedulingAvailable
                  ? "المتجر مغلق حالياً"
                  : "التوصيل غير متاح حالياً"}
            </p>
            {canOrderDelivery ? (
              <>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  رسوم التوصيل: {deliveryFeeLabel}
                </p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  مواعيد التوصيل: {deliveryTimeWindowLabel}
                </p>
                {schedulingAvailable ? (
                  <p className="mt-1 text-sm font-semibold text-amber-900">
                    تقدر تختار معاد التوصيل المناسب ليك من المواعيد المتاحة.
                  </p>
                ) : null}
              </>
            ) : (
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                المتجر لا يستقبل طلبات توصيل الآن.
              </p>
            )}
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
              deliveryAvailableNow
                ? "bg-status-success/10 text-status-success"
                : schedulingAvailable
                  ? "bg-amber-100 text-amber-900"
                : "bg-status-error/10 text-status-error"
            }`}
          >
            {deliveryAvailableNow
              ? "متاح"
              : schedulingAvailable
                ? "حجز مسبق"
                : "متوقف"}
          </span>
        </div>
      </div>

      <div className="space-y-5">
        <div
          data-customer-tour="customer-code"
          className="rounded-lg border border-brand-border bg-brand-soft/30 p-4"
        >
          <p className="text-sm font-bold text-brand-text">لديك كود عميل؟</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              inputMode="text"
              dir="ltr"
              placeholder="A7K-42Q9"
              value={customerAccessCode}
              onChange={(event) => {
                setCustomerAccessCode(event.target.value.toUpperCase());
                setAccessCodeMessage(null);
                setAccessCodeLookupState("idle");
              }}
              className="min-h-11 w-full min-w-0 flex-1 rounded-md border border-brand-border bg-white px-3 py-2 text-sm font-semibold tracking-wider text-brand-text transition-colors focus:border-brand-accent focus:outline-none focus:ring-4 focus:ring-brand-accent/15"
            />
            <input
              type="tel"
              inputMode="numeric"
              dir="ltr"
              placeholder="01012345678"
              value={accessCodePhone}
              onChange={(event) => {
                setAccessCodePhone(event.target.value);
                setAccessCodeMessage(null);
                setAccessCodeLookupState("idle");
              }}
              className="min-h-11 w-full min-w-0 flex-1 rounded-md border border-brand-border bg-white px-3 py-2 text-sm text-brand-text transition-colors focus:border-brand-accent focus:outline-none focus:ring-4 focus:ring-brand-accent/15"
            />
            <button
              type="button"
              disabled={accessCodeLookupState === "loading"}
              onClick={async () => {
                const code = customerAccessCode.trim();
                const phone = accessCodePhone.trim();
                if (!code || !phone) {
                  setAccessCodeLookupState("error");
                  setAccessCodeMessage("اكتب كود العميل ورقم الهاتف");
                  return;
                }

                setAccessCodeLookupState("loading");
                const result = await onCustomerAccessCodeLookup({ code, phone });
                setAccessCodeLookupState(result.success ? "success" : "error");
                setAccessCodeMessage(
                  result.success
                    ? "تم تحميل بياناتك"
                    : result.message || "لم نجد بيانات لهذا الكود والرقم",
                );
              }}
              className="min-h-11 w-full shrink-0 sm:w-auto rounded-md bg-brand-primary px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-primary/90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {accessCodeLookupState === "loading" ? "جار التحميل" : "استخدام الكود"}
            </button>
          </div>
          {accessCodeMessage && (
            <p
              className={`mt-2 text-sm font-medium ${
                accessCodeLookupState === "success"
                  ? "text-status-success"
                  : "text-status-error"
              }`}
            >
              {accessCodeMessage}
            </p>
          )}
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold text-brand-text">
            الإسم
          </label>
          <div className="relative">
            <input
              name="customer_name"
              type="text"
              placeholder="مثال: أحمد محمد…"
              className="w-full rounded-md border border-brand-border bg-brand-soft/30 p-4 pl-12 text-base transition-colors focus:border-brand-accent focus:outline-none focus:ring-4 focus:ring-brand-accent/15"
              required
              value={customerName}
              onChange={(e) => onCustomerNameChange(e.target.value)}
            />
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
          </div>
          {errors?.customer_name && (
            <p className="mt-1 text-sm text-status-error">
              {errors.customer_name[0]}
            </p>
          )}
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold text-brand-text">
            رقم الهاتف (يفضل واتساب)
          </label>
          <div className="relative">
            <input
              name="customer_phone"
              type="tel"
              inputMode="numeric"
              dir="ltr"
              pattern="(?:01\d{9}|\+201\d{9}|201\d{9})"
              title="اكتب رقم هاتف مصري صحيح مثل 01012345678"
              placeholder="مثال: 01012345678…"
              className="w-full rounded-md border border-brand-border bg-brand-soft/30 p-4 pl-12 text-base transition-colors focus:border-brand-accent focus:outline-none focus:ring-4 focus:ring-brand-accent/15"
              required
              value={customerPhone}
              onChange={(e) => onCustomerPhoneChange(e.target.value)}
            />
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            </div>
          </div>
          {errors?.customer_phone && (
            <p className="mt-1 text-sm text-status-error">
              {errors.customer_phone[0]}
            </p>
          )}
        </div>

        {hasSavedCustomerSuggestion && (
          <div className="rounded-xl border border-brand-accent/25 bg-brand-soft/70 p-4 shadow-soft">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-brand-primary shadow-soft">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-brand-text">
                  {hasMultipleSavedAddresses
                    ? "هذا الرقم لديه أكثر من عنوان محفوظ"
                    : "وجدنا بيانات محفوظة لهذا الرقم"}
                </p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {savedCustomerSuggestionMessage}
                </p>
              </div>
            </div>

            <div className="mt-3 flex gap-2">
              {hasMultipleSavedAddresses ? (
                <button
                  type="button"
                  onClick={() => setIsAddressSheetOpen(true)}
                  className="min-h-11 rounded-md bg-brand-primary px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-primary/90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/20"
                >
                  اختيار عنوان
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onUseSavedCustomerProfile()}
                  className="min-h-11 rounded-md bg-brand-primary px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-primary/90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/20"
                >
                  استخدام البيانات المحفوظة
                </button>
              )}
            </div>
          </div>
        )}

        <div>
          <label className="mb-2 block text-sm font-bold text-brand-text">
            عنوان التوصيل
          </label>
          <div className="relative">
            <input
              name="delivery_address"
              type="text"
              placeholder="مثال: العمارة، الشارع، الدور…"
              className="w-full rounded-md border border-brand-border bg-brand-soft/30 p-4 pl-12 text-base transition-colors focus:border-brand-accent focus:outline-none focus:ring-4 focus:ring-brand-accent/15"
              required
              value={deliveryAddress}
              onChange={(e) => onDeliveryAddressChange(e.target.value)}
            />
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </div>
          </div>
          {errors?.delivery_address && (
            <p className="mt-1 text-sm text-status-error">
              {errors.delivery_address[0]}
            </p>
          )}
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold text-brand-text">
            ملاحظات التوصيل (اختياري)
          </label>
          <textarea
            name="notes"
            placeholder="مثال: اضرب الجرس، سيب الطلب عند الباب…"
            className="h-24 w-full resize-none rounded-md border border-brand-border bg-brand-soft/40 p-4 text-base transition-colors focus:border-brand-accent focus:outline-none focus:ring-4 focus:ring-brand-accent/15"
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
          />
          {errors?.notes && (
            <p className="mt-1 text-sm text-status-error">{errors.notes[0]}</p>
          )}
        </div>
      </div>

      {message && !success && (
        <div className="mt-4 rounded-md border border-status-error/20 bg-status-error/10 p-4 text-sm font-medium text-status-error">
          {message}
        </div>
      )}

      <BottomSheet
        isOpen={isAddressSheetOpen}
        title="اختر عنوان التوصيل"
        onClose={() => setIsAddressSheetOpen(false)}
      >
        <div className="space-y-3 pb-4">
          <p className="text-sm leading-6 text-muted-foreground">
            وجدنا أكثر من عنوان محفوظ لهذا الرقم. اختر العنوان الذي تريد
            استخدامه.
          </p>

          <div className="space-y-2">
            {savedAddressOptions.map((address, index) => {
              const isSelected = address === deliveryAddress;

              return (
                <button
                  key={`${address}-${index}`}
                  type="button"
                  onClick={() => {
                    onSavedAddressSelect(address);
                    setIsAddressSheetOpen(false);
                  }}
                  className={`flex w-full items-start gap-3 rounded-lg border p-4 text-start transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/15 ${
                    isSelected
                      ? "border-brand-primary bg-brand-soft text-brand-text"
                      : "border-brand-border bg-white text-brand-text hover:border-brand-accent/40 hover:bg-brand-soft/40"
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                      isSelected
                        ? "bg-brand-primary text-white"
                        : "bg-brand-soft text-brand-primary"
                    }`}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold">
                      عنوان {index + 1}
                    </span>
                    <span className="mt-1 block break-words text-sm leading-6 text-muted-foreground">
                      {address}
                    </span>
                  </span>
                  {isSelected && (
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-brand-primary">
                      مختار
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
