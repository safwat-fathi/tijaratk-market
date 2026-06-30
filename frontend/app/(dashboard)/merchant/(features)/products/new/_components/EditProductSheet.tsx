import type { ChangeEvent, FormEvent } from "react";
import BottomSheet from "@/components/ui/BottomSheet";
import ImageThumbnail from "@/components/ui/ImageThumbnail";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import type { Product, ProductOrderMode } from "@/types/models/product";
import type { CategoryMode } from "../_utils/product-onboarding.types";
import { resolveImageUrl } from "../_utils/product-onboarding";
import CategoryFields from "./CategoryFields";
import OrderModeFields from "./OrderModeFields";

type EditProductSheetProps = {
  editingProduct: Product | null;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  isEditPending: boolean;
  editName: string;
  onEditNameChange: (value: string) => void;
  editPrice: string;
  onEditPriceChange: (value: string) => void;
  editIsAvailable: boolean;
  onEditIsAvailableChange: (value: boolean) => void;
  editOrderMode: ProductOrderMode;
  onEditOrderModeChange: (mode: ProductOrderMode) => void;
  editUnitLabel: string;
  onEditUnitLabelChange: (value: string) => void;
  editSecondaryUnitLabel: string;
  onEditSecondaryUnitLabelChange: (value: string) => void;
  editSecondaryUnitMultiplier: string;
  onEditSecondaryUnitMultiplierChange: (value: string) => void;
  editWeightPresets: string;
  onEditWeightPresetsChange: (value: string) => void;
  editPricePresets: string;
  onEditPricePresetsChange: (value: string) => void;
  editCategoryMode: CategoryMode;
  onEditCategoryModeChange: (mode: CategoryMode) => void;
  editCategorySelect: string;
  onEditCategorySelectChange: (value: string) => void;
  editCategoryCustom: string;
  onEditCategoryCustomChange: (value: string) => void;
  availableProductCategories: string[];
  editImagePreview: string | null;
  editImageError?: string | null;
  onEditImageChange: (event: ChangeEvent<HTMLInputElement>) => void;
  storeType?: string;
};

