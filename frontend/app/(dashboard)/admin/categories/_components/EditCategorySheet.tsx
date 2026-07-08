"use client";

import { useState } from "react";
import BottomSheet from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import ImageThumbnail from "@/components/ui/ImageThumbnail";
import { resolveImageUrl } from "@/app/(dashboard)/merchant/(features)/products/new/_utils/product-onboarding";
import { Pencil } from "lucide-react";

type EditCategorySheetProps = {
  initialName: string;
  initialImageUrl?: string | null;
  action: (formData: FormData) => Promise<void>;
  disabled?: boolean;
};

export function EditCategorySheet({
  initialName,
  initialImageUrl,
  action,
  disabled,
}: EditCategorySheetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const showImageField = initialImageUrl !== undefined;

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
          encType="multipart/form-data"
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
          {showImageField ? (
            <div className="flex flex-col gap-2">
              {initialImageUrl ? (
                <div className="flex items-center gap-3 rounded-md border border-brand-border bg-brand-soft/40 p-3">
                  <ImageThumbnail
                    src={resolveImageUrl(initialImageUrl)}
                    alt={initialName}
                    width={48}
                    height={48}
                    sizes="48px"
                    disableEnlarge={true}
                    imageClassName="h-12 w-12 rounded-md object-cover ring-1 ring-brand-border"
                    fallback={
                      <span className="flex h-12 w-12 items-center justify-center rounded-md bg-white text-sm">
                        🛒
                      </span>
                    }
                  />
                  <label className="flex items-center gap-2 text-sm font-medium text-brand-text">
                    <input
                      name="clear_image"
                      type="checkbox"
                      value="true"
                      className="h-4 w-4 rounded border-brand-border"
                    />
                    إزالة الصورة الحالية
                  </label>
                </div>
              ) : null}
              <label
                htmlFor="file"
                className="text-sm font-medium text-brand-text"
              >
                رفع صورة التصنيف
              </label>
              <input
                id="file"
                name="file"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                className="block h-10 w-full rounded-md border border-brand-border bg-white px-3 py-1.5 text-sm text-brand-text file:ms-3 file:rounded-md file:border-0 file:bg-brand-primary file:px-3 file:py-1 file:text-sm file:font-semibold file:text-white"
              />
            </div>
          ) : null}
          <Button type="submit" className="w-full">
            حفظ التعديلات
          </Button>
        </form>
      </BottomSheet>
    </>
  );
}
