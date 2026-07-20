"use client";

import { Clock3, MapPin, ReceiptText } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import {
  excludePrimaryAreaFromDeliveryAreas,
  normalizeDeliveryConfiguration,
} from "@/lib/delivery-configuration";
import type {
  DeliveryConfigurationInput,
  DirectoryArea,
} from "@/types/models/tenant";

const DELIVERY_TIME_PRESETS = [
  { label: "طوال اليوم", start: "", end: "" },
  { label: "10 ص - 10 م", start: "10:00", end: "22:00" },
  { label: "10 ص - 2 م", start: "10:00", end: "14:00" },
  { label: "2 م - 6 م", start: "14:00", end: "18:00" },
  { label: "6 م - 10 م", start: "18:00", end: "22:00" },
] as const;

type DeliveryConfigurationEditorProps = {
  areas: DirectoryArea[];
  value: DeliveryConfigurationInput;
  onChange: (value: DeliveryConfigurationInput) => void;
  errors?: Record<string, string[]>;
  disabled?: boolean;
  emptyDeliveryAreasContent?: ReactNode;
};

const getAreaLabel = (area: DirectoryArea) =>
  [area.name_ar, area.city, area.name_en].filter(Boolean).join(" - ");

export default function DeliveryConfigurationEditor({
  areas,
  value,
  onChange,
  errors,
  disabled = false,
  emptyDeliveryAreasContent,
}: DeliveryConfigurationEditorProps) {
  const [bulkFee, setBulkFee] = useState("20");
  const deliveryAreas = useMemo(
    () =>
      excludePrimaryAreaFromDeliveryAreas(
        value.delivery_areas,
        value.primary_area_id,
      ),
    [value.delivery_areas, value.primary_area_id],
  );
  const selectedFees = useMemo(
    () =>
      new Map(
        deliveryAreas.map((area) => [
          area.area_id,
          area.delivery_fee,
        ]),
      ),
    [deliveryAreas],
  );
  const eligibleAreas = useMemo(
    () =>
      areas
        .filter(
          (area) =>
            area.is_active &&
            area.parent_area_id === value.primary_area_id,
        )
        .sort(
          (left, right) =>
            left.sort_order - right.sort_order ||
            left.name_ar.localeCompare(right.name_ar, "ar"),
        ),
    [areas, value.primary_area_id],
  );
  const primaryAreas = useMemo(
    () =>
      areas
        .filter(
          (area) => area.is_active && area.parent_area_id === null,
        )
        .sort(
          (left, right) =>
            left.sort_order - right.sort_order ||
            left.name_ar.localeCompare(right.name_ar, "ar"),
        ),
    [areas],
  );
  const fees = deliveryAreas.map((area) => area.delivery_fee);
  const minimumFee = fees.length > 0 ? Math.min(...fees) : 0;
  const maximumFee = fees.length > 0 ? Math.max(...fees) : 0;

  const update = (patch: Partial<DeliveryConfigurationInput>) => {
    onChange(normalizeDeliveryConfiguration({ ...value, ...patch }));
  };

  const handlePrimaryAreaChange = (primaryAreaId: number) => {
    const allowedIds = new Set(
      areas
        .filter((area) => area.parent_area_id === primaryAreaId)
        .map((area) => area.id),
    );
    const retainedAreas = deliveryAreas.filter((area) =>
      allowedIds.has(area.area_id),
    );

    update({
      primary_area_id: primaryAreaId,
      delivery_areas: retainedAreas,
    });
  };

  const toggleArea = (areaId: number) => {
    const existingFee = selectedFees.get(areaId);
    update({
      delivery_areas:
        existingFee === undefined
          ? [...deliveryAreas, { area_id: areaId, delivery_fee: 20 }]
          : deliveryAreas.filter((area) => area.area_id !== areaId),
    });
  };

  const updateAreaFee = (areaId: number, deliveryFee: number) => {
    update({
      delivery_areas: deliveryAreas.map((area) =>
        area.area_id === areaId
          ? { ...area, delivery_fee: deliveryFee }
          : area,
      ),
    });
  };

  const applyBulkFee = () => {
    const parsedFee = Number(bulkFee);
    if (!Number.isFinite(parsedFee) || parsedFee < 0) return;
    update({
      delivery_areas: deliveryAreas.map((area) => ({
        ...area,
        delivery_fee: parsedFee,
      })),
    });
  };

  return (
    <section
      dir="rtl"
      className="space-y-5"
      aria-labelledby="delivery-zones-title"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2
            id="delivery-zones-title"
            className="text-xl font-bold text-brand-text"
          >
            مناطق ورسوم التوصيل
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            حدد المناطق التي تخدمها والسعر المناسب لكل منطقة.
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-brand-soft px-3 py-1 text-xs font-bold text-brand-primary">
          {deliveryAreas.length} منطقة
        </span>
      </div>

      <ToggleSwitch
        name="delivery_available_control"
        label="التوصيل متاح"
        checked={value.delivery_available}
        onChange={(deliveryAvailable) =>
          update({ delivery_available: deliveryAvailable })
        }
        disabled={disabled}
        className="rounded-xl border border-brand-border bg-brand-soft/40 p-4"
        labelClassName="font-bold text-brand-text"
      />

      <div className="grid grid-cols-2 gap-3 rounded-xl border border-brand-border bg-white p-4">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">
            المناطق النشطة
          </p>
          <p className="mt-1 text-lg font-black tabular-nums text-brand-text">
            {deliveryAreas.length}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground">
            نطاق الرسوم
          </p>
          <p className="mt-1 text-sm font-black tabular-nums text-brand-text">
            {fees.length === 0
              ? "غير محدد"
              : minimumFee === maximumFee
                ? `${minimumFee} جنيه`
                : `${minimumFee} - ${maximumFee} جنيه`}
          </p>
        </div>
      </div>

      <label className="block space-y-2 text-sm font-semibold text-brand-text">
        <span className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-brand-primary" aria-hidden="true" />
          المنطقة الأساسية
        </span>
        <select
          value={value.primary_area_id || ""}
          onChange={(event) =>
            handlePrimaryAreaChange(Number(event.target.value) || 0)
          }
          disabled={disabled}
          aria-invalid={Boolean(errors?.primary_area_id)}
          aria-describedby={
            errors?.primary_area_id ? "primary-area-error" : undefined
          }
          className="min-h-12 w-full rounded-xl border border-brand-border bg-white px-4 text-base focus:border-brand-accent focus:outline-none focus:ring-4 focus:ring-brand-accent/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">اختر المنطقة الأساسية</option>
          {primaryAreas.map((area) => (
            <option key={area.id} value={area.id}>
              {getAreaLabel(area)}
            </option>
          ))}
        </select>
        {errors?.primary_area_id ? (
          <span
            id="primary-area-error"
            role="alert"
            className="block text-sm font-semibold text-status-error"
          >
            {errors.primary_area_id[0]}
          </span>
        ) : null}
      </label>

      {!value.delivery_available &&
      value.primary_area_id &&
      emptyDeliveryAreasContent
        ? emptyDeliveryAreasContent
        : null}

      {value.delivery_available ? (
        <>
          <div className="rounded-xl border border-brand-border bg-brand-soft/35 p-4">
            <div className="flex items-center gap-2">
              <ReceiptText
                className="h-5 w-5 text-brand-primary"
                aria-hidden="true"
              />
              <h3 className="text-sm font-bold text-brand-text">
                تطبيق رسوم موحدة
              </h3>
            </div>
            <div className="mt-3 flex gap-2">
              <div className="relative min-w-0 flex-1">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={bulkFee}
                  onChange={(event) => setBulkFee(event.target.value)}
                  className="min-h-11 w-full rounded-lg border border-brand-border bg-white px-3 pe-16 text-base font-bold tabular-nums focus:border-brand-accent focus:outline-none focus:ring-4 focus:ring-brand-accent/20"
                  aria-label="الرسوم الموحدة"
                />
                <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-xs font-semibold text-muted-foreground">
                  جنيه
                </span>
              </div>
              <button
                type="button"
                onClick={applyBulkFee}
                disabled={disabled || deliveryAreas.length === 0}
                className="min-h-11 shrink-0 rounded-lg border border-brand-primary px-4 text-sm font-bold text-brand-primary transition-colors hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/20"
              >
                تطبيق على الكل
              </button>
            </div>
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-bold text-brand-text">
              مناطق التوصيل
            </legend>
            {eligibleAreas.length > 0 ? (
              <div className="space-y-3">
                {eligibleAreas.map((area) => {
                  const fee = selectedFees.get(area.id);
                  const isSelected = fee !== undefined;
                  return (
                    <div
                      key={area.id}
                      className={`rounded-xl border p-4 transition-colors ${
                        isSelected
                          ? "border-brand-primary/30 bg-brand-soft/45"
                          : "border-brand-border bg-white"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          id={`delivery-area-${area.id}`}
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleArea(area.id)}
                          disabled={disabled}
                          className="mt-1 h-5 w-5 shrink-0 rounded border-brand-border accent-brand-primary"
                        />
                        <label
                          htmlFor={`delivery-area-${area.id}`}
                          className="min-h-11 min-w-0 flex-1 cursor-pointer"
                        >
                          <span className="block text-sm font-bold text-brand-text">
                            {area.name_ar}
                          </span>
                          <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                            {[area.city, area.governorate]
                              .filter(Boolean)
                              .join(" - ") || "ضمن نطاق المتجر"}
                          </span>
                        </label>
                      </div>
                      {isSelected ? (
                        <label className="mt-3 block space-y-2 text-xs font-semibold text-muted-foreground">
                          رسوم التوصيل
                          <div className="relative">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              inputMode="decimal"
                              value={fee}
                              onChange={(event) =>
                                updateAreaFee(
                                  area.id,
                                  Math.max(0, Number(event.target.value) || 0),
                                )
                              }
                              disabled={disabled}
                              className="min-h-11 w-full rounded-lg border border-brand-border bg-white px-3 pe-16 text-base font-bold tabular-nums text-brand-text focus:border-brand-accent focus:outline-none focus:ring-4 focus:ring-brand-accent/20"
                            />
                            <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-xs font-semibold text-muted-foreground">
                              جنيه
                            </span>
                          </div>
                        </label>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              value.primary_area_id && emptyDeliveryAreasContent ? (
                emptyDeliveryAreasContent
              ) : (
                <p className="rounded-xl border border-dashed border-brand-border bg-brand-soft/30 p-4 text-sm leading-6 text-muted-foreground">
                  {value.primary_area_id
                    ? "لا توجد مناطق توصيل فرعية متاحة ضمن المنطقة الأساسية."
                    : "اختر المنطقة الأساسية لعرض مناطق التوصيل المتاحة."}
                </p>
              )
            )}
          </fieldset>

          <div className="space-y-4 rounded-xl border border-brand-border bg-white p-4">
            <div className="flex items-center gap-2">
              <Clock3
                className="h-5 w-5 text-brand-primary"
                aria-hidden="true"
              />
              <h3 className="text-sm font-bold text-brand-text">
                مواعيد التوصيل
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-2 text-xs font-semibold text-muted-foreground">
                من الساعة
                <input
                  type="time"
                  value={value.delivery_starts_at || ""}
                  onChange={(event) =>
                    update({
                      delivery_starts_at: event.target.value || null,
                    })
                  }
                  disabled={disabled}
                  className="min-h-11 w-full rounded-lg border border-brand-border px-3 text-base text-brand-text focus:border-brand-accent focus:outline-none focus:ring-4 focus:ring-brand-accent/20"
                />
              </label>
              <label className="space-y-2 text-xs font-semibold text-muted-foreground">
                إلى الساعة
                <input
                  type="time"
                  value={value.delivery_ends_at || ""}
                  onChange={(event) =>
                    update({ delivery_ends_at: event.target.value || null })
                  }
                  disabled={disabled}
                  className="min-h-11 w-full rounded-lg border border-brand-border px-3 text-base text-brand-text focus:border-brand-accent focus:outline-none focus:ring-4 focus:ring-brand-accent/20"
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              {DELIVERY_TIME_PRESETS.map((preset) => {
                const isActive =
                  (value.delivery_starts_at || "") === preset.start &&
                  (value.delivery_ends_at || "") === preset.end;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() =>
                      update({
                        delivery_starts_at: preset.start || null,
                        delivery_ends_at: preset.end || null,
                      })
                    }
                    disabled={disabled}
                    className={`min-h-11 rounded-lg border px-3 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/20 ${
                      isActive
                        ? "border-brand-primary bg-brand-soft text-brand-primary"
                        : "border-brand-border bg-white text-brand-text hover:border-brand-accent"
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        <p className="rounded-xl border border-brand-border bg-brand-soft/35 p-4 text-sm leading-6 text-muted-foreground">
          إعدادات المناطق محفوظة. أعد تفعيل التوصيل لتعديل الرسوم والمواعيد.
        </p>
      )}

      {errors?.delivery_configuration ? (
        <p role="alert" className="text-sm font-semibold text-status-error">
          {errors.delivery_configuration[0]}
        </p>
      ) : null}
      {errors?.delivery_areas ? (
        <p role="alert" className="text-sm font-semibold text-status-error">
          {errors.delivery_areas[0]}
        </p>
      ) : null}
    </section>
  );
}
