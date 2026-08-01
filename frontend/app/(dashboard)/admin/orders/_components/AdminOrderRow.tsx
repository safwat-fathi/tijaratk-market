"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  CalendarClock,
  Check,
  ChevronDown,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  FileText,
  MapPin,
  PackageOpen,
  Phone,
  ShieldCheck,
} from "lucide-react";
import ImageThumbnail from "@/components/ui/ImageThumbnail";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  formatPrescriptionUnavailabilityAction,
} from "@/lib/orders/prescription-unavailability";
import { formatUnavailableItemAction } from "@/lib/orders/unavailable-item-action";
import { getImageUrl } from "@/lib/utils/image";
import type { AdminOrderListItem } from "@/services/api/admin.service";
import { OrderStatus, OrderType, PricingMode } from "@/types/enums";

type Props = {
  order: AdminOrderListItem;
  tenantId?: number;
  tenantName: string;
  formattedDate: string;
  formattedTotal: string;
  layout: "desktop" | "mobile";
};

type SecretField = "phone" | "code";

const MONEY_FORMATTER = new Intl.NumberFormat("ar-EG", {
  style: "currency",
  currency: "EGP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const DATE_FORMATTER = new Intl.DateTimeFormat("ar-EG", {
  dateStyle: "medium",
  timeZone: "Africa/Cairo",
});

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("ar-EG", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Africa/Cairo",
});

function formatMoney(value: number | string | null | undefined) {
  return value === null || value === undefined
    ? "غير محدد"
    : MONEY_FORMATTER.format(Number(value));
}

function formatDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : DATE_FORMATTER.format(date);
}

function formatDateTime(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : DATE_TIME_FORMATTER.format(date);
}

function maskValue(value: string, visibleSuffix: number) {
  const suffix = value.slice(-visibleSuffix);
  const maskedLength = Math.max(value.length - visibleSuffix, 4);
  return `${"•".repeat(Math.min(maskedLength, 8))}${suffix}`;
}

function formatCustomerAccessCode(value?: string | null) {
  if (!value) return null;
  const normalized = value.trim().toUpperCase().replace(/[\s-]/g, "");
  return normalized.length > 4
    ? `${normalized.slice(0, 4)}-${normalized.slice(4)}`
    : normalized;
}

