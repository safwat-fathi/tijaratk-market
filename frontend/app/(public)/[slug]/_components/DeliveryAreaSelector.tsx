"use client";

import { Check, ChevronDown, MapPin, Search } from "lucide-react";
import { useMemo, useState } from "react";
import BottomSheet from "@/components/ui/BottomSheet";
import {
  normalizeAreaSearchValue,
  prepareAreaSearchOptions,
  rankPreparedAreaSearchOptions,
} from "@/lib/stores-directory/area-search";
import { describeZoneDeliveryFee } from "@/lib/delivery-configuration";
import { cn } from "@/lib/utils";
import type {
  DirectoryArea,
  TenantDeliveryArea,
} from "@/types/models/tenant";

type DeliveryAreaSelectorProps = {
  areas: TenantDeliveryArea[];
  selectedAreaId?: number;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (areaId: number) => void;
  containerClassName?: string;
  showHelpText?: boolean;
};

type MainAreaSummary = NonNullable<DirectoryArea["parent_area"]>;

type DeliveryAreaGroup = {
  mainArea: MainAreaSummary;
  deliveryAreas: TenantDeliveryArea[];
};

type SearchableDeliveryArea = {
  name: string;
  nameEn?: string | null;
  slug: string;
  deliveryArea: TenantDeliveryArea;
};

type SearchableMainArea = {
  name: string;
  nameEn?: string | null;
  slug: string;
  mainAreaId: number;
};

const buildDeliveryAreaGroups = (
  areas: TenantDeliveryArea[],
): DeliveryAreaGroup[] => {
  const groupsByMainAreaId = new Map<number, DeliveryAreaGroup>();

  for (const deliveryArea of areas) {
    const area = deliveryArea.area;
    const mainArea = area?.parent_area;
    if (!area || area.parent_area_id === null || !mainArea) continue;

    const existingGroup = groupsByMainAreaId.get(mainArea.id);
    if (existingGroup) {
      existingGroup.deliveryAreas.push(deliveryArea);
      continue;
    }

    groupsByMainAreaId.set(mainArea.id, {
      mainArea,
      deliveryAreas: [deliveryArea],
    });
  }

  return Array.from(groupsByMainAreaId.values());
};