export default function EditProductSheet({
  editingProduct,
  onClose,
  onSubmit,
  isEditPending,
  editName,
  onEditNameChange,
  editPrice,
  onEditPriceChange,
  editIsAvailable,
  onEditIsAvailableChange,
  editOrderMode,
  onEditOrderModeChange,
  editUnitLabel,
  onEditUnitLabelChange,
  editSecondaryUnitLabel,
  onEditSecondaryUnitLabelChange,
  editSecondaryUnitMultiplier,
  onEditSecondaryUnitMultiplierChange,
  editWeightPresets,
  onEditWeightPresetsChange,
  editPricePresets,
  onEditPricePresetsChange,
  editCategoryMode,
  onEditCategoryModeChange,
  editCategorySelect,
  onEditCategorySelectChange,
  editCategoryCustom,
  onEditCategoryCustomChange,
  availableProductCategories,
  editImagePreview,
  editImageError,
  onEditImageChange,
  storeType,
}: EditProductSheetProps) {
  const currentImageUrl = editingProduct
    ? editImagePreview || resolveImageUrl(editingProduct.image_url)
    : null;
  const imageActionLabel = currentImageUrl ? "تغيير الصورة" : "إضافة صورة";

  return (
    <BottomSheet
      isOpen={Boolean(editingProduct)}
      title="تعديل المنتج"
      onClose={onClose}
      footer={
        editingProduct ? (
          <Button
            type="submit"
            form="edit-product-form"
            disabled={isEditPending}
            className="w-full"
          >
            {isEditPending ? "جاري الحفظ…" : "حفظ التعديل"}
          </Button>
        ) : undefined
      }
    >
      {editingProduct ? (
        <form id="edit-product-form" onSubmit={onSubmit} className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm text-brand-text">اسم المنتج</span>
            <Input
              value={editName}
              onChange={(event) => onEditNameChange(event.target.value)}
              className="text-sm"
            />
          </label>

          <label className="block rounded-md border border-dashed border-brand-border bg-brand-soft/40 p-3 transition hover:border-brand-accent">
            <span className="mb-2 block text-sm font-semibold text-brand-text">
              صورة المنتج
            </span>
            <span className="inline-flex cursor-pointer items-center justify-center rounded-md bg-white px-4 py-2 text-sm font-semibold text-brand-primary shadow-sm ring-1 ring-brand-border transition hover:bg-brand-soft">
              {imageActionLabel}
            </span>
            <span className="mt-2 block text-xs text-muted-foreground">
              JPG أو PNG أو WEBP أو HEIC حتى 15 ميجابايت.
            </span>
            <input
              type="file"
              accept="image/*,.jpg,.jpeg,.png,.webp,.heic,.heif"
              onChange={onEditImageChange}
              className="sr-only"
            />
            {editImageError ? (
              <span className="mt-1 block text-xs text-status-error">
                {editImageError}
              </span>
            ) : null}
          </label>

          <label className="block">
            <span className="mb-1 block text-sm text-brand-text">السعر (اختياري)</span>
            <Input
              value={editPrice}
              onChange={(event) => onEditPriceChange(event.target.value)}
              inputMode="decimal"
              placeholder="مثال: 45.50"
              className="text-sm"
            />
          </label>

          <label className="flex items-center justify-between rounded-md border border-brand-border px-3 py-2">
            <div>
              <span className="block text-sm font-semibold text-brand-text">متاح للبيع</span>
              <span className="block text-xs text-muted-foreground">
                المنتج غير المتاح سيبقى ظاهرًا لك للإدارة.
              </span>
            </div>
            <input
              type="checkbox"
              checked={editIsAvailable}
              onChange={(event) => onEditIsAvailableChange(event.target.checked)}
              className="h-5 w-5 accent-brand-primary"
            />
          </label>

          <OrderModeFields
            orderMode={editOrderMode}
            onOrderModeChange={onEditOrderModeChange}
            unitLabel={editUnitLabel}
            onUnitLabelChange={onEditUnitLabelChange}
            secondaryUnitLabel={editSecondaryUnitLabel}
            onSecondaryUnitLabelChange={onEditSecondaryUnitLabelChange}
            secondaryUnitMultiplier={editSecondaryUnitMultiplier}
            onSecondaryUnitMultiplierChange={onEditSecondaryUnitMultiplierChange}
            weightPresets={editWeightPresets}
            onWeightPresetsChange={onEditWeightPresetsChange}
            pricePresets={editPricePresets}
            onPricePresetsChange={onEditPricePresetsChange}
            storeType={storeType}
          />

          <CategoryFields
            categoryMode={editCategoryMode}
            onCategoryModeChange={onEditCategoryModeChange}
            categorySelect={editCategorySelect}
            onCategorySelectChange={onEditCategorySelectChange}
            categoryCustom={editCategoryCustom}
            onCategoryCustomChange={onEditCategoryCustomChange}
            availableCategories={availableProductCategories}
          />

          <div className="rounded-md border border-dashed border-brand-border p-3">
            <p className="mb-2 text-xs text-muted-foreground">معاينة الصورة</p>
            {currentImageUrl ? (
              <ImageThumbnail
                src={currentImageUrl}
                alt={editingProduct.name}
                width={96}
                height={96}
                unoptimized
                imageClassName="h-24 w-24 rounded-md border border-brand-border bg-brand-soft object-cover"
                fallback={
                  <div className="flex h-24 w-24 items-center justify-center rounded-md border border-brand-border bg-brand-soft text-xs text-muted-foreground">
                    لا توجد صورة
                  </div>
                }
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-md border border-brand-border bg-brand-soft text-xs text-muted-foreground">
                لا توجد صورة
              </div>
            )}
          </div>

        </form>
      ) : null}
    </BottomSheet>
  );
}
