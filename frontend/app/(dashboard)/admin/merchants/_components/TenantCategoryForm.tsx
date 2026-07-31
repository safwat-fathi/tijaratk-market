"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateTenantCategoryAction } from "@/actions/admin-server";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

type TenantCategoryFormProps = {
  tenantId: number;
  currentCategory?: string;
};

const CATEGORY_OPTIONS = [
  { value: "grocery", label: "سوبر ماركت" },
  { value: "greengrocer", label: "خضار وفاكهة" },
  { value: "butcher", label: "لحوم ودواجن" },
  { value: "bakery", label: "مخبز وحلويات" },
  { value: "pharmacy", label: "صيدلية" },
  { value: "other", label: "أخرى" },
];

export function TenantCategoryForm({
  tenantId,
  currentCategory = "other",
}: TenantCategoryFormProps) {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState(currentCategory);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    productCount: number;
    targetCategory: string;
  } | null>(null);

  const handleUpdate = async (forceCleanup = false) => {
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      try {
        const response = await updateTenantCategoryAction(
          tenantId,
          selectedCategory,
          forceCleanup,
        );

        if (response.success) {
          setSuccess("تم تحديث نشاط المتجر بنجاح.");
          setConfirmDialog(null);
          router.refresh();
        } else if (response.requiresForceCleanup && response.productCount) {
          setConfirmDialog({
            productCount: response.productCount,
            targetCategory: selectedCategory,
          });
        } else {
          setError(response.message || "تعذر تحديث نشاط المتجر.");
        }
      } catch (err: unknown) {
        const errorObj = err as {
          response?: {
            data?: {
              requires_force_cleanup?: boolean;
              product_count?: number;
              message?: string;
            };
          };
          message?: string;
        };

        const resData = errorObj.response?.data;
        if (resData?.requires_force_cleanup && resData.product_count) {
          setConfirmDialog({
            productCount: resData.product_count,
            targetCategory: selectedCategory,
          });
        } else {
          setError(
            resData?.message || errorObj.message || "حدث خطأ غير متوقع.",
          );
        }
      }
    });
  };

  return (
    <Card className="space-y-4 p-5">
      <div>
        <h2 className="text-lg font-bold text-gray-900">نشاط / نوع المتجر</h2>
        <p className="text-sm text-gray-500">
          يمكنك تغيير نشاط المتجر لمنحه إمكانية الوصول إلى الكتالوج والخدمات المناسبة.
        </p>
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          {success}
        </div>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <label className="flex-1 space-y-1 text-sm font-semibold text-gray-700">
          نشاط المتجر الحالي
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            disabled={isPending}
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
          >
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <Button
          onClick={() => handleUpdate(false)}
          disabled={isPending || selectedCategory === currentCategory}
        >
          {isPending ? "جاري التحديث..." : "حفظ النشاط"}
        </Button>
      </div>

      {confirmDialog ? (
        <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-4">
          <h3 className="font-bold text-amber-900">
            تنبيه: يلزم إلغاء تنشيط المنتجات السابقة
          </h3>
          <p className="mt-1 text-sm text-amber-800">
            المتجر يحتوي على <strong>{confirmDialog.productCount}</strong> منتج
            مضاف حالياً. تغيير نشاط المتجر يتطلب إلغاء تنشيط هذه المنتجات لتجنب
            تعارض كتالوج المنتجات.
          </p>
          <div className="mt-3 flex gap-3">
            <Button
              variant="destructive"
              size="sm"
              disabled={isPending}
              onClick={() => handleUpdate(true)}
            >
              تأكيد وإلغاء تنشيط المنتجات
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() => setConfirmDialog(null)}
            >
              إلغاء
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
