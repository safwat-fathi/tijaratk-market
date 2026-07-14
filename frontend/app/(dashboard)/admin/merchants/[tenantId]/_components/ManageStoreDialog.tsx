"use client";

import { useRef } from "react";
import { startManagedStoreSessionAction } from "@/actions/admin-server";
import { Button } from "@/components/ui/Button";

type ManageStoreDialogProps = {
  tenantId: number;
  storeName: string;
  canStart: boolean;
  disabledMessage: string;
};

/** Confirms the audited context and captures the required management reason. */
export function ManageStoreDialog({
  tenantId,
  storeName,
  canStart,
  disabledMessage,
}: ManageStoreDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  if (!canStart) {
    return (
      <p className="mt-4 rounded-md bg-white p-3 text-sm text-amber-900">
        {disabledMessage}
      </p>
    );
  }

  return (
    <>
      <Button type="button" className="mt-4" onClick={() => dialogRef.current?.showModal()}>
        إدارة المتجر
      </Button>
      <dialog
        ref={dialogRef}
        aria-labelledby="manage-store-title"
        className="w-[min(92vw,36rem)] rounded-xl border border-gray-200 bg-white p-0 shadow-2xl backdrop:bg-gray-950/50"
        onCancel={() => dialogRef.current?.close()}
      >
        <div dir="rtl" className="p-6">
          <h2 id="manage-store-title" className="text-xl font-bold text-gray-950">
            إدارة {storeName}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            ستظل مسجلاً بهويتك الإدارية، وستُسجل كل الإجراءات في سجل النشاط.
          </p>
          <form
            action={startManagedStoreSessionAction.bind(null, tenantId)}
            className="mt-5 space-y-4"
          >
            <label className="block text-sm font-semibold text-gray-800" htmlFor="management-reason">
              سبب الدخول إلى المتجر
            </label>
            <textarea
              id="management-reason"
              name="reason"
              required
              autoFocus
              minLength={10}
              maxLength={500}
              rows={4}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="مثال: متابعة الطلبات الجديدة وتحديث أسعار المنتجات"
            />
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => dialogRef.current?.close()}>
                إلغاء
              </Button>
              <Button type="submit">بدء جلسة الإدارة</Button>
            </div>
          </form>
        </div>
      </dialog>
    </>
  );
}
