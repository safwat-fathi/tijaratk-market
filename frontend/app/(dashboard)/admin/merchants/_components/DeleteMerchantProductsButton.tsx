"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Trash2, X } from "lucide-react";
import { adminDeleteTenantProductsAction } from "@/actions/admin-server";
import { Button } from "@/components/ui/Button";
import type { DeleteTenantProductsSummary } from "@/services/api/admin.service";

type DeleteMerchantProductsButtonProps = {
  tenantId: number;
  tenantName: string;
  productCount: number;
};

const getSkippedReasonLabel = (
  reason: DeleteTenantProductsSummary["skippedReasons"][number]["reason"],
) => {
  if (reason === "active_order_reference") {
    return "منتجات مرتبطة بطلبات نشطة";
  }

  return "سبب غير معروف";
};

export function DeleteMerchantProductsButton({
  tenantId,
  tenantName,
  productCount,
}: DeleteMerchantProductsButtonProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [result, setResult] = useState<DeleteTenantProductsSummary | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const processedCount = result
    ? result.deletedCount + result.skippedCount
    : isDeleting
      ? 0
      : null;
  const progressValue = result
    ? result.totalCount > 0
      ? Math.round(((processedCount ?? 0) / result.totalCount) * 100)
      : 100
    : isDeleting
      ? 65
      : 0;

  const resetAndClose = () => {
    if (isDeleting) return;
    setIsOpen(false);
    setResult(null);
    setError(null);
  };

  const handleOpen = () => {
    setResult(null);
    setError(null);
    setIsOpen(true);
  };

  const handleConfirm = () => {
    setError(null);
    setResult(null);
    setIsDeleting(true);

    void (async () => {
      try {
        const response = await adminDeleteTenantProductsAction(tenantId);
        if (!response.success || !response.data) {
          setError(response.message || "تعذر حذف منتجات التاجر");
          return;
        }

        setResult(response.data);
        router.refresh();
      } catch (caughtError) {
        console.error("Delete merchant products failed:", caughtError);
        setError("تعذر حذف منتجات التاجر");
      } finally {
        setIsDeleting(false);
      }
    })();
  };

  const hasBackendCountMismatch =
    Boolean(result) && productCount > 0 && result?.totalCount === 0;
  const hasNoProductsToDelete =
    Boolean(result) && productCount <= 0 && result?.totalCount === 0;
  const hasSkippedProducts = Boolean(result && result.skippedCount > 0);
  const hasDeletedAllProducts = Boolean(
    result && result.totalCount > 0 && result.skippedCount === 0,
  );

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        size="sm"
        onClick={handleOpen}
        disabled={productCount <= 0}
        className="w-full md:w-auto"
      >
        <Trash2 className="h-4 w-4" />
        حذف كل المنتجات
      </Button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`delete-merchant-products-${tenantId}`}
            className="max-h-[90vh] w-full max-w-lg min-w-0 overflow-y-auto rounded-lg bg-white p-4 text-right shadow-xl sm:p-6"
          >
            <div className="flex flex-col-reverse gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
                  <AlertTriangle className="h-6 w-6" />
                </span>
                <div className="min-w-0">
                  <h2
                    id={`delete-merchant-products-${tenantId}`}
                    className="text-lg font-bold leading-7 text-gray-900"
                  >
                    حذف كل منتجات التاجر
                  </h2>
                  <p className="mt-1 break-words text-sm leading-6 text-gray-500">
                    {tenantName} لديه {productCount} منتج غير محذوف.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={resetAndClose}
                disabled={isDeleting}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                aria-label="إغلاق"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 w-full min-w-0 whitespace-normal break-words rounded-md bg-red-50 p-3 text-sm font-semibold leading-relaxed text-red-700">
              سيتم حذف المنتجات حذفًا ناعمًا. المنتجات المرتبطة بطلبات نشطة سيتم
              تخطيها وذكرها في الملخص.
            </div>

            {isDeleting || result ? (
              <div className="mt-4 space-y-2">
                <div className="h-3 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className={`h-full rounded-full bg-red-600 transition-all duration-500 ${
                      isDeleting && !result ? "animate-pulse" : ""
                    }`}
                    style={{ width: `${Math.min(progressValue, 100)}%` }}
                  />
                </div>
                <div className="text-sm font-semibold text-gray-700">
                  {result
                    ? result.totalCount > 0
                      ? `تمت معالجة ${processedCount} من ${result.totalCount} منتج`
                      : "لم تتم معالجة أي منتجات"
                    : "جاري حذف منتجات التاجر..."}
                </div>
              </div>
            ) : null}

            {error ? (
              <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                {error}
              </p>
            ) : null}

            {result ? (
              <div
                className={`mt-4 rounded-md border p-3 text-sm ${
                  hasBackendCountMismatch
                    ? "border-red-200 bg-red-50 text-red-700"
                    : hasNoProductsToDelete
                      ? "border-gray-200 bg-gray-50 text-gray-700"
                      : "border-gray-200 bg-gray-50 text-gray-700"
                }`}
              >
                {hasBackendCountMismatch ? (
                  <p className="font-semibold">
                    لم يجد الخادم منتجات لهذا التاجر رغم أن الجدول يعرض{" "}
                    {productCount} منتج. أعد المحاولة بعد تحديث الصفحة.
                  </p>
                ) : hasNoProductsToDelete ? (
                  <p className="font-semibold text-gray-700">
                    لا توجد منتجات قابلة للحذف.
                  </p>
                ) : hasDeletedAllProducts ? (
                  <p className="font-semibold text-green-700">
                    تم حذف كل المنتجات بنجاح.
                  </p>
                ) : hasSkippedProducts ? (
                  <p className="font-semibold text-amber-700">
                    تم حذف {result.deletedCount} منتج وتخطي{" "}
                    {result.skippedCount} منتج.
                  </p>
                ) : (
                  <p className="font-semibold text-gray-700">
                    لم يتم حذف أي منتجات.
                  </p>
                )}
                {result.skippedReasons.length > 0 ? (
                  <ul className="mt-2 space-y-1">
                    {result.skippedReasons.map((item) => (
                      <li key={item.reason}>
                        {getSkippedReasonLabel(item.reason)}: {item.count}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row">
              {!result ? (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleConfirm}
                  disabled={isDeleting}
                >
                  {isDeleting ? "جاري الحذف..." : "نعم، احذف المنتجات"}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                onClick={resetAndClose}
                disabled={isDeleting}
              >
                {result ? "إغلاق" : "إلغاء"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
