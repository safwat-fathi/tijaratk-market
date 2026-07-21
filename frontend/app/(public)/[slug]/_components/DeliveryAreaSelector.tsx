"use client";

import { Check, ChevronDown, MapPin, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import BottomSheet from "@/components/ui/BottomSheet";
import { extractMainAreaIds } from "@/lib/delivery-configuration";
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
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
  
  const selectedArea = areas.find((area) => area.area_id === selectedAreaId);
  const searchNormalized = search.trim().toLocaleLowerCase("ar");

  const groups = useMemo(() => {
    const mainAreaIds = extractMainAreaIds(areas as any);
    const mainAreas = areas.filter(a => mainAreaIds.includes(a.area_id));
    const subAreas = areas.filter(a => !mainAreaIds.includes(a.area_id));

    return mainAreas.map(mainArea => {
      const children = subAreas.filter(a => a.area?.parent_area_id === mainArea.area_id);
      return { mainArea, children };
    }).filter(group => group.children.length > 0);
  }, [areas]);

  const filteredGroups = useMemo(() => {
    if (!searchNormalized) return groups;
    return groups.map(group => {
      const mainMatch = [group.mainArea.area?.name_ar, group.mainArea.area?.name_en]
        .filter(Boolean)
        .some(v => String(v).toLocaleLowerCase("ar").includes(searchNormalized));
      
      if (mainMatch) return group;

      const children = group.children.filter(child => {
        return [child.area?.name_ar, child.area?.name_en, child.area?.city, child.area?.governorate]
          .filter(Boolean)
          .some(v => String(v).toLocaleLowerCase("ar").includes(searchNormalized));
      });
      
      return { ...group, children };
    }).filter(g => g.children.length > 0);
  }, [groups, searchNormalized]);

  useEffect(() => {
    if (searchNormalized) {
      setExpandedGroups(new Set(filteredGroups.map(g => g.mainArea.area_id)));
    }
  }, [searchNormalized, filteredGroups]);

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

          <div className="space-y-3" role="radiogroup" aria-label="مناطق التوصيل المتاحة">
            {filteredGroups.map((group) => {
              const mainId = group.mainArea.area_id;
              const isExpanded = expandedGroups.has(mainId);
              return (
                <div key={mainId} className="rounded-xl border border-brand-border bg-white overflow-hidden transition-colors">
                  <button
                    type="button"
                    onClick={() => {
                      const next = new Set(expandedGroups);
                      if (next.has(mainId)) {
                        next.delete(mainId);
                      } else {
                        next.add(mainId);
                      }
                      setExpandedGroups(next);
                    }}
                    className="flex min-h-14 w-full items-center justify-between bg-brand-soft/20 px-4 py-3 text-right hover:bg-brand-soft/40 transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/20"
                    aria-expanded={isExpanded}
                  >
                    <span className="font-bold text-brand-text">
                      {group.mainArea.area?.name_ar}
                    </span>
                    <ChevronDown
                      className={`h-5 w-5 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      aria-hidden="true"
                    />
                  </button>
                  
                  {isExpanded && (
                    <div className="flex flex-col border-t border-brand-border divide-y divide-brand-border/50 bg-white">
                      {group.children.map((deliveryArea) => {
                        const isSelected = deliveryArea.area_id === selectedAreaId;
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
                            className={`flex min-h-16 w-full items-center gap-3 px-4 py-3 text-right transition-colors hover:bg-brand-soft/20 focus-visible:outline-none focus-visible:bg-brand-soft/20 ${
                              isSelected ? "bg-brand-soft/30" : ""
                            }`}
                          >
                            <span
                              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                                isSelected
                                  ? "border-brand-primary bg-brand-primary text-white"
                                  : "border-brand-border bg-white text-transparent"
                              }`}
                            >
                              {isSelected && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-semibold text-brand-text">
                                {deliveryArea.area?.name_ar}
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
                  )}
                </div>
              );
            })}
          </div>

          {filteredGroups.length === 0 ? (
            <p className="rounded-xl border border-dashed border-brand-border p-5 text-center text-sm text-muted-foreground">
              لا توجد منطقة مطابقة للبحث.
            </p>
          ) : null}
        </div>
      </BottomSheet>
    </>
  );
}
