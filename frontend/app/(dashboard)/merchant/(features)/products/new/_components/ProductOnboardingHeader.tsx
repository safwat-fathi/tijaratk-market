import { formatArabicInteger } from "@/lib/utils/number";

type ProductOnboardingHeaderProps = {
  activeSectionLabel: string;
  productsCount: number;
  onOpenBulkWizard?: () => void;
};

export default function ProductOnboardingHeader({
  activeSectionLabel,
  productsCount,
  onOpenBulkWizard,
}: ProductOnboardingHeaderProps) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-sm font-semibold text-gray-900">الإدارة السريعة للمنتجات</p>
        <p className="text-xs text-gray-500">القسم الحالي: {activeSectionLabel}</p>
      </div>
      <div className="flex items-center gap-2">
        {onOpenBulkWizard && (
          <button
            onClick={onOpenBulkWizard}
            className="rounded-full bg-brand-primary px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-brand-primary/90"
          >
            + أضف التشكيلة الأساسية
          </button>
        )}
        <div className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600">
          {formatArabicInteger(productsCount) || productsCount} منتج في متجرك
        </div>
      </div>
    </div>
  );
}
