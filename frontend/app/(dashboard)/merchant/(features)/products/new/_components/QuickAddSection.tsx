import type { ChangeEvent, FormEvent } from 'react';
import SafeImage from '@/components/ui/SafeImage';
import type { ProductOrderMode } from '@/types/models/product';
import type { CategoryMode } from '../_utils/product-onboarding.types';
import { SECTION_QUICK_ADD } from '../_utils/product-onboarding.constants';
import CategoryFields from './CategoryFields';
import OrderModeFields from './OrderModeFields';

type QuickAddSectionProps = {
	active: boolean;
	onSubmit: (event: FormEvent<HTMLFormElement>) => void;
	onShowMyProducts: () => void;
	isPending: boolean;
	manualName: string;
	onManualNameChange: (value: string) => void;
	manualPrice: string;
	onManualPriceChange: (value: string) => void;
	manualOrderMode: ProductOrderMode;
	onManualOrderModeChange: (mode: ProductOrderMode) => void;
	manualUnitLabel: string;
	onManualUnitLabelChange: (value: string) => void;
	manualSecondaryUnitLabel: string;
	onManualSecondaryUnitLabelChange: (value: string) => void;
	manualSecondaryUnitMultiplier: string;
	onManualSecondaryUnitMultiplierChange: (value: string) => void;
	manualWeightPresets: string;
	onManualWeightPresetsChange: (value: string) => void;
	manualPricePresets: string;
	onManualPricePresetsChange: (value: string) => void;
	manualCategoryMode: CategoryMode;
	onManualCategoryModeChange: (mode: CategoryMode) => void;
	manualCategorySelect: string;
	onManualCategorySelectChange: (value: string) => void;
	manualCategoryCustom: string;
	onManualCategoryCustomChange: (value: string) => void;
	availableProductCategories: string[];
	manualImagePreview: string | null;
	manualImageError: string | null;
	onManualImageChange: (event: ChangeEvent<HTMLInputElement>) => void;
	storeType?: string;
};

export default function QuickAddSection({
	active,
	onSubmit,
	onShowMyProducts,
	isPending,
	manualName,
	onManualNameChange,
	manualPrice,
	onManualPriceChange,
	manualOrderMode,
	onManualOrderModeChange,
	manualUnitLabel,
	onManualUnitLabelChange,
	manualSecondaryUnitLabel,
	onManualSecondaryUnitLabelChange,
	manualSecondaryUnitMultiplier,
	onManualSecondaryUnitMultiplierChange,
	manualWeightPresets,
	onManualWeightPresetsChange,
	manualPricePresets,
	onManualPricePresetsChange,
	manualCategoryMode,
	onManualCategoryModeChange,
	manualCategorySelect,
	onManualCategorySelectChange,
	manualCategoryCustom,
	onManualCategoryCustomChange,
	availableProductCategories,
	manualImagePreview,
	manualImageError,
	onManualImageChange,
	storeType,
}: QuickAddSectionProps) {
	const imageActionLabel = manualImagePreview ? "تغيير الصورة" : "إضافة صورة";

	return (
		<section
			id={`section-panel-${SECTION_QUICK_ADD}`}
			role="tabpanel"
			aria-labelledby={`section-tab-${SECTION_QUICK_ADD}`}
			className={active ? "block" : "hidden"}
		>
			<div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div>
						<h2 className="text-lg font-bold text-gray-900">إضافة منتج</h2>
						<p className="mt-1 text-sm text-gray-500">
							اكتب الاسم بسرعة، ويمكنك إضافة سعر اختياري الآن أو لاحقاً من تعديل
							المنتج.
						</p>
					</div>
					<button
						type="button"
						onClick={onShowMyProducts}
						className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
					>
						عرض منتجاتك
					</button>
				</div>

				<form onSubmit={onSubmit} className="mt-4 space-y-3">
					<input
						value={manualName}
						onChange={event => onManualNameChange(event.target.value)}
						placeholder="مثال: زيت عباد الشمس"
						className="w-full rounded-md border border-brand-border px-4 py-3 text-base focus:border-brand-accent focus:outline-none focus:ring-4 focus:ring-brand-accent/15"
					/>
					<input
						value={manualPrice}
						onChange={event => onManualPriceChange(event.target.value)}
						placeholder="السعر (اختياري)"
						inputMode="decimal"
						className="w-full rounded-md border border-brand-border px-4 py-3 text-base focus:border-brand-accent focus:outline-none focus:ring-4 focus:ring-brand-accent/15"
					/>

					<label className="block rounded-md border border-dashed border-brand-border bg-brand-soft/40 p-3 transition hover:border-brand-accent">
						<span className="mb-2 block text-sm font-semibold text-brand-text">
							صورة المنتج (اختياري)
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
							onChange={onManualImageChange}
							className="sr-only"
						/>
						{manualImageError ? (
							<span className="mt-1 block text-xs text-status-error">
								{manualImageError}
							</span>
						) : null}
						{manualImagePreview ? (
							<div className="mt-3">
								<SafeImage
									src={manualImagePreview}
									alt="معاينة صورة المنتج"
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
							</div>
						) : null}
					</label>

					<OrderModeFields
						orderMode={manualOrderMode}
						onOrderModeChange={onManualOrderModeChange}
						unitLabel={manualUnitLabel}
						onUnitLabelChange={onManualUnitLabelChange}
						secondaryUnitLabel={manualSecondaryUnitLabel}
						onSecondaryUnitLabelChange={onManualSecondaryUnitLabelChange}
						secondaryUnitMultiplier={manualSecondaryUnitMultiplier}
						onSecondaryUnitMultiplierChange={
							onManualSecondaryUnitMultiplierChange
						}
						weightPresets={manualWeightPresets}
						onWeightPresetsChange={onManualWeightPresetsChange}
						pricePresets={manualPricePresets}
						onPricePresetsChange={onManualPricePresetsChange}
						storeType={storeType}
					/>

					<CategoryFields
						categoryMode={manualCategoryMode}
						onCategoryModeChange={onManualCategoryModeChange}
						categorySelect={manualCategorySelect}
						onCategorySelectChange={onManualCategorySelectChange}
						categoryCustom={manualCategoryCustom}
						onCategoryCustomChange={onManualCategoryCustomChange}
						availableCategories={availableProductCategories}
					/>

					<button
						type="submit"
						disabled={isPending}
						className="w-full rounded-md bg-brand-primary px-4 py-3 text-base font-semibold text-white disabled:opacity-60"
					>
						حفظ
					</button>
				</form>
			</div>
		</section>
	);
}
