"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Combobox } from "@/components/ui/Combobox";
import BottomSheet from "@/components/ui/BottomSheet";
import Toast from "@/components/ui/Toast";
import { adminCreateCatalogItemAction } from "@/actions/admin-server";

export default function AdminCatalogItemCreateClient({
  source,
  activeTabLabel,
  activeTabDescription,
  categoryNames,
}: {
  source: string;
  activeTabLabel: string;
  activeTabDescription: string;
  categoryNames: string[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [category, setCategory] = useState("");
  const [toastData, setToastData] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const action = (formData: FormData) => {
    setToastData(null);
    startTransition(async () => {
      if (!categoryNames.includes(category)) {
        setToastData({
          message: "اختر تصنيفًا متاحًا من القائمة.",
          type: "error",
        });
        return;
      }

      const result = await adminCreateCatalogItemAction(formData);
      if (!result.success) {
        setToastData({ message: result.message, type: "error" });
        return;
      }

      setCategory("");
      setIsOpen(false);
      setToastData({ message: "تم إضافة العنصر بنجاح", type: "success" });
    });
  };

  return (
    <>
      <Button onClick={() => setIsOpen(true)} className="w-full gap-2">
        <Plus className="h-4 w-4" />
        إضافة عنصر جديد
      </Button>

      {toastData ? (
        <Toast
          message={toastData.message}
          type={toastData.type}
          onClose={() => setToastData(null)}
          position="top"
        />
      ) : null}

      <BottomSheet
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={`إضافة عنصر جديد - ${activeTabLabel}`}
      >
        <div className="space-y-4 pb-2">
          <p className="text-sm text-brand-muted">{activeTabDescription}</p>
          <form action={action} encType="multipart/form-data" className="grid gap-4 md:grid-cols-2">
            <input type="hidden" name="source" value={source} />
            <input type="hidden" name="is_active" value="true" />
            
            <label className="space-y-1 md:col-span-2">
              <span className="text-sm font-medium text-brand-text">اسم المنتج</span>
              <input
                name="name"
                required
                className="h-10 w-full rounded-md border border-brand-border px-3 text-sm"
              />
            </label>
            
            <Combobox
              name="category"
              label="التصنيف"
              options={categoryNames}
              value={category}
              onValueChange={setCategory}
              allowCustomValue={false}
              wrapperClassName="md:col-span-2"
              inputClassName="h-10 px-3 text-sm"
              placeholder="اكتب للبحث في التصنيفات"
              required
            />
            
            <label className="space-y-1">
              <span className="text-sm font-medium text-brand-text">السعر</span>
              <input
                name="price"
                type="number"
                min="0"
                step="0.01"
                className="h-10 w-full rounded-md border border-brand-border px-3 text-sm"
              />
            </label>
            
            <label className="space-y-1">
              <span className="text-sm font-medium text-brand-text">العملة</span>
              <input
                name="currency"
                defaultValue="EGP"
                maxLength={3}
                className="h-10 w-full rounded-md border border-brand-border px-3 text-sm"
              />
            </label>
            
            <label className="space-y-1 md:col-span-2">
              <span className="text-sm font-medium text-brand-text">رقم خارجي</span>
              <input
                name="external_id"
                className="h-10 w-full rounded-md border border-brand-border px-3 text-sm"
              />
            </label>
            
            <label className="space-y-1 md:col-span-2">
              <span className="text-sm font-medium text-brand-text">رابط الصورة</span>
              <input
                name="image_url"
                className="h-10 w-full rounded-md border border-brand-border px-3 text-sm"
              />
            </label>
            
            <label className="space-y-1 md:col-span-2">
              <span className="text-sm font-medium text-brand-text">رفع صورة</span>
              <input
                name="file"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                className="block h-10 w-full rounded-md border border-brand-border bg-white px-3 py-1.5 text-sm text-brand-text file:ms-3 file:rounded-md file:border-0 file:bg-brand-primary file:px-3 file:py-1 file:text-sm file:font-semibold file:text-white"
              />
            </label>
            
            <label className="flex items-center gap-2 text-sm font-medium text-brand-text">
              <input
                name="is_essential"
                type="checkbox"
                className="h-4 w-4 rounded border-brand-border"
              />
              أساسي
            </label>
            
            <label className="space-y-1">
              <span className="text-sm font-medium text-brand-text">الترتيب</span>
              <input
                name="essential_sort_order"
                type="number"
                step="1"
                className="h-10 w-full rounded-md border border-brand-border px-3 text-sm"
              />
            </label>
            
            <div className="md:col-span-2 pt-2">
              <Button type="submit" disabled={isPending} className="w-full">
                {isPending ? "جاري الإضافة..." : "إضافة"}
              </Button>
            </div>
          </form>
        </div>
      </BottomSheet>
    </>
  );
}
