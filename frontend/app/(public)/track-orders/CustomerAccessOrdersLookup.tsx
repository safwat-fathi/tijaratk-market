"use client";

import Link from "next/link";
import { useState } from "react";

import { getPublicOrdersByAccessCodeAction } from "@/actions/customer-actions";
import { clearTrackedOrdersAction, removeTrackedOrderAction } from "@/actions/order-tracking-actions";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatCurrency } from "@/lib/utils/currency";
import { OrderStatus } from "@/types/enums";
import type { Order } from "@/types/models/order";
import type { TrackedOrderCookieItem, SavedAccessCodeCookieItem } from "@/lib/tracking/customer-tracking-cookie";

const STATUS_META: Record<
  OrderStatus,
  { label: string; hint: string }
> = {
  [OrderStatus.DRAFT]: {
    label: "قيد المراجعة",
    hint: "المتجر يراجع الطلب حالياً.",
  },
  [OrderStatus.CONFIRMED]: {
    label: "تم التأكيد",
    hint: "تم تأكيد الطلب ويجري التجهيز.",
  },
  [OrderStatus.OUT_FOR_DELIVERY]: {
    label: "خرج للتوصيل",
    hint: "الطلب في الطريق إليك.",
  },
  [OrderStatus.COMPLETED]: {
    label: "مكتمل",
    hint: "تم توصيل الطلب بنجاح.",
  },
  [OrderStatus.CANCELLED]: {
    label: "ملغي",
    hint: "تم إلغاء الطلب.",
  },
  [OrderStatus.REJECTED_BY_CUSTOMER]: {
    label: "مرفوض من العميل",
    hint: "تم رفض الطلب من العميل.",
  },
};

const STATUS_META_MAP = new Map<OrderStatus, { label: string; hint: string }>(
  Object.entries(STATUS_META) as Array<[OrderStatus, { label: string; hint: string }]>
);

function getStatusMeta(status: OrderStatus) {
  return STATUS_META_MAP.get(status) ?? STATUS_META_MAP.get(OrderStatus.DRAFT)!;
}

function formatOrderDate(value?: string) {
  if (!value) return "غير متوفر";
  return new Date(value).toLocaleString("ar-EG");
}

interface CustomerAccessOrdersLookupProps {
  initialTrackedItems: TrackedOrderCookieItem[];
  initialOrdersByToken: Record<string, Order>;
  hasError?: boolean;
  initialSavedCodes?: SavedAccessCodeCookieItem[];
}

