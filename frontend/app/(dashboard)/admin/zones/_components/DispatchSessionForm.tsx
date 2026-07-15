"use client";

import { useState, useTransition } from "react";
import { startZoneDispatchSessionAction } from "@/actions/admin-server";
import { Button } from "@/components/ui/Button";
import Toast from "@/components/ui/Toast";
import { DISPATCH_SESSION_PERMISSION_MESSAGE } from "@/constants/admin-managed-permissions";

type DispatchSessionFormProps = {
  zoneId: number;
  tenantId: number;
  canStart: boolean;
  className?: string;
  inputClassName?: string;
};

export function DispatchSessionForm({
  zoneId,
  tenantId,
  canStart,
  className,
  inputClassName = "flex-1 rounded-md border border-amber-300 px-3 py-2",
}: DispatchSessionFormProps) {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submitAction = (formData: FormData) => {
    if (!canStart) {
      setToastMessage(DISPATCH_SESSION_PERMISSION_MESSAGE);
      return;
    }

    setToastMessage(null);
    startTransition(async () => {
      const result = await startZoneDispatchSessionAction(
        zoneId,
        tenantId,
        formData,
      );
      setToastMessage(result.message);
    });
  };

  return (
    <>
      {toastMessage ? (
        <Toast
          message={toastMessage}
          type="error"
          onClose={() => setToastMessage(null)}
          position="top"
        />
      ) : null}

      <form action={submitAction} className={className}>
        <input
          name="reason"
          required
          minLength={10}
          maxLength={500}
          className={inputClassName}
          placeholder="سبب الدخول إلى قائمة توزيع المنطقة"
        />
        <Button
          type={canStart ? "submit" : "button"}
          disabled={isPending}
          onClick={
            canStart
              ? undefined
              : () => setToastMessage(DISPATCH_SESSION_PERMISSION_MESSAGE)
          }
        >
          {isPending ? "جارٍ فتح القائمة..." : "فتح قائمة التوزيع"}
        </Button>
      </form>
    </>
  );
}
