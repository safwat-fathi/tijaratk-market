"use client";

import { useState } from "react";
import { CheckCircle2, PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import BulkEssentialWizard from "@/components/merchant/BulkEssentialWizard";
import type { Tenant } from "@/types/models/tenant";

export default function AddProductsStep({
  tenant,
  onNext,
}: {
  tenant: Tenant;
  setTenant: (t: Tenant) => void;
  onNext: () => void;
}) {
  const [isBulkWizardOpen, setIsBulkWizardOpen] = useState(false);
  const [addedProductsCount, setAddedProductsCount] = useState(0);
  const [hasCompletedEssentialImport, setHasCompletedEssentialImport] =
    useState(false);

  const hasAddedProducts =
    addedProductsCount > 0 || hasCompletedEssentialImport;
  const canUseEssentialImport = tenant.category === "grocery";

  if (!canUseEssentialImport) {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
        <div className="flex flex-col items-center text-center space-y-6 pt-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-soft text-brand-primary">
            <PackagePlus className="h-10 w-10" />
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-bold text-gray-900">
              أضف منتجاتك من لوحة التحكم
            </h3>
            <p className="mx-auto max-w-sm text-sm leading-relaxed text-gray-600">
              التشكيلة الأساسية متاحة حاليًا لمحلات السوبر ماركت فقط. يمكنك
              متابعة الإعداد وإضافة منتجات متجرك بعد الدخول للوحة التحكم.
            </p>
          </div>

          <Button
            onClick={onNext}
            size="lg"
            className="w-full sm:w-auto sm:px-8"
          >
            متابعة
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="flex flex-col items-center text-center space-y-6 pt-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-soft text-brand-primary">
          {hasAddedProducts ? (
            <CheckCircle2 className="h-10 w-10" />
          ) : (
            <PackagePlus className="h-10 w-10" />
          )}
        </div>

        <div className="space-y-2">
          <h3 className="text-xl font-bold text-gray-900">
            {hasAddedProducts
              ? "تمت إضافة منتجات أساسية"
              : "إضافة المنتجات الأساسية دفعة واحدة"}
          </h3>
          <p className="mx-auto max-w-sm text-sm leading-relaxed text-gray-600">
            {addedProductsCount > 0
              ? `تمت إضافة ${addedProductsCount} منتج. يمكنك إعادة المحاولة لإضافة أي منتجات أساسية جديدة أو المتابعة لمراجعة الأسعار.`
              : hasCompletedEssentialImport
                ? "منتجات التشكيلة الأساسية موجودة بالفعل في متجرك. يمكنك المتابعة لمراجعة الأسعار."
              : "أضف كل المنتجات الأساسية المناسبة لمتاجر السوبر ماركت بضغطة واحدة، ثم راجع الأسعار قبل نشرها للعملاء."}
          </p>
        </div>

        <div className="grid w-full grid-cols-3 gap-3 py-2">
          <div className="rounded-lg bg-gray-100 p-3 text-center text-xs font-semibold text-gray-700">
            تجهيز
          </div>
          <div className="rounded-lg bg-gray-100 p-3 text-center text-xs font-semibold text-gray-700">
            إضافة
          </div>
          <div className="rounded-lg bg-gray-100 p-3 text-center text-xs font-semibold text-gray-700">
            مراجعة
          </div>
        </div>

        <div className="flex w-full flex-col gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:justify-end">
          {!hasAddedProducts ? (
            <Button
              onClick={onNext}
              size="lg"
              variant="outline"
              className="w-full sm:w-auto sm:px-8"
            >
              تخطي هذه الخطوة
            </Button>
          ) : null}
          <Button
            onClick={() => setIsBulkWizardOpen(true)}
            size="lg"
            variant={hasAddedProducts ? "outline" : "primary"}
            className="w-full sm:w-auto sm:px-8"
          >
            {hasAddedProducts
              ? "إعادة إضافة التشكيلة"
              : "إضافة المنتجات الأساسية"}
          </Button>
          {hasAddedProducts ? (
            <Button
              onClick={onNext}
              size="lg"
              className="w-full sm:w-auto sm:px-8"
            >
              متابعة لمراجعة الأسعار
            </Button>
          ) : null}
        </div>
      </div>

      <BulkEssentialWizard
        isOpen={isBulkWizardOpen}
        onClose={() => setIsBulkWizardOpen(false)}
        onSuccess={() => setHasCompletedEssentialImport(true)}
        onSkip={() => {
          setIsBulkWizardOpen(false);
          onNext();
        }}
        onCategoryAdded={(count) => {
          setAddedProductsCount((current) => current + count);
        }}
      />
    </div>
  );
}