function SecretValue({
  field,
  label,
  value,
  revealed,
  copied,
  onToggle,
  onCopy,
  orderId,
}: {
  field: SecretField;
  label: string;
  value?: string | null;
  revealed: boolean;
  copied: boolean;
  onToggle: () => void;
  onCopy: () => void;
  orderId: number;
}) {
  const Icon = field === "phone" ? Phone : ShieldCheck;
  const visibleSuffix = field === "phone" ? 4 : 2;

  return (
    <div className="flex min-w-0 items-center gap-2 text-xs text-gray-600">
      <Icon className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden="true" />
      <span className="shrink-0 font-medium">{label}:</span>
      {value ? (
        <>
          <bdi
            dir="ltr"
            className="min-w-20 font-mono text-[11px] font-semibold text-brand-text"
          >
            {revealed ? value : maskValue(value, visibleSuffix)}
          </bdi>
          <button
            type="button"
            onClick={onToggle}
            className="rounded p-1 text-gray-500 transition hover:bg-brand-soft hover:text-brand-primary focus:brand-focus"
            aria-label={`${revealed ? "إخفاء" : "إظهار"} ${label} للطلب رقم ${orderId}`}
          >
            {revealed ? (
              <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            onClick={onCopy}
            className="rounded p-1 text-gray-500 transition hover:bg-brand-soft hover:text-brand-primary focus:brand-focus"
            aria-label={`نسخ ${label} للطلب رقم ${orderId}`}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
            ) : (
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </button>
          <span className="sr-only" aria-live="polite">
            {copied ? `تم نسخ ${label}` : ""}
          </span>
        </>
      ) : (
        <span className="text-gray-400">غير متاح</span>
      )}
    </div>
  );
}

function PrescriptionDetails({
  order,
}: {
  order: AdminOrderListItem;
}) {
  if (!order.prescription_file_url) return null;

  const fileUrl = getImageUrl(order.prescription_file_url);
  const filename =
    order.prescription_original_filename?.trim() || "ملف الوصفة الطبية";
  const mimeType = order.prescription_mime_type?.trim().toLowerCase();
  const isImage =
    Boolean(mimeType?.startsWith("image/")) ||
    /\.(?:jpe?g|png|webp|heic|heif)(?:$|[?#])/i.test(
      order.prescription_file_url,
    );
  let fileTypeLabel: string | null = null;
  if (mimeType === "application/pdf") {
    fileTypeLabel = "PDF";
  } else if (isImage) {
    fileTypeLabel = "صورة";
  } else if (mimeType) {
    fileTypeLabel = "ملف";
  }
  const unavailabilityLabel =
    formatPrescriptionUnavailabilityAction(
      order.prescription_unavailability_action,
    ) || "غير محدد";

  return (
    <article className="rounded-lg border border-brand-border bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-bold text-brand-text">
            <FileText className="h-4 w-4 text-brand-primary" aria-hidden="true" />
            الوصفة الطبية
          </p>
          <p className="mt-1 break-words text-xs text-gray-500">{filename}</p>
        </div>
        {fileTypeLabel ? (
          <span className="rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-semibold text-brand-primary">
            {fileTypeLabel}
          </span>
        ) : null}
      </div>

      <div className="mt-3 rounded-md border border-brand-accent/20 bg-brand-soft/45 px-3 py-2 text-sm text-brand-text">
        <span className="font-semibold text-brand-primary">
          في حالة عدم توفر الأصناف:
        </span>{" "}
        {unavailabilityLabel}
      </div>

      {isImage ? (
        <div className="mt-3 flex max-h-96 w-full justify-center overflow-hidden rounded-md border border-brand-border bg-brand-soft/20">
          <ImageThumbnail
            src={fileUrl}
            alt={`الوصفة الطبية للطلب رقم ${order.id}`}
            width={1200}
            height={1600}
            sizes="(min-width: 1024px) 60vw, 100vw"
            imageClassName="h-full w-full object-contain"
            thumbnailWrapperClassName="block h-72 w-full sm:h-96"
            fallback={
              <span className="flex min-h-36 items-center justify-center px-4 text-sm text-gray-500">
                تعذر عرض صورة الوصفة الطبية
              </span>
            }
          />
        </div>
      ) : (
        <div className="mt-3 flex min-h-28 items-center justify-center rounded-md border border-dashed border-brand-border bg-brand-soft/20 px-4 text-center">
          <div>
            <FileText
              className="mx-auto h-8 w-8 text-brand-primary"
              aria-hidden="true"
            />
            <p className="mt-2 text-sm text-gray-600">
              معاينة هذا النوع غير متاحة داخل الصفحة.
            </p>
          </div>
        </div>
      )}

      <a
        href={fileUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-md border border-brand-border px-3 text-xs font-semibold text-brand-primary transition hover:bg-brand-soft focus:brand-focus"
      >
        فتح الملف الأصلي
        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
      </a>
    </article>
  );
}

function OrderDetails({
  order,
  idPrefix,
}: {
  order: AdminOrderListItem;
  idPrefix: string;
}) {
  const hasItems = order.items.length > 0;
  const hasFreeText = Boolean(order.free_text_payload?.text);
  const hasPrescription = Boolean(order.prescription_file_url);

  let orderTypeLabel =
    order.order_type === OrderType.FREE_TEXT ? "طلب نصي" : "طلب من الكتالوج";
  if (hasPrescription && hasItems) {
    orderTypeLabel = "طلب من الكتالوج مع وصفة طبية";
  } else if (hasPrescription && hasFreeText) {
    orderTypeLabel = "طلب نصي مع وصفة طبية";
  } else if (hasPrescription) {
    orderTypeLabel = "طلب بوصفة طبية";
  }

  const pricingLabel =
    order.pricing_mode === PricingMode.MANUAL ? "تسعير يدوي" : "تسعير تلقائي";

  let contentCountLabel = "بدون منتجات";
  if (hasItems && hasPrescription) {
    contentCountLabel = `${order.items.length} ${order.items.length === 1 ? "منتج" : "منتجات"} + وصفة`;
  } else if (hasItems) {
    contentCountLabel = `${order.items.length} ${order.items.length === 1 ? "منتج" : "منتجات"}`;
  } else if (hasPrescription) {
    contentCountLabel = "وصفة طبية";
  } else if (hasFreeText) {
    contentCountLabel = "طلب نصي";
  }

  const deliveryAreaLabel =
    order.delivery_area?.name_ar || order.delivery_area?.name_en || null;
  const scheduledDateLabel = formatDate(order.scheduled_delivery_date);
  let deliveryWindowLabel = order.delivery_time_window_snapshot?.trim() || null;
  if (!deliveryWindowLabel && order.scheduled_delivery_starts_at) {
    deliveryWindowLabel = order.scheduled_delivery_ends_at
      ? `${order.scheduled_delivery_starts_at} - ${order.scheduled_delivery_ends_at}`
      : `من ${order.scheduled_delivery_starts_at}`;
  } else if (!deliveryWindowLabel && order.scheduled_delivery_ends_at) {
    deliveryWindowLabel = `حتى ${order.scheduled_delivery_ends_at}`;
  }
  const hasDeliverySchedule = Boolean(
    scheduledDateLabel || deliveryWindowLabel,
  );

  const unavailableItemActionLabel =
    formatUnavailableItemAction(order.unavailable_item_action) ||
    order.unavailable_item_action?.trim() ||
    null;
  const merchantCancelledAt = formatDateTime(order.merchant_cancelled_at);
  const customerRejectedAt = formatDateTime(order.customer_rejected_at);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(16rem,1fr)]">
      <section aria-labelledby={`${idPrefix}-items-title`}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3
            id={`${idPrefix}-items-title`}
            className="flex items-center gap-2 text-sm font-bold text-brand-text"
          >
            <PackageOpen className="h-4 w-4 text-brand-primary" aria-hidden="true" />
            محتوى الطلب
          </h3>
          <span className="rounded-full bg-white px-2.5 py-1 text-xs text-gray-600">
            {contentCountLabel}
          </span>
        </div>

        <div className="space-y-3">
          {hasItems ? (
            <div className="overflow-hidden rounded-lg border border-brand-border bg-white">
              {order.items.map((item) => (
                <div
                  key={item.id}
                  className="grid gap-2 border-b border-brand-border p-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto]"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-brand-text">
                        {item.name_snapshot}
                      </p>
                      {item.is_out_of_stock ? (
                        <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                          غير متوفر
                        </span>
                      ) : null}
                      {item.pending_replacement_product ? (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                          بديل مقترح: {item.pending_replacement_product.name}
                        </span>
                      ) : item.replaced_by_product ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                          البديل: {item.replaced_by_product.name}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      الكمية: {item.quantity}
                    </p>
                    {item.notes ? (
                      <p className="mt-1 text-xs text-amber-800">
                        ملاحظة: {item.notes}
                      </p>
                    ) : null}
                  </div>
                  <div className="text-xs text-gray-600 sm:text-left">
                    <p>سعر الوحدة: {formatMoney(item.unit_price)}</p>
                    <p className="mt-1 font-bold text-brand-text">
                      الإجمالي: {formatMoney(item.total_price)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {hasFreeText ? (
            <div className="rounded-lg border border-brand-border bg-white p-4">
              <p className="text-xs font-semibold text-gray-500">
                تفاصيل الطلب النصي
              </p>
              <p className="mt-2 whitespace-pre-wrap leading-7 text-brand-text">
                {order.free_text_payload?.text}
              </p>
            </div>
          ) : null}

          <PrescriptionDetails order={order} />

          {!hasItems && !hasFreeText && !hasPrescription ? (
            <div className="rounded-lg border border-dashed border-brand-border bg-white p-5 text-center text-sm text-gray-500">
              لا يوجد محتوى مسجل لهذا الطلب.
            </div>
          ) : null}
        </div>
      </section>

      <div className="space-y-3">
        <section
          className="rounded-lg border border-brand-border bg-white p-4"
          aria-label="ملخص الطلب"
        >
          <h3 className="text-sm font-bold text-brand-text">ملخص الطلب</h3>
          <dl className="mt-3 space-y-2.5 text-sm">
            <div className="flex items-start justify-between gap-4">
              <dt className="text-gray-500">نوع الطلب</dt>
              <dd className="text-left font-medium text-brand-text">
                {orderTypeLabel}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="text-gray-500">طريقة التسعير</dt>
              <dd className="font-medium text-brand-text">{pricingLabel}</dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="text-gray-500">الإجمالي الفرعي</dt>
              <dd className="font-medium text-brand-text">
                {formatMoney(order.subtotal)}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="text-gray-500">رسوم التوصيل</dt>
              <dd className="font-medium text-brand-text">
                {order.delivery_fee_status === "pending"
                  ? "تحدد حسب العنوان"
                  : formatMoney(order.delivery_fee)}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-4 border-t border-brand-border pt-2.5">
              <dt className="font-bold text-brand-text">الإجمالي النهائي</dt>
              <dd className="font-bold text-brand-primary">
                {formatMoney(order.total)}
              </dd>
            </div>
          </dl>

          <div className="mt-4 space-y-3 border-t border-brand-border pt-4 text-sm">
            {deliveryAreaLabel ? (
              <div>
                <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-500">
                  <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                  منطقة التوصيل
                </p>
                <p className="mt-1 leading-6 text-brand-text">
                  {deliveryAreaLabel}
                </p>
              </div>
            ) : null}

            <div>
              <p className="text-xs font-semibold text-gray-500">
                عنوان التوصيل
              </p>
              <p className="mt-1 leading-6 text-brand-text">
                {order.delivery_address || "غير متاح"}
              </p>
            </div>

            {hasDeliverySchedule ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-800">
                  <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                  موعد التوصيل المحدد
                </p>
                {scheduledDateLabel ? (
                  <p className="mt-1 font-medium text-amber-950">
                    {scheduledDateLabel}
                  </p>
                ) : null}
                {deliveryWindowLabel ? (
                  <p className="mt-0.5 text-xs text-amber-900">
                    {deliveryWindowLabel}
                  </p>
                ) : null}
              </div>
            ) : null}

            {hasItems && unavailableItemActionLabel ? (
              <div>
                <p className="text-xs font-semibold text-gray-500">
                  عند عدم توفر منتج
                </p>
                <p className="mt-1 leading-6 text-brand-text">
                  {unavailableItemActionLabel}
                </p>
              </div>
            ) : null}

            <div>
              <p className="text-xs font-semibold text-gray-500">
                ملاحظات الطلب
              </p>
              <p className="mt-1 whitespace-pre-wrap leading-6 text-brand-text">
                {order.notes || "لا توجد ملاحظات"}
              </p>
            </div>

            <p className="rounded-md bg-brand-soft px-3 py-2 text-xs font-semibold text-brand-primary">
              {order.card_on_delivery_requested
                ? "طلب العميل الدفع بالكارت عند التوصيل"
                : "لا يوجد طلب للدفع بالكارت عند التوصيل"}
            </p>
          </div>
        </section>

        {order.merchant_cancellation_reason ? (
          <section
            className="rounded-lg border border-red-200 bg-red-50 p-4"
            aria-label="تفاصيل إلغاء التاجر"
          >
            <h3 className="text-sm font-bold text-red-800">إلغاء التاجر</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-red-900">
              {order.merchant_cancellation_reason}
            </p>
            {merchantCancelledAt ? (
              <time
                dateTime={order.merchant_cancelled_at || undefined}
                className="mt-2 block text-xs text-red-700"
              >
                {merchantCancelledAt}
              </time>
            ) : null}
          </section>
        ) : null}

        {order.customer_rejection_reason ? (
          <section
            className="rounded-lg border border-red-200 bg-red-50 p-4"
            aria-label="تفاصيل رفض العميل"
          >
            <h3 className="text-sm font-bold text-red-800">رفض العميل</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-red-900">
              {order.customer_rejection_reason}
            </p>
            {customerRejectedAt ? (
              <time
                dateTime={order.customer_rejected_at || undefined}
                className="mt-2 block text-xs text-red-700"
              >
                {customerRejectedAt}
              </time>
            ) : null}
          </section>
        ) : null}
      </div>
    </div>
  );
}

export function AdminOrderRow({
  order,
  tenantId,
  tenantName,
  formattedDate,
  formattedTotal,
  layout,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [revealed, setRevealed] = useState<Record<SecretField, boolean>>({
    phone: false,
    code: false,
  });
  const [copiedField, setCopiedField] = useState<SecretField | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phone = order.customer.phone || order.customer_phone;
  const code = formatCustomerAccessCode(order.customer.access_code);

  useEffect(() => {
    return () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);

  const copySecret = async (field: SecretField, value?: string | null) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopiedField(null), 2000);
    } catch {
      setCopiedField(null);
    }
  };

  const customerName = order.customer.name || order.customer_name || "عميل غير مسمى";
  const detailsButton = (targetId: string) => (
    <button
      type="button"
      onClick={() => setExpanded((value) => !value)}
      aria-expanded={expanded}
      aria-controls={targetId}
      className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-brand-border bg-white px-2.5 text-xs font-semibold text-brand-primary transition hover:bg-brand-soft focus:brand-focus"
    >
      {expanded ? "إخفاء التفاصيل" : "عرض التفاصيل"}
      <ChevronDown
        className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`}
        aria-hidden="true"
      />
    </button>
  );

  const customerSecrets = (
    <div className="mt-2 space-y-1">
      <SecretValue
        field="phone"
        label="الهاتف"
        value={phone}
        revealed={revealed.phone}
        copied={copiedField === "phone"}
        onToggle={() => setRevealed((value) => ({ ...value, phone: !value.phone }))}
        onCopy={() => copySecret("phone", phone)}
        orderId={order.id}
      />
      <SecretValue
        field="code"
        label="كود العميل"
        value={code}
        revealed={revealed.code}
        copied={copiedField === "code"}
        onToggle={() => setRevealed((value) => ({ ...value, code: !value.code }))}
        onCopy={() => copySecret("code", code)}
        orderId={order.id}
      />
    </div>
  );

  if (layout === "desktop") {
    return (
      <>
      <tr className="align-top transition-colors hover:bg-gray-50/70">
        <td className="px-4 py-4 text-sm font-medium text-brand-text">
          <div className="flex items-center gap-3">
            <span>#{order.id}</span>
            {detailsButton(`order-${order.id}-details`)}
          </div>
        </td>
        <td className="px-4 py-4 text-sm text-brand-text">
          <p className="font-semibold">{customerName}</p>
          {customerSecrets}
        </td>
        <td className="px-4 py-4 text-sm text-brand-text">
          {tenantId ? (
            <Link href={`/admin/merchants/${tenantId}`} className="font-medium text-brand-primary hover:underline">
              {tenantName}
            </Link>
          ) : (
            tenantName
          )}
        </td>
        <td className="px-4 py-4 whitespace-nowrap text-sm text-brand-text">
          <time dateTime={order.created_at}>{formattedDate}</time>
        </td>
        <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold text-brand-text">{formattedTotal}</td>
        <td className="px-4 py-4 whitespace-nowrap text-sm">
          <StatusBadge status={order.status || OrderStatus.DRAFT} className="px-2 py-1" />
        </td>
      </tr>
      {expanded ? (
        <tr id={`order-${order.id}-details`}>
          <td colSpan={6} className="bg-brand-soft/45 px-4 py-5">
            <OrderDetails order={order} idPrefix={`order-${order.id}`} />
          </td>
        </tr>
      ) : null}
      </>
    );
  }

  return (
      <article className="rounded-xl border border-brand-border bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-gray-500">طلب #{order.id}</p>
            <h2 className="mt-1 font-bold text-brand-text">{customerName}</h2>
          </div>
          <StatusBadge status={order.status || OrderStatus.DRAFT} className="px-2 py-1" />
        </div>
        {customerSecrets}
        <dl className="mt-4 grid grid-cols-2 gap-3 border-y border-brand-border py-3 text-xs">
          <div>
            <dt className="text-gray-500">المتجر</dt>
            <dd className="mt-1 font-semibold text-brand-text">
              {tenantId ? <Link href={`/admin/merchants/${tenantId}`}>{tenantName}</Link> : tenantName}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">الإجمالي</dt>
            <dd className="mt-1 font-bold text-brand-primary">{formattedTotal}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-gray-500">التاريخ والوقت</dt>
            <dd className="mt-1 font-medium text-brand-text">
              <time dateTime={order.created_at}>{formattedDate}</time>
            </dd>
          </div>
        </dl>
        <div className="mt-3">{detailsButton(`mobile-order-${order.id}-details`)}</div>
        {expanded ? (
          <div id={`mobile-order-${order.id}-details`} className="mt-4 border-t border-brand-border pt-4">
            <OrderDetails order={order} idPrefix={`mobile-order-${order.id}`} />
          </div>
        ) : null}
      </article>
  );
}
