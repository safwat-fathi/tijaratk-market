"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Check,
  ChevronDown,
  Copy,
  Eye,
  EyeOff,
  PackageOpen,
  Phone,
  ShieldCheck,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
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

function formatMoney(value: number | string | null | undefined) {
  return value === null || value === undefined
    ? "غير محدد"
    : MONEY_FORMATTER.format(Number(value));
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

function OrderDetails({
  order,
  idPrefix,
}: {
  order: AdminOrderListItem;
  idPrefix: string;
}) {
  const orderTypeLabel =
    order.order_type === OrderType.FREE_TEXT ? "طلب نصي" : "طلب من الكتالوج";
  const pricingLabel =
    order.pricing_mode === PricingMode.MANUAL ? "تسعير يدوي" : "تسعير تلقائي";
  let contentCountLabel = "بدون منتجات";
  if (order.items.length) {
    contentCountLabel = `${order.items.length} ${order.items.length === 1 ? "منتج" : "منتجات"}`;
  } else if (order.order_type === OrderType.FREE_TEXT) {
    contentCountLabel = "طلب نصي";
  }

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

        {order.items.length ? (
          <div className="overflow-hidden rounded-lg border border-brand-border bg-white">
            {order.items.map((item) => (
              <div
                key={item.id}
                className="grid gap-2 border-b border-brand-border p-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto]"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-brand-text">{item.name_snapshot}</p>
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
                  <p className="mt-1 text-xs text-gray-500">الكمية: {item.quantity}</p>
                  {item.notes ? (
                    <p className="mt-1 text-xs text-amber-800">ملاحظة: {item.notes}</p>
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
        ) : order.free_text_payload?.text ? (
          <div className="rounded-lg border border-brand-border bg-white p-4">
            <p className="text-xs font-semibold text-gray-500">تفاصيل الطلب النصي</p>
            <p className="mt-2 whitespace-pre-wrap leading-7 text-brand-text">
              {order.free_text_payload.text}
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-brand-border bg-white p-5 text-center text-sm text-gray-500">
            لا توجد منتجات مسجلة لهذا الطلب.
          </div>
        )}
      </section>

      <section className="rounded-lg border border-brand-border bg-white p-4" aria-label="ملخص الطلب">
        <h3 className="text-sm font-bold text-brand-text">ملخص الطلب</h3>
        <dl className="mt-3 space-y-2.5 text-sm">
          <div className="flex items-start justify-between gap-4">
            <dt className="text-gray-500">نوع الطلب</dt>
            <dd className="font-medium text-brand-text">{orderTypeLabel}</dd>
          </div>
          <div className="flex items-start justify-between gap-4">
            <dt className="text-gray-500">طريقة التسعير</dt>
            <dd className="font-medium text-brand-text">{pricingLabel}</dd>
          </div>
          <div className="flex items-start justify-between gap-4">
            <dt className="text-gray-500">الإجمالي الفرعي</dt>
            <dd className="font-medium text-brand-text">{formatMoney(order.subtotal)}</dd>
          </div>
          <div className="flex items-start justify-between gap-4">
            <dt className="text-gray-500">رسوم التوصيل</dt>
            <dd className="font-medium text-brand-text">{formatMoney(order.delivery_fee)}</dd>
          </div>
          <div className="flex items-start justify-between gap-4 border-t border-brand-border pt-2.5">
            <dt className="font-bold text-brand-text">الإجمالي النهائي</dt>
            <dd className="font-bold text-brand-primary">{formatMoney(order.total)}</dd>
          </div>
        </dl>
        <div className="mt-4 space-y-3 border-t border-brand-border pt-4 text-sm">
          <div>
            <p className="text-xs font-semibold text-gray-500">عنوان التوصيل</p>
            <p className="mt-1 leading-6 text-brand-text">
              {order.delivery_address || "غير متاح"}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500">ملاحظات الطلب</p>
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
