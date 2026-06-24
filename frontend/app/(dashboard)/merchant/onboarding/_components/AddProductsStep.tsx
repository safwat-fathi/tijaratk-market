"use client";

import { useState } from "react";
import { CheckCircle2, PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import BulkEssentialWizard from "@/components/merchant/BulkEssentialWizard";
import type { Tenant } from "@/types/models/tenant";

export default function AddProductsStep({
  onNext,
}: {
  tenant: Tenant;
  setTenant: (t: Tenant) => void;
  onNext: () => void;
}) {
  const [isBulkWizardOpen, setIsBulkWizardOpen] = useState(false);
  const [addedProductsCount, setAddedProductsCount] = useState(0);

  const hasAddedProducts = addedProductsCount > 0;

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
              : "اختيار المنتجات الأساسية بعناية"}
          </h3>
          <p className="mx-auto max-w-sm text-sm leading-relaxed text-gray-600">
            {hasAddedProducts
              ? `تمت إضافة ${addedProductsCount} منتج حتى الآن. يمكنك إضافة أقسام أخرى أو المتابعة لمراجعة الأسعار.`
              : "راجع كل قسم واختر المنتجات المناسبة لمتجرك. سنبدأ بأفضل 20 منتج في كل قسم، ويمكنك تعديل الاختيار قبل الإضافة."}
          </p>
        </div>

        <div className="grid w-full grid-cols-3 gap-3 py-2">
          <div className="rounded-lg bg-gray-100 p-3 text-center text-xs font-semibold text-gray-700">
            مراجعة
          </div>
          <div className="rounded-lg bg-gray-100 p-3 text-center text-xs font-semibold text-gray-700">
            اختيار
          </div>
          <div className="rounded-lg bg-gray-100 p-3 text-center text-xs font-semibold text-gray-700">
            إضافة
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
            {hasAddedProducts ? "إضافة أقسام أخرى" : "اختيار المنتجات الأساسية"}
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
        onSuccess={() => undefined}
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
