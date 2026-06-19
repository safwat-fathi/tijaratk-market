"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateOrderStatus } from "@/actions/order-actions";
import BottomSheet from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { OrderStatus } from "@/types/enums";

type OrderDetailsActionsProps = {
  orderId: number;
  status: OrderStatus;
  statusLabel: string;
};

export default function OrderDetailsActions({
  orderId,
  status,
  statusLabel,
}: OrderDetailsActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [isRejectSheetOpen, setIsRejectSheetOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectError, setRejectError] = useState<string | null>(null);
  const router = useRouter();

  const updateStatus = (nextStatus: OrderStatus) => {
    startTransition(async () => {
      const response = await updateOrderStatus(orderId, nextStatus);

      if (!response.success) {
        setRejectError(response.error || "تعذر تحديث حالة الطلب");
        return;
      }

      router.refresh();
    });
  };

  const rejectOrder = () => {
    setRejectError(null);

    startTransition(async () => {
      const response = await updateOrderStatus(
        orderId,
        OrderStatus.CANCELLED,
        rejectReason,
      );

      if (!response.success) {
        setRejectError(response.error || "تعذر رفض الطلب");
        return;
      }

      setIsRejectSheetOpen(false);
      setRejectReason("");
      router.refresh();
    });
  };

  if (status === OrderStatus.DRAFT) {
    return (
      <>
        <div className="safe-bottom-padding fixed bottom-0 left-0 right-0 border-t border-brand-border bg-white p-4 shadow-float">
          <div className="mx-auto grid max-w-md grid-cols-2 gap-3">
            <Button
              type="button"
              variant="outline"
              className="w-full border-status-error/25 text-status-error hover:border-status-error/40 hover:bg-status-error/10"
              onClick={() => {
                setRejectError(null);
                setIsRejectSheetOpen(true);
              }}
              disabled={isPending}
            >
              رفض الطلب
            </Button>
            <Button
              type="button"
              className="w-full"
              onClick={() => updateStatus(OrderStatus.CONFIRMED)}
              disabled={isPending}
            >
              تأكيد الطلب
            </Button>
          </div>
        </div>

        <BottomSheet
          isOpen={isRejectSheetOpen}
          title="رفض الطلب"
          closeLabel="إلغاء"
          onClose={() => {
            if (isPending) return;
            setIsRejectSheetOpen(false);
            setRejectError(null);
          }}
          footer={
            <div className="grid gap-2 pb-3 sm:grid-cols-2">
              <Button
                type="button"
                variant="destructive"
                className="min-h-12 w-full sm:order-2"
                onClick={rejectOrder}
                disabled={isPending}
              >
                {isPending ? "جاري الرفض..." : "تأكيد رفض الطلب"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-12 w-full sm:order-1"
                onClick={() => {
                  setIsRejectSheetOpen(false);
                  setRejectError(null);
                }}
                disabled={isPending}
              >
                إلغاء
              </Button>
            </div>
          }
        >
          <div className="space-y-4 text-right">
            <div className="rounded-xl border border-status-error/20 bg-status-error/10 p-3">
              <p className="text-sm font-semibold text-status-error">
                سيتم إلغاء الطلب وإظهار سبب الرفض في تفاصيل الطلب.
              </p>
              <p className="mt-1 text-xs leading-5 text-status-error/80">
                السبب اختياري، لكنه يساعدك أنت وفريقك على مراجعة الإلغاءات
                لاحقًا.
              </p>
            </div>

            {rejectError && (
              <p className="rounded-lg border border-status-error/20 bg-status-error/10 px-3 py-2 text-sm font-semibold text-status-error">
                {rejectError}
              </p>
            )}

            <label className="block">
              <span className="text-sm font-bold text-brand-text">
                سبب الرفض
              </span>
              <textarea
                value={rejectReason}
                onChange={(event) => {
                  setRejectReason(event.target.value);
                  setRejectError(null);
                }}
                placeholder="سبب الرفض (اختياري)"
                rows={4}
                disabled={isPending}
                className="mt-2 w-full resize-none rounded-xl border border-brand-border bg-white px-3 py-3 text-sm text-brand-text outline-none transition-colors placeholder:text-muted-foreground focus:border-status-error focus:ring-4 focus:ring-status-error/10 disabled:opacity-60"
              />
            </label>
          </div>
        </BottomSheet>
      </>
    );
  }

  if (status === OrderStatus.CONFIRMED) {
    return (
      <div className="safe-bottom-padding fixed bottom-0 left-0 right-0 border-t border-brand-border bg-white p-4 shadow-float">
        <div className="mx-auto max-w-md">
          <Button
            type="button"
            className="w-full bg-status-warning text-brand-text hover:bg-status-warning/90"
            onClick={() => updateStatus(OrderStatus.OUT_FOR_DELIVERY)}
            disabled={isPending}
          >
            تأكيد التوصيل
          </Button>
        </div>
      </div>
    );
  }

  if (status === OrderStatus.OUT_FOR_DELIVERY) {
    return (
      <div className="safe-bottom-padding fixed bottom-0 left-0 right-0 border-t border-brand-border bg-white p-4 shadow-float">
        <div className="mx-auto max-w-md">
          <Button
            type="button"
            className="w-full bg-status-completed hover:bg-status-completed/90"
            onClick={() => updateStatus(OrderStatus.COMPLETED)}
            disabled={isPending}
          >
            تم التوصيل
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="safe-bottom-padding fixed bottom-0 left-0 right-0 border-t border-brand-border bg-white p-4 shadow-float">
      <div className="mx-auto max-w-md py-2 text-center font-medium text-muted-foreground">
        حالة الطلب: {statusLabel}
      </div>
    </div>
  );
}