export default function DeliveryAreaSelector({
  areas,
  selectedAreaId,
  isOpen,
  onOpenChange,
  onSelect,
  containerClassName,
  showHelpText = true,
}: DeliveryAreaSelectorProps) {
  const [search, setSearch] = useState("");
  const groups = useMemo(() => buildDeliveryAreaGroups(areas), [areas]);
  const selectableAreas = useMemo(
    () => groups.flatMap((group) => group.deliveryAreas),
    [groups],
  );
  const hasSelectableAreas = selectableAreas.length > 0;
  const selectedArea = selectableAreas.find(
    (area) => area.area_id === selectedAreaId,
  );
  const selectedAreaFee = selectedArea
    ? describeZoneDeliveryFee(selectedArea)
    : null;
  const normalizedSearch = normalizeAreaSearchValue(search);

  const filteredGroups = useMemo(() => {
    if (!normalizedSearch) return groups;

    const searchableMainAreas: SearchableMainArea[] = groups.map((group) => ({
      name: group.mainArea.name_ar,
      nameEn: group.mainArea.name_en,
      slug: group.mainArea.slug,
      mainAreaId: group.mainArea.id,
    }));
    const matchingMainAreaIds = new Set(
      rankPreparedAreaSearchOptions(
        prepareAreaSearchOptions(searchableMainAreas),
        normalizedSearch,
        searchableMainAreas.length,
      ).map((area) => area.mainAreaId),
    );

    const searchableDeliveryAreas: SearchableDeliveryArea[] =
      selectableAreas.map((deliveryArea) => ({
        name: deliveryArea.area?.name_ar || "",
        nameEn: deliveryArea.area?.name_en,
        slug: deliveryArea.area?.slug || "",
        deliveryArea,
      }));
    const matchingDeliveryAreaIds = new Set(
      rankPreparedAreaSearchOptions(
        prepareAreaSearchOptions(searchableDeliveryAreas),
        normalizedSearch,
        searchableDeliveryAreas.length,
      ).map((area) => area.deliveryArea.area_id),
    );

    return groups
      .map((group) => ({
        ...group,
        deliveryAreas: matchingMainAreaIds.has(group.mainArea.id)
          ? group.deliveryAreas
          : group.deliveryAreas.filter((deliveryArea) =>
              matchingDeliveryAreaIds.has(deliveryArea.area_id),
            ),
      }))
      .filter((group) => group.deliveryAreas.length > 0);
  }, [groups, normalizedSearch, selectableAreas]);

  const closeSelector = () => {
    setSearch("");
    onOpenChange(false);
  };

  return (
    <>
      <div
        className={cn("px-4 pt-4", containerClassName)}
        data-customer-tour="delivery-area"
      >
        <button
          type="button"
          onClick={() => {
            setSearch("");
            onOpenChange(true);
          }}
          disabled={!hasSelectableAreas}
          className={cn(
            "flex min-h-14 w-full items-center gap-3 rounded-xl border px-4 py-3 text-right transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/20",
            selectedArea
              ? "border-brand-primary/25 bg-brand-soft/55"
              : "border-amber-200 bg-amber-50",
            !hasSelectableAreas && "cursor-not-allowed opacity-70",
          )}
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
                (hasSelectableAreas
                  ? "حدد منطقتك لمعرفة رسوم التوصيل"
                  : "لا توجد مناطق توصيل متاحة حالياً")}
            </span>
            {selectedArea?.area?.parent_area ? (
              <span className="mt-0.5 block text-xs text-muted-foreground">
                ضمن: {selectedArea.area.parent_area.name_ar}
              </span>
            ) : null}
            {selectedArea ? (
              <span className="mt-0.5 block text-xs font-semibold text-brand-primary">
                رسوم التوصيل: {selectedAreaFee?.label}
                {selectedAreaFee?.hint ? ` (${selectedAreaFee.hint})` : ""}
              </span>
            ) : null}
          </span>
          <ChevronDown
            className="h-5 w-5 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
        </button>
        {showHelpText ? (
          <p className="mt-2 px-1 text-xs leading-5 text-muted-foreground">
            اختار منطقتك الفعلية أو أقرب منطقة متاحة لعنوانك لحساب التوصيل
            بشكل صحيح.
          </p>
        ) : null}
      </div>

      <BottomSheet
        isOpen={isOpen}
        onClose={closeSelector}
        title="اختر منطقة التوصيل"
        desktopDialog
        className="sm:max-w-lg"
      >
        <div className="space-y-4">
          <label className="relative block">
            <Search
              className="pointer-events-none absolute inset-y-0 start-3 my-auto h-5 w-5 text-muted-foreground"
              aria-hidden="true"
            />
            <span className="sr-only">ابحث عن منطقة توصيل</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ابحث باسم منطقتك أو المنطقة الرئيسية"
              className="min-h-12 w-full rounded-xl border border-brand-border bg-brand-soft/35 px-11 text-base focus:border-brand-accent focus:outline-none focus:ring-4 focus:ring-brand-accent/20"
              autoComplete="off"
            />
          </label>

          <div
            className="space-y-4"
            role="radiogroup"
            aria-label="مناطق التوصيل المتاحة"
          >
            {filteredGroups.map((group) => (
              <section
                key={group.mainArea.id}
                className="overflow-hidden rounded-xl border border-brand-border bg-white"
                aria-labelledby={`delivery-main-area-${group.mainArea.id}`}
              >
                <div className="flex min-h-12 items-center justify-between gap-3 border-b border-brand-border/70 bg-brand-soft/35 px-4 py-2.5">
                  <div className="min-w-0">
                    <p
                      id={`delivery-main-area-${group.mainArea.id}`}
                      className="truncate text-sm font-black text-brand-text"
                    >
                      {group.mainArea.name_ar}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      المنطقة الرئيسية
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-bold text-brand-primary shadow-sm">
                    {group.deliveryAreas.length} منطقة
                  </span>
                </div>

                <div className="divide-y divide-brand-border/60">
                  {group.deliveryAreas.map((deliveryArea) => {
                    const isSelected =
                      deliveryArea.area_id === selectedAreaId;

                    return (
                      <button
                        key={deliveryArea.area_id}
                        type="button"
                        onClick={() => {
                          onSelect(deliveryArea.area_id);
                          closeSelector();
                        }}
                        role="radio"
                        aria-checked={isSelected}
                        className={cn(
                          "flex min-h-16 w-full items-center gap-3 px-4 py-3 text-right transition-colors hover:bg-brand-soft/25 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-brand-accent/20",
                          isSelected && "bg-brand-soft/45",
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2",
                            isSelected
                              ? "border-brand-primary bg-brand-primary text-white"
                              : "border-brand-border bg-white text-transparent",
                          )}
                        >
                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-bold text-brand-text">
                            {deliveryArea.area?.name_ar}
                          </span>
                        </span>
                        {(() => {
                          const fee = describeZoneDeliveryFee(deliveryArea);
                          return (
                            <span className="shrink-0 text-end">
                              <span className="block text-sm font-black tabular-nums text-brand-primary">
                                {fee.label}
                              </span>
                              {fee.hint ? (
                                <span className="mt-0.5 block text-[11px] font-semibold text-muted-foreground">
                                  {fee.hint}
                                </span>
                              ) : null}
                            </span>
                          );
                        })()}
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
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
