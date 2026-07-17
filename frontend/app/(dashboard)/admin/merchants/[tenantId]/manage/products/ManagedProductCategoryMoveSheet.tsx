"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowRightLeft } from "lucide-react";
import { moveManagedProductCategoryAction } from "@/actions/admin-server";
import BottomSheet from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { Combobox } from "@/components/ui/Combobox";
import Toast from "@/components/ui/Toast";

type ToastState = {
  id: number;
  message: string;
  type: "success" | "error";
};

type ManagedProductCategoryMoveSheetProps = {
  tenantId: number;
  productId: number;
  productName: string;
  currentCategory: string;
  categories: string[];
};

export function ManagedProductCategoryMoveSheet({
  tenantId,
  productId,
  productName,
  currentCategory,
  categories,
}: ManagedProductCategoryMoveSheetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [targetCategory, setTargetCategory] = useState("");
  const [toast, setToast] = useState<ToastState | null>(null);
  const [isPending, startTransition] = useTransition();
  const targetCategories = useMemo(
    () => categories.filter((category) => category !== currentCategory),
    [categories, currentCategory],
  );
  const canSubmit = targetCategories.includes(targetCategory.trim());

  const moveProduct = () => {
    if (!canSubmit) return;

    startTransition(async () => {
      const result = await moveManagedProductCategoryAction(
        tenantId,
        productId,
        targetCategory,
      );
      setToast({
        id: Date.now(),
        message: result.message,
        type: result.success ? "success" : "error",
      });

      if (result.success) {
        setIsOpen(false);
        setTargetCategory("");
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
        size="sm"
        variant="outline"
        disabled={targetCategories.length === 0}
        onClick={() => setIsOpen(true)}
      >
        <ArrowRightLeft className="ms-1 h-4 w-4" />
        نقل التصنيف
      </Button>
      <BottomSheet
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="نقل المنتج إلى تصنيف آخر"
      >
        <div className="flex flex-col gap-4">
          <div className="rounded-md border border-brand-border bg-brand-soft/50 p-3 text-sm text-brand-text">
            سيتم نقل "{productName}" من "{currentCategory || "بدون تصنيف"}" إلى
            التصنيف المختار.
          </div>
          <Combobox
            name="target_category"
            label="التصنيف الهدف"
            options={targetCategories}
            value={targetCategory}
            onValueChange={setTargetCategory}
            inputClassName="h-10 px-3 text-sm"
            labelClassName="text-sm"
            placeholder="اختر التصنيف الهدف"
            required
            disableFiltering
          />
          <Button
            type="button"
            className="w-full"
            disabled={!canSubmit || isPending}
            onClick={moveProduct}
          >
            {isPending ? "جارٍ نقل المنتج..." : "نقل المنتج"}
          </Button>
        </div>
      </BottomSheet>
    </>
  );
}