export default function CustomerAccessOrdersLookup({
  initialTrackedItems = [],
  initialOrdersByToken = {},
  hasError = false,
  initialSavedCodes = [],
}: CustomerAccessOrdersLookupProps) {
  const defaultSaved = initialSavedCodes[0];
  const [code, setCode] = useState(defaultSaved?.code || "");
  const [phone, setPhone] = useState(defaultSaved?.phone || "");
  const [lookupOrders, setLookupOrders] = useState<Order[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLookup = async (overrideCode?: string, overridePhone?: string) => {
    const trimmedCode = (overrideCode ?? code).trim();
    const trimmedPhone = (overridePhone ?? phone).trim();
    if (!trimmedCode || !trimmedPhone) {
      setMessage("اكتب كود العميل ورقم الهاتف");
      setLookupOrders([]);
      return;
    }

    if (overrideCode !== undefined) setCode(trimmedCode);
    if (overridePhone !== undefined) setPhone(trimmedPhone);

    setIsLoading(true);
    setMessage(null);
    const response = await getPublicOrdersByAccessCodeAction({
      code: trimmedCode,
      phone: trimmedPhone,
    });
    setIsLoading(false);

    if (!response.success || !response.data) {
      setMessage(response.message || "تعذر تحميل الطلبات");
      setLookupOrders([]);
      return;
    }

    setLookupOrders(response.data);
    setMessage(
      response.data.length > 0
        ? null
        : "لم نجد طلبات لهذا الكود ورقم الهاتف",
    );
  };

  const renderOrderCard = (
    token: string,
    created_at: string,
    slug: string,
    order?: Order,
    isCookieItem: boolean = false
  ) => {
    const status = order?.status ?? OrderStatus.DRAFT;
    const meta = getStatusMeta(status);
    const storeName = order?.tenant?.name || "المتجر";
    const totalText =
      order?.total !== null && order?.total !== undefined
        ? formatCurrency(Number(order.total) || 0)
        : "يتم تأكيد السعر";
    const isZoneOrder =
      Boolean(order?.zone_storefront) || slug.startsWith("market:");
    const reorderBase = isZoneOrder
      ? order?.zone_storefront?.reorder_url ?? null
      : slug
        ? `/${slug}`
        : null;

    return (
      <div
        key={token}
        className="rounded-lg border border-brand-border bg-brand-soft/10 p-4 transition-all hover:bg-brand-soft/20"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {storeName}
            </p>
            <p className="mt-1 text-base font-bold text-brand-text">
              طلب بتاريخ {formatOrderDate(created_at)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{meta.hint}</p>
            <p className="mt-2 text-xs font-medium text-muted-foreground">
              رقم التتبع: {token}
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <StatusBadge status={status} label={meta.label} />
            <p className="text-sm font-semibold text-brand-text">{totalText}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          {isCookieItem && (status === OrderStatus.CANCELLED || status === OrderStatus.REJECTED_BY_CUSTOMER) ? (
            <form action={removeTrackedOrderAction.bind(null, token)} className="flex-1 flex">
              <button
                type="submit"
                className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-brand-border bg-white px-4 py-2 text-sm font-semibold text-status-error transition-colors hover:bg-status-error/5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/20 cursor-pointer"
              >
                إزالة من القائمة
              </button>
            </form>
          ) : (
            <Link
              href={`/track-order/${token}`}
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-md bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-primary-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/20"
            >
              تفاصيل التتبع
            </Link>
          )}
          {reorderBase && (
            <Link
              href={`${reorderBase}?reorder=${token}`}
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-md border border-brand-border bg-white px-4 py-2 text-sm font-semibold text-brand-text transition-colors hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/20"
            >
              إعادة الطلب
            </Link>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {initialSavedCodes.length > 0 && (
        <div className="mt-6 rounded-lg border border-brand-accent/30 bg-brand-soft/20 px-4 py-3">
          <p className="text-sm font-semibold text-brand-text">
            تم العثور على كود العميل: <span className="text-brand-accent font-black tracking-widest">{initialSavedCodes[0].code}</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            تم ملء بياناتك تلقائياً لتسهيل البحث.
          </p>
        </div>
      )}

      <Card className="mt-6 p-5">
        <div>
        <h2 className="text-lg font-black text-brand-text">تتبع بكود العميل</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          اكتب كود العميل ورقم الهاتف لعرض طلباتك من أي جهاز.
        </p>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <input
          type="text"
          dir="ltr"
          placeholder="A7K-42Q9"
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          className="min-h-11 rounded-md border border-brand-border bg-white px-3 py-2 text-sm font-semibold tracking-wider text-brand-text transition-colors focus:border-brand-accent focus:outline-none focus:ring-4 focus:ring-brand-accent/15"
        />
        <input
          type="tel"
          inputMode="numeric"
          dir="ltr"
          placeholder="01012345678"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          className="min-h-11 rounded-md border border-brand-border bg-white px-3 py-2 text-sm text-brand-text transition-colors focus:border-brand-accent focus:outline-none focus:ring-4 focus:ring-brand-accent/15"
        />
        <button
          type="button"
          disabled={isLoading}
          onClick={() => handleLookup()}
          className="min-h-11 rounded-md bg-brand-primary px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-primary-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/20 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
        >
          {isLoading ? "جار التحميل" : "عرض الطلبات"}
        </button>
      </div>

      {initialSavedCodes.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {initialSavedCodes.map((saved) => (
            <button
              key={saved.phone}
              type="button"
              onClick={() => handleLookup(saved.code, saved.phone)}
              className={`rounded border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                code === saved.code && phone === saved.phone
                  ? "border-brand-accent bg-brand-soft/50 text-brand-text"
                  : "border-brand-border bg-white text-muted-foreground hover:bg-brand-soft/20 hover:border-brand-accent/50"
              }`}
            >
              حساب: <span dir="ltr">{saved.phone}</span>
            </button>
          ))}
        </div>
      )}

      {message && (
        <p className="mt-3 rounded-md border border-brand-border bg-brand-soft/40 px-3 py-2 text-sm font-medium text-muted-foreground">
          {message}
        </p>
      )}

      {hasError && (
        <div className="mt-4 rounded-lg border border-status-warning/30 bg-status-warning/20 px-4 py-3 text-sm text-amber-900">
          تعذر تحميل تفاصيل الطلبات المحفوظة حالياً. أعد المحاولة بعد قليل.
        </div>
      )}

      {/* Lookup results */}
      {lookupOrders.length > 0 && (
        <div className="mt-6 space-y-4 border-t border-brand-border pt-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-brand-text">
              نتائج البحث لكود العميل
            </h3>
            <button
              onClick={() => {
                setLookupOrders([]);
                setCode("");
                setPhone("");
              }}
              className="text-xs text-muted-foreground hover:text-brand-text hover:underline cursor-pointer"
            >
              مسح البحث
            </button>
          </div>
          <div className="space-y-3">
            {lookupOrders.map((order) =>
              renderOrderCard(
                order.public_token,
                order.created_at,
                order.tenant?.slug || "",
                order,
                false
              )
            )}
          </div>
        </div>
      )}

      {/* Saved orders (on page load / cookie) */}
      {initialTrackedItems.length > 0 && (
        <div className="mt-6 space-y-4 border-t border-brand-border pt-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-brand-text">
              الطلبات المحفوظة على هذا الجهاز
            </h3>
            <form action={clearTrackedOrdersAction}>
              <button
                type="submit"
                className="text-xs text-status-error hover:underline cursor-pointer"
              >
                مسح الطلبات
              </button>
            </form>
          </div>
          <div className="space-y-3">
            {initialTrackedItems.map((item) =>
              renderOrderCard(
                item.token,
                initialOrdersByToken[item.token]?.created_at || item.created_at,
                initialOrdersByToken[item.token]?.tenant?.slug || item.slug,
                initialOrdersByToken[item.token],
                true
              )
            )}
          </div>
        </div>
      )}

      {/* Empty State */}
      {initialTrackedItems.length === 0 && lookupOrders.length === 0 && (
        <div className="mt-6 border-t border-brand-border pt-5">
          <EmptyState
            title="لا توجد طلبات محفوظة بعد"
            description="بعد إرسال أول طلب من أي متجر، ستجده هنا مباشرة لتتبع حالته، أو يمكنك استخدام كود العميل لعرض طلباتك."
            icon={
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M8 18h8" />
                <path d="M8 14h8" />
                <path d="M8 10h8" />
                <rect width="18" height="20" x="3" y="2" rx="2" />
              </svg>
            }
          />
        </div>
      )}
    </Card>
    </>
  );
}
