"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

type OrderSuccessViewProps = {
  tenantSlug: string;
  orderToken: string;
  customerAccessCode?: string;
  newOrderHref?: string | null;
  newOrderLabel?: string;
  successDescription?: string;
  scheduledDeliveryLabel?: string | null;
};

const TrackingOrdersIcon = () => (
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
    className="shrink-0 opacity-90"
    aria-hidden="true"
  >
    <path d="M3 7h13" />
    <path d="M3 12h9" />
    <path d="M3 17h6" />
    <circle cx="17" cy="17" r="4" />
    <path d="m19 19-2-2V15" />
  </svg>
);

export default function OrderSuccessView({
  tenantSlug,
  orderToken,
  customerAccessCode,
  newOrderHref,
  newOrderLabel = "عمل طلب جديد من نفس المتجر",
  successDescription = "سيتواصل معك صاحب المتجر للتأكيد.",
  scheduledDeliveryLabel,
}: OrderSuccessViewProps) {
  const [copied, setCopied] = useState(false);
  const [copiedCustomerCode, setCopiedCustomerCode] = useState(false);

  const handleCopyToken = useCallback(() => {
    const url = `${window.location.origin}/track-order/${orderToken}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [orderToken]);

  const handleCopyCustomerCode = useCallback(() => {
    if (!customerAccessCode) return;
    navigator.clipboard.writeText(customerAccessCode);
    setCopiedCustomerCode(true);
    setTimeout(() => setCopiedCustomerCode(false), 2000);
  }, [customerAccessCode]);

  return (
    <div className="fixed inset-0 z-50 flex animate-fade-in flex-col items-center justify-start sm:justify-center overflow-y-auto bg-white p-6 py-10 text-center">
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-status-success/15 text-status-success shrink-0">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </div>
      <h2 className="mb-2 text-3xl font-bold text-brand-text">
        تم إرسال الطلب!
      </h2>
      <p className="mb-4 max-w-sm text-muted-foreground">
        {successDescription} <br />
        احفظ كود العميل ورابط التتبع لمتابعة طلباتك من أي جهاز.
      </p>

      {scheduledDeliveryLabel ? (
        <div className="mb-4 w-full max-w-sm rounded-lg border border-amber-200 bg-amber-50 p-4 text-right">
          <p className="text-xs font-semibold text-amber-800">معاد التوصيل المحدد</p>
          <p className="mt-1 font-bold text-amber-950">{scheduledDeliveryLabel}</p>
        </div>
      ) : null}

      <div className="mb-4 flex w-full max-w-sm items-start gap-2.5 rounded-lg border border-brand-border bg-brand-soft/30 p-3 text-right text-xs text-muted-foreground dark:bg-brand-soft/5">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mt-0.5 shrink-0 text-brand-primary/70"
        >
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <p className="leading-relaxed">
          <strong className="text-brand-text">تنويه:</strong> المنصة غير مسؤولة
          عن أي منتج تالف، منتهي الصلاحية أو غير صالح للاستخدام الآدمي.
        </p>
      </div>

      {customerAccessCode && (
        <div className="mb-4 flex w-full max-w-sm items-center justify-between gap-4 rounded-lg border border-brand-primary/20 bg-brand-soft/70 p-4">
          <div className="flex flex-col items-start overflow-hidden text-start">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              كود العميل
            </span>
            <span className="mt-1 font-mono text-2xl font-black tracking-wider text-brand-text">
              {customerAccessCode}
            </span>
            <span className="mt-1 text-xs leading-5 text-muted-foreground">
              استخدمه مع رقم هاتفك لتعبئة بياناتك وتتبع طلباتك من أي جهاز.
            </span>
          </div>
          <button
            type="button"
            onClick={handleCopyCustomerCode}
            aria-label="نسخ كود العميل"
            className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-white hover:text-brand-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/20"
            title="نسخ كود العميل"
          >
            {copiedCustomerCode ? (
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
                className="text-status-success"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            ) : (
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
                <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
              </svg>
            )}
          </button>
        </div>
      )}

      <div className="mb-6 flex w-full max-w-sm items-center justify-between gap-4 rounded-lg border border-brand-border bg-brand-soft/50 p-4">
        <div className="flex flex-col items-start overflow-hidden">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            رابط التتبع
          </span>
          <div className="flex w-full items-center gap-1 text-brand-text">
            <span className="w-full truncate font-mono text-sm text-muted-foreground">
              {typeof window !== "undefined" ? window.location.origin : ""}
              /track-order/
            </span>
            <span className="text-sm font-mono font-bold">
              {orderToken.slice(0, 8)}...
            </span>
          </div>
        </div>
        <button
          id="copy-btn"
          type="button"
          onClick={handleCopyToken}
          aria-label="نسخ رابط التتبع"
          className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-white hover:text-brand-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/20"
          title="نسخ الرابط"
        >
          {copied ? (
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
              className="text-status-success"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
          ) : (
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
              <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
            </svg>
          )}
        </button>
      </div>

      <div className="flex w-full max-w-xs flex-col gap-3">
        <Link
          href={`/track-order/${orderToken}`}
          prefetch={true}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-brand-primary py-3.5 text-lg font-bold text-white shadow-soft transition-colors hover:bg-brand-primary-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/20"
        >
          <span>تتبع الطلب</span>
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
            <path d="m12 19-7-7 7-7" />
            <path d="M19 12H5" />
          </svg>
        </Link>
        <Link
          href="/track-orders"
          prefetch={true}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-brand-border bg-white py-3.5 text-center font-semibold text-brand-text transition-colors hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/20"
        >
          <TrackingOrdersIcon />
          عرض كل طلباتي
        </Link>

        {newOrderHref !== null && (
          <Link
            href={newOrderHref ?? `/${tenantSlug}`}
            prefetch={true}
            className="w-full rounded-md py-3.5 font-semibold text-muted-foreground transition-colors hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/20"
          >
            {newOrderLabel}
          </Link>
        )}
      </div>
    </div>
  );
}
