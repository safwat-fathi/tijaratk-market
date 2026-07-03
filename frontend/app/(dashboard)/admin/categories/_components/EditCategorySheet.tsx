"use client";

import { useState } from "react";
import BottomSheet from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { Pencil } from "lucide-react";

type EditCategorySheetProps = {
  initialName: string;
  action: (formData: FormData) => Promise<void>;
  disabled?: boolean;
};

export function EditCategorySheet({ initialName, action, disabled }: EditCategorySheetProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="w-10 px-0 shrink-0"
        onClick={() => setIsOpen(true)}
        disabled={disabled}
        aria-label="تعديل"
      >
        <Pencil className="h-4 w-4" />
      </Button>

      <BottomSheet
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="تعديل التصنيف"
      >
        <form
          action={async (formData) => {
            await action(formData);
            setIsOpen(false);
          }}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <label htmlFor="name" className="text-sm font-medium text-brand-text">
              اسم التصنيف
            </label>
            <input
              id="name"
              name="name"
              defaultValue={initialName}
              required
              maxLength={64}
              className="h-10 w-full rounded-md border border-brand-border px-3 text-sm"
            />
          </div>
          <Button type="submit" className="w-full">
            حفظ التعديلات
          </Button>
        </form>
      </BottomSheet>
    </>
  );
}
