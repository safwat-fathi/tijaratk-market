"use client";

import Link from "next/link";
import { useState } from "react";

import { getPublicOrdersByAccessCodeAction } from "@/actions/customer-actions";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatCurrency } from "@/lib/utils/currency";
import { OrderStatus } from "@/types/enums";
import type { Order } from "@/types/models/order";

const STATUS_LABELS: Record<OrderStatus, string> = {
  [OrderStatus.DRAFT]: "قيد المراجعة",
  [OrderStatus.CONFIRMED]: "تم التأكيد",
  [OrderStatus.OUT_FOR_DELIVERY]: "خرج للتوصيل",
  [OrderStatus.COMPLETED]: "مكتمل",
  [OrderStatus.CANCELLED]: "ملغي",
  [OrderStatus.REJECTED_BY_CUSTOMER]: "مرفوض من العميل",
};

function formatOrderDate(value?: string) {
  if (!value) return "غير متوفر";
  return new Date(value).toLocaleString("ar-EG");
}

export default function CustomerAccessOrdersLookup() {
  const [code, setCode] = useState("");
  const [phone, setPhone] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLookup = async () => {
    const trimmedCode = code.trim();
    const trimmedPhone = phone.trim();
    if (!trimmedCode || !trimmedPhone) {
      setMessage("اكتب كود العميل ورقم الهاتف");
      setOrders([]);
      return;
    }

    setIsLoading(true);
    setMessage(null);
    const response = await getPublicOrdersByAccessCodeAction({
      code: trimmedCode,
      phone: trimmedPhone,
    });
    setIsLoading(false);

    if (!response.success || !response.data) {
      setMessage(response.message || "تعذر تحميل الطلبات");
      setOrders([]);
      return;
    }

    setOrders(response.data);
    setMessage(
      response.data.length > 0
        ? null
        : "لم نجد طلبات لهذا الكود ورقم الهاتف",
    );
  };

  return (
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
          onClick={handleLookup}
          className="min-h-11 rounded-md bg-brand-primary px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-primary-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? "جار التحميل" : "عرض الطلبات"}
        </button>
      </div>

      {message && (
        <p className="mt-3 rounded-md border border-brand-border bg-brand-soft/40 px-3 py-2 text-sm font-medium text-muted-foreground">
          {message}
        </p>
      )}

      {orders.length > 0 && (
        <div className="mt-4 space-y-3">
          {orders.map((order) => {
            const totalText =
              order.total !== null && order.total !== undefined
                ? formatCurrency(Number(order.total) || 0)
                : "يتم تأكيد السعر";
            const status = order.status ?? OrderStatus.DRAFT;

            return (
              <div
                key={order.public_token}
                className="rounded-lg border border-brand-border bg-white p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      {order.tenant?.name || "المتجر"}
                    </p>
                    <p className="mt-1 text-base font-bold text-brand-text">
                      طلب بتاريخ {formatOrderDate(order.created_at)}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-brand-text">
                      {totalText}
                    </p>
                  </div>
                  <StatusBadge
                    status={status}
                    label={STATUS_LABELS[status] || STATUS_LABELS[OrderStatus.DRAFT]}
                  />
                </div>

                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <Link
                    href={`/track-order/${order.public_token}`}
                    className="inline-flex min-h-10 flex-1 items-center justify-center rounded-md bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-primary-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/20"
                  >
                    تفاصيل التتبع
                  </Link>
                  {order.tenant?.slug && (
                    <Link
                      href={`/${order.tenant.slug}?reorder=${order.public_token}`}
                      className="inline-flex min-h-10 flex-1 items-center justify-center rounded-md border border-brand-border bg-white px-4 py-2 text-sm font-semibold text-brand-text transition-colors hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/20"
                    >
                      إعادة الطلب
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
