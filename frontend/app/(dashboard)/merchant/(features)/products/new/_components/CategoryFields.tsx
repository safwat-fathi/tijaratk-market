import type { CategoryMode } from '../_utils/product-onboarding.types';
import {
  CATEGORY_MODE_CUSTOM,
  CATEGORY_MODE_SELECT,
} from '../_utils/product-onboarding.constants';
import { Combobox } from "@/components/ui/Combobox";

type CategoryFieldsProps = {
  categoryMode: CategoryMode;
  onCategoryModeChange: (mode: CategoryMode) => void;
  categorySelect: string;
  onCategorySelectChange: (value: string) => void;
  categoryCustom: string;
  onCategoryCustomChange: (value: string) => void;
  availableCategories: string[];
};

export default function CategoryFields({
  categoryMode,
  onCategoryModeChange,
  categorySelect,
  onCategorySelectChange,
  categoryCustom,
  onCategoryCustomChange,
  availableCategories,
}: CategoryFieldsProps) {
  return (
    <div className="space-y-2 rounded-xl border border-gray-200 p-3">
      <span className="block text-sm text-gray-700">تصنيف المنتج (اختياري)</span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onCategoryModeChange(CATEGORY_MODE_SELECT)}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
            categoryMode === CATEGORY_MODE_SELECT
              ? 'bg-brand-primary text-white'
              : 'border border-gray-300 text-gray-700'
          }`}
        >
          اختر من الموجود
        </button>
        <button
          type="button"
          onClick={() => onCategoryModeChange(CATEGORY_MODE_CUSTOM)}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
            categoryMode === CATEGORY_MODE_CUSTOM
              ? 'bg-brand-primary text-white'
              : 'border border-gray-300 text-gray-700'
          }`}
        >
          اكتب تصنيف جديد
        </button>
      </div>

      {categoryMode === CATEGORY_MODE_SELECT ? (
        <Combobox
          value={categorySelect}
          onChange={(event) => onCategorySelectChange(event.target.value)}
          options={availableCategories}
          placeholder="اكتب للبحث في التصنيفات"
        />
      ) : (
        <input
          value={categoryCustom}
          onChange={(event) => onCategoryCustomChange(event.target.value)}
          placeholder="مثال: منظفات"
          className="w-full rounded-md border border-brand-border px-3 py-2 text-sm focus:border-brand-accent focus:outline-none focus:ring-4 focus:ring-brand-accent/15"
        />
      )}
    </div>
  );
}
