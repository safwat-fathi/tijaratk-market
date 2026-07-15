"use client";

import { useState, useTransition } from "react";
import { syncZoneEssentialCatalogAction } from "@/actions/admin-server";
import { Button } from "@/components/ui/Button";
import Toast from "@/components/ui/Toast";

type SyncEssentialCatalogButtonProps = {
  zoneId: number;
};

type ToastState = {
  id: number;
  message: string;
  type: "success" | "error";
};

export function SyncEssentialCatalogButton({
  zoneId,
}: SyncEssentialCatalogButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<ToastState | null>(null);

  const synchronize = () => {
    startTransition(async () => {
      try {
        const result = await syncZoneEssentialCatalogAction(zoneId);
        setToast({
          id: Date.now(),
          message: result.message,
          type: result.success ? "success" : "error",
        });
      } catch {
        setToast({
          id: Date.now(),
          message: "تعذر مزامنة المنتجات الأساسية للمنطقة. حاول مرة أخرى.",
          type: "error",
        });
      }
    });
  };

  return (
    <>
      {toast ? (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      ) : null}
      <Button
        type="button"
        variant="outline"
        disabled={isPending}
        onClick={synchronize}
      >
        {isPending ? "جارٍ مزامنة المنتجات..." : "مزامنة المنتجات الأساسية"}
      </Button>
    </>
  );
}
