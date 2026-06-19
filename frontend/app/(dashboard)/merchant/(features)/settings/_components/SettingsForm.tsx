"use client";

import type { ChangeEvent } from "react";
import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Tenant, DirectoryArea } from "@/types/models/tenant";
import { updateStoreSettingsAction } from "@/actions/tenant-actions";
import { useRef } from "react";
import { INSTAPAY_PROVIDER } from "@/constants/payment-providers";
import { WalletCards } from "lucide-react";

const DELIVERY_TIME_PRESETS = [
  { label: "طوال اليوم", start: "", end: "" },
  { label: "وردية 12 ساعة (10 ص - 10 م)", start: "10:00", end: "22:00" },
  { label: "فترة الصباح (10 ص - 2 م)", start: "10:00", end: "14:00" },
  { label: "فترة بعد الظهر (2 م - 6 م)", start: "14:00", end: "18:00" },
  { label: "فترة المساء (6 م - 10 م)", start: "18:00", end: "22:00" },
] as const;

interface SettingsFormProps {
  tenant: Tenant;
  activeAreas: DirectoryArea[];
}

export default function SettingsForm({
  tenant,
  activeAreas,
}: SettingsFormProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    updateStoreSettingsAction,
    {
      success: false,
      message: "",
      errors: undefined,
    },
  );

  // Manage checkbox state locally for conditional rendering
  const [deliveryAvailable, setDeliveryAvailable] = useState(
    tenant.delivery_available,
  );

  const deliveryStartsAtInputRef = useRef<HTMLInputElement | null>(null);
  const deliveryEndsAtInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedZones, setSelectedZones] = useState<Set<number>>(() => {
    return new Set(tenant.tenant_delivery_areas?.map((d) => d.area_id) || []);
  });
  const [selectedMainAreaId, setSelectedMainAreaId] = useState(
    tenant.directory_profile?.area_id ?? 0,
  );
  const [isZonesOpen, setIsZonesOpen] = useState(false);
  const availableDeliveryAreas = useMemo(
    () =>
      selectedMainAreaId
        ? activeAreas.filter(
            (area) =>
              area.id === selectedMainAreaId ||
              area.parent_area_id === selectedMainAreaId,
          )
        : [],
    [activeAreas, selectedMainAreaId],
  );
  const availableDeliveryAreaIds = useMemo(
    () => new Set(availableDeliveryAreas.map((area) => area.id)),
    [availableDeliveryAreas],
  );
  const selectedAvailableZonesCount = [...selectedZones].filter((areaId) =>
    availableDeliveryAreaIds.has(areaId),
  ).length;
  const deliveryZonesEmptyMessage = !selectedMainAreaId
    ? "اختر المنطقة الأساسية أولاً"
    : "لا توجد مناطق متاحة حالياً";

  const handleMainAreaChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextMainAreaId = Number(event.target.value) || 0;
    setSelectedMainAreaId(nextMainAreaId);
    setSelectedZones((prev) => {
      const allowedAreaIds = new Set(
        activeAreas
          .filter(
            (area) =>
              area.id === nextMainAreaId ||
              area.parent_area_id === nextMainAreaId,
          )
          .map((area) => area.id),
      );

      return new Set([...prev].filter((areaId) => allowedAreaIds.has(areaId)));
    });
  };

  const toggleZone = (areaId: number) => {
    setSelectedZones((prev) => {
      const next = new Set(prev);
      if (next.has(areaId)) next.delete(areaId);
      else next.add(areaId);
      return next;
    });
  };

  const [activePreset, setActivePreset] = useState<string>(() => {
    if (!tenant.delivery_starts_at && !tenant.delivery_ends_at) {
      return "طوال اليوم";
    }
    const preset = DELIVERY_TIME_PRESETS.find(
      (p) =>
        p.start === tenant.delivery_starts_at &&
        p.end === tenant.delivery_ends_at,
    );
    return preset ? preset.label : "custom";
  });

  const handleTimeChange = () => {
    const start = deliveryStartsAtInputRef.current?.value || "";
    const end = deliveryEndsAtInputRef.current?.value || "";
    if (!start && !end) {
      setActivePreset("طوال اليوم");
    } else {
      const preset = DELIVERY_TIME_PRESETS.find(
        (p) => p.start === start && p.end === end,
      );
      setActivePreset(preset ? preset.label : "custom");
    }
  };

  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [router, state.success]);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {/* General Settings Card */}
      <div className="bg-white rounded-[20px] p-4 sm:p-6 shadow-sm border border-gray-100">
        <h2 className="text-xl font-semibold text-[#0F5A3D] mb-6">
          معلومات المتجر
        </h2>

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700">
              اسم المتجر
            </label>
            <input
              name="name"
              defaultValue={tenant.name}
              type="text"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-[#F7F8F6] focus:outline-none focus:ring-2 focus:ring-[#27AE60]/50"
            />
            {state.errors?.name && (
              <span className="text-red-500 text-sm">
                {state.errors.name[0]}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700">
              نشاط المتجر
            </label>
            <select
              name="category"
              defaultValue={tenant.category}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-[#F7F8F6] focus:outline-none focus:ring-2 focus:ring-[#27AE60]/50"
            >
              <option value="grocery">بقالة / سوبر ماركت</option>
              <option value="greengrocer">خضار وفاكهة</option>
              <option value="butcher">لحوم ودواجن</option>
              <option value="bakery">مخبز وحلويات</option>
              <option value="pharmacy">صيدلية</option>
              <option value="other">أخرى</option>
            </select>
            {state.errors?.category && (
              <span className="text-red-500 text-sm">
                {state.errors.category[0]}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700">
              المنطقة الأساسية
            </label>
            <select
              name="area_id"
              value={selectedMainAreaId || ""}
              onChange={handleMainAreaChange}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-[#F7F8F6] focus:outline-none focus:ring-2 focus:ring-[#27AE60]/50"
            >
              <option value="">اختر المنطقة الأساسية</option>
              {activeAreas.map((area) => {
                const parts = Array.from(
                  new Set(
                    [area.name_ar, area.city, area.name_en].filter(Boolean),
                  ),
                );
                return (
                  <option key={area.id} value={area.id}>
                    {parts.join(" - ")}
                  </option>
                );
              })}
            </select>
            {state.errors?.area_id && (
              <span className="text-red-500 text-sm">
                {state.errors.area_id[0]}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700">
              رقم الهاتف{" "}
              <span className="text-xs text-gray-400">(للقراءة فقط)</span>
            </label>
            <input
              type="text"
              value={tenant.phone}
              readOnly
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-100 text-gray-500 cursor-not-allowed"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700">
              رابط المتجر{" "}
              <span className="text-xs text-gray-400">(للقراءة فقط)</span>
            </label>
            <input
              type="text"
              value={tenant.slug}
              readOnly
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-100 text-gray-500 cursor-not-allowed"
              dir="ltr"
            />
          </div>
        </div>
      </div>

      {/* Payment Settings Card */}
      <div className="bg-white rounded-[20px] p-4 sm:p-6 shadow-sm border border-gray-100">
        <h2 className="text-xl font-semibold text-[#0F5A3D] mb-2">طرق الدفع</h2>
        <p className="mb-6 text-sm text-gray-500">
          تظهر طرق الدفع للعميل فقط عند إدخال الاسم والرقم معاً.
        </p>

        <div className="flex flex-col gap-6">
          <div className="rounded-xl border border-gray-100 bg-[#F7F8F6] p-4">
            <div className="mb-4 flex items-center gap-3">
              {INSTAPAY_PROVIDER.logoSrc ? (
                <Image
                  src={INSTAPAY_PROVIDER.logoSrc}
                  alt={INSTAPAY_PROVIDER.labelAr}
                  width={110}
                  height={32}
                  className="h-8 w-auto object-contain"
                />
              ) : (
                <span className="rounded-md bg-white px-3 py-1 text-sm font-black tracking-wide text-[#4B2383]">
                  {INSTAPAY_PROVIDER.labelAr}
                </span>
              )}
              <h3 className="text-sm font-bold text-gray-800">إنستاباي</h3>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-700">
                  اسم الحساب
                </label>
                <input
                  name="instapay_account_name"
                  type="text"
                  maxLength={120}
                  defaultValue={tenant.instapay_account_name || ""}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#27AE60]/50"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-700">
                  الرقم أو الحساب
                </label>
                <input
                  name="instapay_account_number"
                  type="text"
                  maxLength={120}
                  defaultValue={tenant.instapay_account_number || ""}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#27AE60]/50"
                  dir="ltr"
                />
                {state.errors?.instapay_account_number && (
                  <span className="text-red-500 text-sm">
                    {state.errors.instapay_account_number[0]}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-100 bg-[#F7F8F6] p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#27AE60]/10 text-[#27AE60]">
                  <WalletCards className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-bold text-gray-800">
                  محفظة إلكترونية
                </h3>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-700">
                  اسم صاحب المحفظة
                </label>
                <input
                  name="ewallet_account_name"
                  type="text"
                  maxLength={120}
                  defaultValue={tenant.ewallet_account_name || ""}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#27AE60]/50"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-700">
                  رقم المحفظة
                </label>
                <input
                  name="ewallet_account_number"
                  type="text"
                  maxLength={120}
                  defaultValue={tenant.ewallet_account_number || ""}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#27AE60]/50"
                  dir="ltr"
                />
                {state.errors?.ewallet_account_number && (
                  <span className="text-red-500 text-sm">
                    {state.errors.ewallet_account_number[0]}
                  </span>
                )}
              </div>
            </div>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-100 bg-[#F7F8F6] p-4">
            <input
              name="card_on_delivery_available"
              type="checkbox"
              defaultChecked={tenant.card_on_delivery_available === true}
              className="mt-1 h-5 w-5 rounded border-gray-300 text-[#0F5A3D] focus:ring-[#27AE60]/50"
            />
            <span>
              <span className="block text-sm font-bold text-gray-800">
                إتاحة الدفع بالكارت عند التوصيل
              </span>
              <span className="mt-1 block text-sm leading-6 text-gray-500">
                عند التفعيل يستطيع العميل طلب ماكينة كارت مع المندوب.
              </span>
            </span>
          </label>
        </div>
      </div>

      {/* Delivery Settings Card */}
      <div className="bg-white rounded-[20px] p-4 sm:p-6 shadow-sm border border-gray-100">
        <h2 className="text-xl font-semibold text-[#0F5A3D] mb-6">
          إعدادات التوصيل
        </h2>

        <div className="flex flex-col gap-5">
          <label className="flex items-center gap-3 cursor-pointer">
            <div className="relative">
              <input
                name="delivery_available"
                type="checkbox"
                defaultChecked={tenant.delivery_available}
                onChange={(e) => setDeliveryAvailable(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-[#27AE60] peer-checked:after:translate-x-[-100%] after:content-[''] after:absolute after:top-[2px] after:left-[22px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
            </div>
            <span className="text-sm font-medium text-gray-700">
              التوصيل متاح
            </span>
          </label>

          {deliveryAvailable && (
            <>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-700">
                  رسوم التوصيل (جنيه)
                </label>
                <input
                  name="delivery_fee"
                  type="number"
                  min="0"
                  step="1"
                  defaultValue={tenant.delivery_fee}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-[#F7F8F6] focus:outline-none focus:ring-2 focus:ring-[#27AE60]/50"
                />
                {state.errors?.delivery_fee && (
                  <span className="text-red-500 text-sm">
                    {state.errors.delivery_fee[0]}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setIsZonesOpen(!isZonesOpen)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-[#F7F8F6] hover:bg-gray-50 transition-colors"
                  >
                    <span className="text-sm font-medium text-gray-700">
                      مناطق التوصيل ({selectedAvailableZonesCount})
                    </span>
                    <svg
                      className={`w-5 h-5 text-gray-500 transition-transform ${isZonesOpen ? "rotate-180" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>

                  {isZonesOpen && (
                    <div className="flex flex-col max-h-60 overflow-y-auto p-2">
                      {!selectedMainAreaId ||
                      availableDeliveryAreas.length === 0 ? (
                        <span className="text-sm text-gray-500 p-2">
                          {deliveryZonesEmptyMessage}
                        </span>
                      ) : (
                        availableDeliveryAreas.map((area) => {
                          const parts = Array.from(
                            new Set(
                              [area.name_ar, area.city, area.name_en].filter(
                                Boolean,
                              ),
                            ),
                          );
                          const isSelected = selectedZones.has(area.id);
                          return (
                            <label
                              key={area.id}
                              className="flex items-center justify-end flex-row-reverse gap-3 cursor-pointer p-2 hover:bg-gray-50 rounded-lg"
                            >
                              <span
                                className="text-sm text-gray-700 flex-1 text-right"
                                dir="ltr"
                              >
                                {parts.join(" - ")}
                              </span>
                              <input
                                type="checkbox"
                                name="delivery_area_ids"
                                value={area.id}
                                checked={isSelected}
                                onChange={() => toggleZone(area.id)}
                                className="w-5 h-5 text-[#27AE60] bg-white border-gray-300 rounded focus:ring-[#27AE60]"
                              />
                            </label>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
                {state.errors?.delivery_area_ids && (
                  <span className="text-red-500 text-sm">
                    {state.errors.delivery_area_ids[0]}
                  </span>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex-1 flex flex-col gap-2">
                    <label className="text-sm font-medium text-gray-700">
                      من الساعة
                    </label>
                    <input
                      name="delivery_starts_at"
                      type="time"
                      ref={deliveryStartsAtInputRef}
                      defaultValue={tenant.delivery_starts_at || ""}
                      disabled={activePreset === "طوال اليوم"}
                      onChange={handleTimeChange}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-[#F7F8F6] focus:outline-none focus:ring-2 focus:ring-[#27AE60]/50 disabled:opacity-50"
                    />
                  </div>
                  <div className="flex-1 flex flex-col gap-2">
                    <label className="text-sm font-medium text-gray-700">
                      إلى الساعة
                    </label>
                    <input
                      name="delivery_ends_at"
                      type="time"
                      ref={deliveryEndsAtInputRef}
                      defaultValue={tenant.delivery_ends_at || ""}
                      disabled={activePreset === "طوال اليوم"}
                      onChange={handleTimeChange}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-[#F7F8F6] focus:outline-none focus:ring-2 focus:ring-[#27AE60]/50 disabled:opacity-50"
                    />
                  </div>
                </div>

                <div
                  className="flex flex-wrap gap-2"
                  aria-label="اختيارات سريعة لمواعيد التوصيل"
                >
                  {DELIVERY_TIME_PRESETS.map((preset) => {
                    const isActive = activePreset === preset.label;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          setActivePreset(preset.label);
                          if (
                            deliveryStartsAtInputRef.current &&
                            deliveryEndsAtInputRef.current
                          ) {
                            deliveryStartsAtInputRef.current.value =
                              preset.start;
                            deliveryEndsAtInputRef.current.value = preset.end;
                          }
                        }}
                        className={`min-h-9 rounded-md border px-3 py-1 text-xs font-bold transition-[background-color,border-color,color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#27AE60]/50 ${
                          isActive
                            ? "border-[#27AE60] bg-green-50 text-[#27AE60]"
                            : "border-gray-200 bg-gray-50 text-gray-700 hover:border-[#27AE60] hover:text-[#27AE60]"
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              {state.errors?.delivery_ends_at && (
                <span className="text-red-500 text-sm">
                  {state.errors.delivery_ends_at[0]}
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {state.message && (
        <div
          className={`p-4 rounded-xl text-sm font-medium ${
            state.success
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {state.message}
        </div>
      )}

      <div className="sticky bottom-4 z-10 mt-4">
        <button
          type="submit"
          disabled={isPending}
          className="w-full bg-[#0F5A3D] text-white py-4 rounded-xl font-bold text-lg hover:bg-[#0b422d] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
        >
          {isPending ? "جاري الحفظ..." : "حفظ التغييرات"}
        </button>
      </div>
    </form>
  );
}
