import type { ProductOrderMode } from "@/types/models/product";
import {
  ORDER_MODE_PRICE,
  ORDER_MODE_QUANTITY,
  ORDER_MODE_WEIGHT,
} from "../_utils/product-onboarding.constants";

type OrderModeFieldsProps = {
  orderMode: ProductOrderMode;
  onOrderModeChange: (mode: ProductOrderMode) => void;
  unitLabel: string;
  onUnitLabelChange: (value: string) => void;
  secondaryUnitLabel: string;
  onSecondaryUnitLabelChange: (value: string) => void;
  secondaryUnitMultiplier: string;
  onSecondaryUnitMultiplierChange: (value: string) => void;
  weightPresets: string;
  onWeightPresetsChange: (value: string) => void;
  pricePresets: string;
  onPricePresetsChange: (value: string) => void;
  storeType?: string;
};

export default function OrderModeFields({
  orderMode,
  onOrderModeChange,
  unitLabel,
  onUnitLabelChange,
  secondaryUnitLabel,
  onSecondaryUnitLabelChange,
  secondaryUnitMultiplier,
  onSecondaryUnitMultiplierChange,
  weightPresets,
  onWeightPresetsChange,
  pricePresets,
  onPricePresetsChange,
  storeType,
}: OrderModeFieldsProps) {
  return (
    <div className="space-y-2 rounded-xl border border-gray-200 p-3">
      <span className="block text-sm text-gray-700">طريقة الطلب</span>
      {storeType !== "pharmacy" && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => onOrderModeChange(ORDER_MODE_QUANTITY)}
              className={`rounded-lg px-2 py-2 text-xs font-semibold ${
                orderMode === ORDER_MODE_QUANTITY
                  ? "bg-brand-primary text-white"
                  : "border border-gray-300 text-gray-700"
              }`}
            >
              بالعدد
            </button>
            <button
              type="button"
              onClick={() => onOrderModeChange(ORDER_MODE_WEIGHT)}
              className={`rounded-lg px-2 py-2 text-xs font-semibold ${
                orderMode === ORDER_MODE_WEIGHT
                  ? "bg-brand-primary text-white"
                  : "border border-gray-300 text-gray-700"
              }`}
            >
              بالوزن
            </button>
            <button
              type="button"
              onClick={() => onOrderModeChange(ORDER_MODE_PRICE)}
              className={`rounded-lg px-2 py-2 text-xs font-semibold ${
                orderMode === ORDER_MODE_PRICE
                  ? "bg-brand-primary text-white"
                  : "border border-gray-300 text-gray-700"
              }`}
            >
              بالمبلغ
            </button>
          </div>
        </>
      )}

      {orderMode === ORDER_MODE_QUANTITY && (
        <div className="space-y-2">
          <input
            value={unitLabel}
            onChange={(event) => onUnitLabelChange(event.target.value)}
            placeholder="اسم الوحدة الأساسية (مثال: بيضة)"
            className="w-full rounded-md border border-brand-border px-3 py-2 text-sm focus:border-brand-accent focus:outline-none focus:ring-4 focus:ring-brand-accent/15"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              value={secondaryUnitLabel}
              onChange={(event) =>
                onSecondaryUnitLabelChange(event.target.value)
              }
              placeholder="وحدة إضافية (مثال: كرتونة)"
              className="w-full rounded-md border border-brand-border px-3 py-2 text-sm focus:border-brand-accent focus:outline-none focus:ring-4 focus:ring-brand-accent/15"
            />
            <input
              value={secondaryUnitMultiplier}
              onChange={(event) =>
                onSecondaryUnitMultiplierChange(event.target.value)
              }
              inputMode="decimal"
              placeholder="المضاعف (مثال: 30)"
              className="w-full rounded-md border border-brand-border px-3 py-2 text-sm focus:border-brand-accent focus:outline-none focus:ring-4 focus:ring-brand-accent/15"
            />
          </div>
        </div>
      )}

      {orderMode === ORDER_MODE_WEIGHT && (
        <input
          value={weightPresets}
          onChange={(event) => onWeightPresetsChange(event.target.value)}
          placeholder="أوزان جاهزة بالجرام (مثال: 250,500,1000)"
          className="w-full rounded-md border border-brand-border px-3 py-2 text-sm focus:border-brand-accent focus:outline-none focus:ring-4 focus:ring-brand-accent/15"
        />
      )}

      {orderMode === ORDER_MODE_PRICE && (
        <input
          value={pricePresets}
          onChange={(event) => onPricePresetsChange(event.target.value)}
          placeholder="مبالغ جاهزة (مثال: 100,200,300)"
          className="w-full rounded-md border border-brand-border px-3 py-2 text-sm focus:border-brand-accent focus:outline-none focus:ring-4 focus:ring-brand-accent/15"
        />
      )}
    </div>
  );
}
