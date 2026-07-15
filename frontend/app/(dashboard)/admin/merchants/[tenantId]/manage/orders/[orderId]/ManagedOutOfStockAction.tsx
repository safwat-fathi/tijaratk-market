"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateManagedOrderItemAction } from "@/actions/admin-server";
import BottomSheet from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";

type ManagedOutOfStockActionProps = {
  tenantId: number;
  orderId: number;
  itemId: number;
  itemName: string;
  requiresCancellationConfirmation: boolean;
};

export default function ManagedOutOfStockAction({
  tenantId,
  orderId,
  itemId,
  itemName,
  requiresCancellationConfirmation,
}: ManagedOutOfStockActionProps) {
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const closeConfirmation = () => {
    if (isPending) {
      return;
    }

    setIsConfirmationOpen(false);
    setError(null);
  };

  const submit = (cancelsOrder: boolean) => {
    setError(null);
    startTransition(async () => {
      try {
        await updateManagedOrderItemAction(
          tenantId,
          orderId,
          itemId,
          "out-of-stock",
        );
        setIsConfirmationOpen(false);
        router.refresh();
      } catch (actionError) {
        const message =
          actionError instanceof Error
            ? actionError.message
            : "تعذر تحديد منتج الطلب كغير متوفر";
        setError(message);
        if (cancelsOrder) {
          setIsConfirmationOpen(true);
        }
      }
    });
  };

  return (
    <>
      <div className="space-y-1">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() => {
            if (requiresCancellationConfirmation) {
              setError(null);
              setIsConfirmationOpen(true);
              return;
            }

            submit(false);
          }}
        >
          {isPending && !isConfirmationOpen ? "جاري التحديث..." : "غير متوفر"}
        </Button>
        {error && !isConfirmationOpen ? (
          <p className="max-w-56 text-xs font-semibold text-status-error">
            {error}
          </p>
        ) : null}
      </div>

      <BottomSheet
        isOpen={isConfirmationOpen}
        title="إلغاء الطلب؟"
        closeLabel="رجوع"
        onClose={closeConfirmation}
        footer={
          <div className="grid gap-2 pb-3 sm:grid-cols-2">
            <Button
              type="button"
              variant="destructive"
              className="min-h-12 w-full sm:order-2"
              disabled={isPending}
              onClick={() => submit(true)}
            >
              {isPending
                ? "جاري الإلغاء..."
                : "تحديد غير متوفر وإلغاء الطلب"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-12 w-full sm:order-1"
              disabled={isPending}
              onClick={closeConfirmation}
            >
              رجوع
            </Button>
          </div>
        }
      >
        <div className="space-y-4 text-right">
          <div className="rounded-xl border border-status-error/20 bg-status-error/10 p-3">
            <p className="text-sm font-semibold text-status-error">
              هذا هو الصنف الأخير المتاح في الطلب. إذا تابعت، سيتم إلغاء الطلب
              بالكامل.
            </p>
            <p className="mt-2 text-sm text-status-error/80">
              الصنف: {itemName}
            </p>
          </div>

          {error ? (
            <p className="rounded-lg border border-status-error/20 bg-status-error/10 px-3 py-2 text-sm font-semibold text-status-error">
              {error}
            </p>
          ) : null}
        </div>
      </BottomSheet>
    </>
  );
}
