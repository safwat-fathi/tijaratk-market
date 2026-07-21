"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, PackagePlus } from "lucide-react";
import BottomSheet from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { bulkAddEssentialItemsAction } from "@/actions/product-actions";

type AddEssentialItemsResult = {
  success: boolean;
  data?: { count: number };
  message?: string;
};

type AddEssentialItemsAction = (payload: {
  allEssentialItems: true;
}) => Promise<AddEssentialItemsResult>;

type BulkEssentialWizardProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onSkip?: () => void;
  onCategoryAdded?: (count: number) => void;
  addEssentialItemsAction?: AddEssentialItemsAction;
  storeTypeLabel?: string;
};

type ResultState = {
  type: "success" | "info" | "error";
  message: string;
};

const buildSuccessMessage = (count: number) =>
  count > 0
    ? `تمت إضافة ${count} منتج من التشكيلة الأساسية بنجاح.`
    : "لا توجد منتجات جديدة لإضافتها.";

export default function BulkEssentialWizard({
  isOpen,
  onClose,
  onSuccess,
  onSkip,
  onCategoryAdded,
  addEssentialItemsAction = bulkAddEssentialItemsAction,
  storeTypeLabel = "السوبر ماركت",
}: BulkEssentialWizardProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [result, setResult] = useState<ResultState | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setIsAdding(false);
      setResult(null);
    }
  }, [isOpen]);

  const addAllEssentialProducts = async () => {
    if (isAdding) {
      return;
    }

    setIsAdding(true);
    setResult(null);

    try {
      const response = await addEssentialItemsAction({
        allEssentialItems: true,
      });

      if (!response.success || !response.data) {
        setResult({
          type: "error",
          message: response.message || "تعذر إضافة التشكيلة الأساسية",
        });
        return;
      }

      const addedCount = response.data.count;
      setResult({
        type: addedCount > 0 ? "success" : "info",
        message: buildSuccessMessage(addedCount),
      });
      onCategoryAdded?.(addedCount);
      onSuccess();
    } catch {
      setResult({
        type: "error",
        message: "تعذر إضافة التشكيلة الأساسية",
      });
    } finally {
      setIsAdding(false);
    }
  };

  const handleClose = () => {
    if (isAdding) {
      return;
    }

    onClose();
  };

  const handleSkip = () => {
    if (isAdding) {
      return;
    }

    if (onSkip) {
      onSkip();
      return;
    }

    onClose();
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      title="التشكيلة الأساسية"
      onClose={handleClose}
    >
      <div className="space-y-5 py-4 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-soft text-brand-primary">
          {result?.type === "success" || result?.type === "info" ? (
            <CheckCircle2 className="h-8 w-8" />
          ) : (
            <PackagePlus className="h-8 w-8" />
          )}
        </div>

        <div className="space-y-2">
          <h3 className="text-lg font-bold text-gray-900">
            إضافة كل المنتجات الأساسية
          </h3>
          <p className="mx-auto max-w-sm text-sm leading-6 text-gray-600">
            سيتم إضافة كل المنتجات المحددة كأساسية من كتالوج {storeTypeLabel} دفعة
            واحدة، مع تجاهل المنتجات الموجودة بالفعل في المتجر.
          </p>
        </div>

        {result ? (
          <p
            className={`rounded-lg px-3 py-2 text-sm font-semibold ${
              result.type === "error"
                ? "bg-red-50 text-red-700"
                : result.type === "info"
                  ? "bg-blue-50 text-blue-700"
                  : "bg-green-50 text-green-700"
            }`}
          >
            {result.message}
          </p>
        ) : null}

        <div className="flex flex-col gap-2 pt-2">
          <Button
            onClick={addAllEssentialProducts}
            className="w-full"
            size="lg"
            disabled={isAdding}
          >
            {isAdding ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                جاري إضافة التشكيلة...
              </>
            ) : (
              "إضافة كل المنتجات الأساسية"
            )}
          </Button>
          {onSkip ? (
            <Button
              onClick={handleSkip}
              className="w-full"
              size="lg"
              variant="outline"
              disabled={isAdding}
            >
              تخطي هذه الخطوة
            </Button>
          ) : null}
        </div>
      </div>
    </BottomSheet>
  );
}
