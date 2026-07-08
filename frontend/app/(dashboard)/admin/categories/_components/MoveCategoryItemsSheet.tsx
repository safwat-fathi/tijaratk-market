"use client";

import { useState } from "react";
import BottomSheet from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { Combobox } from "@/components/ui/Combobox";
import { ArrowRightLeft } from "lucide-react";

type MoveCategoryItemsSheetProps = {
  sourceName: string;
  itemCount: number;
  targetCategories: string[];
  itemLabel: string;
  action: (formData: FormData) => Promise<void>;
  disabled?: boolean;
};

export function MoveCategoryItemsSheet({
  sourceName,
  itemCount,
  targetCategories,
  itemLabel,
  action,
  disabled,
}: MoveCategoryItemsSheetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [targetCategory, setTargetCategory] = useState("");
  const canSubmit = targetCategories.includes(targetCategory.trim());

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="w-10 shrink-0 px-0"
        onClick={() => setIsOpen(true)}
        disabled={disabled}
        aria-label={`نقل ${itemLabel}`}
      >
        <ArrowRightLeft className="h-4 w-4" />
      </Button>

      <BottomSheet
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={`نقل ${itemLabel} التصنيف`}
      >
        <form
          action={async (formData) => {
            await action(formData);
            setIsOpen(false);
            setTargetCategory("");
          }}
          className="flex flex-col gap-4"
        >
          <div className="rounded-md border border-brand-border bg-brand-soft/50 p-3 text-sm text-brand-text">
            سيتم نقل {itemCount} {itemLabel} من "{sourceName}" إلى التصنيف
            المختار. سيبقى التصنيف الحالي فارغًا.
          </div>

          <Combobox
            name="to_category"
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

          <Button type="submit" className="w-full" disabled={!canSubmit}>
            نقل
          </Button>
        </form>
      </BottomSheet>
    </>
  );
}
