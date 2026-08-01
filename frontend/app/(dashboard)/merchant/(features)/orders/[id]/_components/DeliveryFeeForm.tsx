"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setOrderDeliveryFeeAction } from "@/actions/order-actions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatDeferredFeeRange } from "@/lib/delivery-configuration";

type DeliveryFeeFormProps = {
  orderId: number;
  /** Customer address the fee is being priced against. */
  deliveryAddress?: string | null;
  areaName?: string | null;
  minQuote: number | null;
  maxQuote: number | null;
};

export default function DeliveryFeeForm({
  orderId,
  deliveryAddress,
  areaName,
  minQuote,
  maxQuote,
}: DeliveryFeeFormProps) {
  const [fee, setFee] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const quotedRange = formatDeferredFeeRange(minQuote, maxQuote);

  const submit = () => {
    const parsedFee = Number(fee);
    if (fee.trim() === "" || !Number.isFinite(parsedFee) || parsedFee < 0) {
      setError("أدخل رسوم توصيل صحيحة");
      return;
    }
    if (
      (minQuote !== null && parsedFee < minQuote) ||
      (maxQuote !== null && parsedFee > maxQuote)
    ) {
      setError(`الرسوم يجب أن تكون ضمن النطاق المعلن للعميل (${quotedRange})`);
      return;
    }

    setError(null);
    startTransition(async () => {
      const response = await setOrderDeliveryFeeAction(orderId, parsedFee);
      if (!response.success) {
        setError(response.error || "تعذر تحديد رسوم التوصيل");
        return;
      }
      router.refresh();
    });
  };

  return (
    <Card className="border-status-warning/40 bg-status-warning/10 p-4">
      <h2 className="text-base font-bold text-brand-text">
        حدد رسوم التوصيل لهذا الطلب
      </h2>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        منطقة هذا الطلب رسومها تتحدد حسب العنوان. راجع عنوان العميل وحدد الرسوم
        قبل تأكيد الطلب.
      </p>

      <div className="mt-3 rounded-lg border border-brand-border bg-white p-3">
        <p className="text-xs font-semibold text-muted-foreground">
          عنوان العميل
        </p>
        <p className="mt-1 text-sm font-bold text-brand-text">
          {deliveryAddress || "غير محدد"}
        </p>
        {areaName ? (
          <p className="mt-1 text-xs text-muted-foreground">
            المنطقة: {areaName}
          </p>
        ) : null}
      </div>

      <label className="mt-3 block">
        <span className="text-sm font-bold text-brand-text">رسوم التوصيل</span>
        <div className="relative mt-2">
          <input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={fee}
            onChange={(event) => {
              setFee(event.target.value);
              setError(null);
            }}
            disabled={isPending}
            className="min-h-12 w-full rounded-xl border border-brand-border bg-white px-3 pe-16 text-base font-bold tabular-nums text-brand-text outline-none transition-colors focus:border-brand-accent focus:ring-4 focus:ring-brand-accent/20 disabled:opacity-60"
          />
          <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-xs font-semibold text-muted-foreground">
            جنيه
          </span>
        </div>
        {quotedRange ? (
          <span className="mt-2 block text-xs font-semibold text-muted-foreground">
            النطاق المعلن للعميل: {quotedRange}
          </span>
        ) : null}
      </label>

      {error ? (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-status-error/20 bg-status-error/10 px-3 py-2 text-sm font-semibold text-status-error"
        >
          {error}
        </p>
      ) : null}

      <Button
        type="button"
        className="mt-3 w-full"
        onClick={submit}
        disabled={isPending}
      >
        {isPending ? "جاري الحفظ..." : "حفظ رسوم التوصيل"}
      </Button>
    </Card>
  );
}
