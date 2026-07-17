"use client";

import { Check, ChevronDown, MapPin, Search } from "lucide-react";
import { useMemo, useState } from "react";
import BottomSheet from "@/components/ui/BottomSheet";
import { formatCurrency } from "@/lib/utils/currency";
import type { TenantDeliveryArea } from "@/types/models/tenant";

type DeliveryAreaSelectorProps = {
  areas: TenantDeliveryArea[];
  selectedAreaId?: number;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (areaId: number) => void;
};

export default function DeliveryAreaSelector({
  areas,
  selectedAreaId,
  isOpen,
  onOpenChange,
  onSelect,
}: DeliveryAreaSelectorProps) {
  const [search, setSearch] = useState("");
  const selectedArea = areas.find((area) => area.area_id === selectedAreaId);
  const filteredAreas = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase("ar");
    if (!normalized) return areas;
    return areas.filter((deliveryArea) => {
      const area = deliveryArea.area;
      return [area?.name_ar, area?.name_en, area?.city, area?.governorate]
        .filter(Boolean)
        .some((value) =>
          String(value).toLocaleLowerCase("ar").includes(normalized),
        );
    });
  }, [areas, search]);

  return (
    <>
      <div className="px-4 pt-4" data-customer-tour="delivery-area">
        <button
          type="button"
          onClick={() => onOpenChange(true)}
          className={`flex min-h-14 w-full items-center gap-3 rounded-xl border px-4 py-3 text-right transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/20 ${
            selectedArea
              ? "border-brand-primary/25 bg-brand-soft/55"
              : "border-amber-200 bg-amber-50"
          }`}
          aria-haspopup="dialog"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-brand-primary shadow-sm">
            <MapPin className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold text-muted-foreground">
              منطقة التوصيل
            </span>
            <span className="mt-0.5 block text-sm font-bold text-brand-text">
              {selectedArea?.area?.name_ar ||
                "حدد منطقتك لمعرفة رسوم التوصيل"}
            </span>
            {selectedArea ? (
              <span className="mt-0.5 block text-xs font-semibold text-brand-primary">
                رسوم التوصيل:{" "}
                {Number(selectedArea.delivery_fee) > 0
                  ? formatCurrency(Number(selectedArea.delivery_fee))
                  : "مجاني"}
              </span>
            ) : null}
          </span>
          <ChevronDown
            className="h-5 w-5 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
        </button>
        <p className="mt-2 px-1 text-xs leading-5 text-muted-foreground">
          اختار منطقتك الفعلية أو أقرب منطقة متاحة لعنوانك لحساب التوصيل بشكل
          صحيح.
        </p>
      </div>

      <BottomSheet
        isOpen={isOpen}
        onClose={() => onOpenChange(false)}
        title="اختر منطقة التوصيل"
      >
        <div className="space-y-4">
          {areas.length > 5 ? (
            <label className="relative block">
              <Search
                className="pointer-events-none absolute inset-y-0 start-3 my-auto h-5 w-5 text-muted-foreground"
                aria-hidden="true"
              />
              <span className="sr-only">ابحث عن منطقة</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="ابحث عن منطقتك"
                className="min-h-12 w-full rounded-xl border border-brand-border bg-brand-soft/35 px-11 text-base focus:border-brand-accent focus:outline-none focus:ring-4 focus:ring-brand-accent/20"
              />
            </label>
          ) : null}

          <div
            className="space-y-3"
            role="radiogroup"
            aria-label="مناطق التوصيل المتاحة"
          >
            {filteredAreas.map((deliveryArea) => {
              const isSelected =
                deliveryArea.area_id === selectedAreaId;
              return (
                <button
                  key={deliveryArea.area_id}
                  type="button"
                  onClick={() => {
                    onSelect(deliveryArea.area_id);
                    onOpenChange(false);
                  }}
                  role="radio"
                  aria-checked={isSelected}
                  className={`flex min-h-16 w-full items-center gap-3 rounded-xl border p-4 text-right transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/20 ${
                    isSelected
                      ? "border-brand-primary bg-brand-soft/65"
                      : "border-brand-border bg-white hover:border-brand-accent"
                  }`}
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                      isSelected
                        ? "bg-brand-primary text-white"
                        : "bg-brand-soft text-brand-primary"
                    }`}
                  >
                    {isSelected ? (
                      <Check className="h-5 w-5" aria-hidden="true" />
                    ) : (
                      <MapPin className="h-5 w-5" aria-hidden="true" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-brand-text">
                      {deliveryArea.area?.name_ar}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {[deliveryArea.area?.city, deliveryArea.area?.governorate]
                        .filter(Boolean)
                        .join(" - ")}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-black tabular-nums text-brand-primary">
                    {Number(deliveryArea.delivery_fee) > 0
                      ? formatCurrency(Number(deliveryArea.delivery_fee))
                      : "مجاني"}
                  </span>
                </button>
              );
            })}
          </div>

          {filteredAreas.length === 0 ? (
            <p className="rounded-xl border border-dashed border-brand-border p-5 text-center text-sm text-muted-foreground">
              لا توجد منطقة مطابقة للبحث.
            </p>
          ) : null}
        </div>
      </BottomSheet>
    </>
  );
}
