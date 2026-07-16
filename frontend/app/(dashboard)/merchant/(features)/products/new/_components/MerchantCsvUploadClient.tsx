"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export default function MerchantCsvUploadClient() {
  const [sheetUploadMessage, setSheetUploadMessage] = useState<string | null>(null);
  const [sheetUploadResult, setSheetUploadResult] = useState<any | null>(null);
  const [isSheetUploadPending, startSheetUploadTransition] = useTransition();
  const router = useRouter();

  const handleUploadProductSheet = (formData: FormData) => {
    setSheetUploadMessage(null);
    setSheetUploadResult(null);

    startSheetUploadTransition(async () => {
      try {
        const response = await fetch('/api/merchant/products/import', {
          method: 'POST',
          body: formData,
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
          setSheetUploadMessage(result.message || "تعذر رفع ملف المنتجات");
          return;
        }
        setSheetUploadResult(result.data);
        router.refresh();
      } catch (error) {
        console.error("Error uploading CSV:", error);
        setSheetUploadMessage("حدث خطأ أثناء الاتصال بالخادم");
      }
    });
  };

  return (
    <div className="mt-4">
      <form
        id="csv-upload-form"
        action={handleUploadProductSheet}
        className="grid gap-2 rounded-md border border-brand-border bg-gray-50 p-3 sm:grid-cols-[minmax(0,1fr)_auto]"
      >
        <label className="space-y-1 block">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-brand-text">
              رفع CSV لإضافة أو تحديث منتجاتك
            </span>
          </div>
          <input
            type="file"
            name="file"
            accept=".csv,text/csv"
            className="block h-10 w-full rounded-md border border-brand-border bg-white px-3 py-2 text-sm file:me-3 file:rounded-md file:border-0 file:bg-brand-soft file:px-3 file:py-1 file:text-xs file:font-semibold file:text-brand-primary"
            required
          />
        </label>
        <button
          type="submit"
          disabled={isSheetUploadPending}
          className="inline-flex h-10 items-center justify-center self-end rounded-md bg-brand-primary px-4 text-sm font-semibold text-white transition hover:bg-brand-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSheetUploadPending ? "جاري الرفع" : "رفع الملف"}
        </button>
      </form>
      {sheetUploadMessage ? (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {sheetUploadMessage}
        </p>
      ) : null}
      {sheetUploadResult ? (
        <div className="mt-3 rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <p className="font-semibold">
            تم معالجة {sheetUploadResult.total_rows} صف: تم إنشاء{" "}
            {sheetUploadResult.created_rows} وتحديث{" "}
            {sheetUploadResult.updated_rows} وتخطي{" "}
            {sheetUploadResult.skipped_rows} وفشل{" "}
            {sheetUploadResult.failed_rows}.
          </p>
          {sheetUploadResult.errors && sheetUploadResult.errors.length > 0 ? (
            <ul className="mt-2 space-y-1 text-xs text-red-700">
              {sheetUploadResult.errors.slice(0, 5).map((error: any) => (
                <li key={`${error.row_number}-${error.message}`}>
                  صف {error.row_number}: {error.message}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
