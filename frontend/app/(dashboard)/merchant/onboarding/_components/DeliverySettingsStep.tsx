"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Tenant } from "@/types/models/tenant";
import { Field, Input } from "@/components/ui/Field";
import { tenantsService } from "@/services/api/tenants.service";
import { merchantDirectoryService } from "@/services/api/stores-directory.service";
import type { DirectoryArea } from "@/types/models/tenant";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

const DELIVERY_TIME_PRESETS = [
  { label: "طوال اليوم", start: "", end: "" },
  { label: "وردية 12 ساعة (10 ص - 10 م)", start: "10:00", end: "22:00" },
  { label: "فترة الصباح (10 ص - 2 م)", start: "10:00", end: "14:00" },
  { label: "فترة بعد الظهر (2 م - 6 م)", start: "14:00", end: "18:00" },
  { label: "فترة المساء (6 م - 10 م)", start: "18:00", end: "22:00" },
] as const;

type DeliverySettingsPayload = {
  delivery_fee: number;
  delivery_available: boolean;
  delivery_starts_at: string | null;
  delivery_ends_at: string | null;
};

const resolveInitialDeliveryAreaIds = (
  selectedAreaIds: number[],
  areaId: number | null,
) => {
  if (selectedAreaIds.length > 0) {
    return selectedAreaIds;
  }

  if (areaId) {
    return [areaId];
  }

  return [];
};

export default function DeliverySettingsStep({
  tenant,
  setTenant,
  onNext,
}: {
  tenant: Tenant;
  setTenant: (t: Tenant) => void;
  onNext: () => void;
}) {
  const [fee, setFee] = useState(tenant.delivery_fee?.toString() || "20");
  const [startsAt, setStartsAt] = useState(tenant.delivery_starts_at || "");
  const [endsAt, setEndsAt] = useState(tenant.delivery_ends_at || "");
  const [profileAreaId, setProfileAreaId] = useState<number | null>(null);
  const [deliveryAreaIds, setDeliveryAreaIds] = useState<number[]>([]);
  const [areas, setAreas] = useState<DirectoryArea[]>([]);
  const [areasLoading, setAreasLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activePreset, setActivePreset] = useState<string>(() => {
    if (!tenant.delivery_starts_at && !tenant.delivery_ends_at) {
      return "طوال اليوم";
    }
    const preset = DELIVERY_TIME_PRESETS.find(
      p => p.start === tenant.delivery_starts_at && p.end === tenant.delivery_ends_at
    );
    return preset ? preset.label : "custom";
  });

  useEffect(() => {
    let cancelled = false;

    const fetchDeliveryAreas = async () => {
      setAreasLoading(true);
      try {
        const [profileResponse, areasResponse] = await Promise.all([
          merchantDirectoryService.getProfile(),
          merchantDirectoryService.getActiveAreas(),
        ]);

        if (cancelled) return;

        if (areasResponse.success && areasResponse.data) {
          setAreas(areasResponse.data);
        }

        if (profileResponse.success && profileResponse.data) {
          const areaId = profileResponse.data.area_id ?? null;
          setProfileAreaId(areaId);
          const selectedAreaIds = profileResponse.data.delivery_area_ids ?? [];
          setDeliveryAreaIds(
            resolveInitialDeliveryAreaIds(selectedAreaIds, areaId),
          );
        }
      } catch (err) {
        console.error("Failed to load delivery areas", err);
        if (!cancelled) {
          setError("تعذر تحميل مناطق التوصيل");
        }
      } finally {
        if (!cancelled) {
          setAreasLoading(false);
        }
      }
    };

    void fetchDeliveryAreas();

    return () => {
      cancelled = true;
    };
  }, []);

  const deliveryAreas = useMemo(() => {
    if (!profileAreaId) return [];

    return areas
      .filter(
        (area) => area.id === profileAreaId || area.parent_area_id === profileAreaId,
      )
      .sort((left, right) => left.sort_order - right.sort_order);
  }, [areas, profileAreaId]);

  const toggleDeliveryArea = (areaId: number) => {
    setDeliveryAreaIds((current) =>
      current.includes(areaId)
        ? current.filter((id) => id !== areaId)
        : [...current, areaId],
    );
  };

  const handleTimeChange = (type: 'start' | 'end', val: string) => {
    if (type === 'start') setStartsAt(val);
    else setEndsAt(val);
    
    const s = type === 'start' ? val : startsAt;
    const e = type === 'end' ? val : endsAt;
    
    if (!s && !e) {
      setActivePreset("طوال اليوم");
    } else {
      const preset = DELIVERY_TIME_PRESETS.find(p => p.start === s && p.end === e);
      setActivePreset(preset ? preset.label : "custom");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      if (!profileAreaId) {
        setError("يرجى تحديد منطقة المتجر أولاً");
        return;
      }

      const uniqueDeliveryAreaIds = Array.from(
        new Set(deliveryAreaIds.length > 0 ? deliveryAreaIds : [profileAreaId]),
      );

      const profileResponse = await merchantDirectoryService.updateProfile({
        area_id: profileAreaId,
        delivery_area_ids: uniqueDeliveryAreaIds,
      });

      if (!profileResponse.success) {
        setError(profileResponse.message || "حدث خطأ أثناء حفظ مناطق التوصيل");
        return;
      }

      const payload: DeliverySettingsPayload = {
        delivery_fee: Number(fee) || 0,
        delivery_available: true,
        delivery_starts_at: startsAt || null,
        delivery_ends_at: endsAt || null,
      };

      const response = await tenantsService.updateMyDeliverySettings(payload);
      
      if (response.success && response.data) {
        setTenant(response.data);
        await onNext();
      } else {
        setError("حدث خطأ أثناء حفظ الإعدادات");
      }
    } catch (err) {
      console.error(err);
      setError("حدث خطأ أثناء حفظ الإعدادات");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      {error && (
        <div className="bg-red-50 text-red-800 p-4 rounded-lg text-sm mb-4">
          {error}
        </div>
      )}
      <div className="bg-blue-50 text-blue-800 p-4 rounded-lg text-sm mb-4">
        هذه الإعدادات ستظهر للعملاء عند الطلب من متجرك.
      </div>
      
      <div className="space-y-4">
        <Field label="مصاريف التوصيل (جنيه)" htmlFor="fee">
          <Input 
            id="fee"
            required 
            type="number"
            min="0"
            placeholder="مثال: 20"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
          />
        </Field>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="بداية التوصيل" htmlFor="startsAt">
              <Input 
                id="startsAt"
                type="time"
                value={startsAt}
                disabled={activePreset === "طوال اليوم"}
                onChange={(e) => handleTimeChange('start', e.target.value)}
              />
            </Field>

            <Field label="نهاية التوصيل" htmlFor="endsAt">
              <Input 
                id="endsAt"
                type="time"
                value={endsAt}
                disabled={activePreset === "طوال اليوم"}
                onChange={(e) => handleTimeChange('end', e.target.value)}
              />
            </Field>
          </div>

          <div className="flex flex-wrap gap-2" aria-label="اختيارات سريعة لمواعيد التوصيل">
            {DELIVERY_TIME_PRESETS.map((preset) => {
              const isActive = activePreset === preset.label;
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    setActivePreset(preset.label);
                    setStartsAt(preset.start);
                    setEndsAt(preset.end);
                  }}
                  className={`min-h-9 rounded-md border px-3 py-1 text-xs font-bold transition-[background-color,border-color,color,box-shadow] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/20 ${
                    isActive 
                      ? "border-brand-primary bg-brand-soft text-brand-primary" 
                      : "border-brand-border bg-white text-brand-text hover:border-brand-accent hover:bg-brand-soft/80"
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-brand-border p-3">
          <div>
            <h3 className="text-sm font-bold text-brand-text">مناطق التوصيل</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              اختر المناطق التي يمكن للعملاء الطلب منها.
            </p>
          </div>

          {areasLoading && (
            <div className="flex justify-center py-4">
              <LoadingSpinner className="h-6 w-6 text-brand-primary" />
            </div>
          )}
          {!areasLoading && deliveryAreas.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-2">
              {deliveryAreas.map((area) => (
                <label
                  key={area.id}
                  className="flex items-center gap-2 rounded-md border border-brand-border px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={deliveryAreaIds.includes(area.id)}
                    onChange={() => toggleDeliveryArea(area.id)}
                    className="h-4 w-4 accent-brand-primary"
                  />
                  <span>{area.name_ar}</span>
                </label>
              ))}
            </div>
          )}
          {!areasLoading && deliveryAreas.length === 0 && (
            <p className="rounded-md bg-gray-50 p-3 text-sm text-muted-foreground">
              لا توجد مناطق توصيل متاحة للمنطقة الأساسية المختارة.
            </p>
          )}
        </div>
      </div>

      <div className="pt-4 border-t border-gray-100 flex justify-end">
        <Button type="submit" disabled={loading || areasLoading} size="lg" className="w-full sm:w-auto px-8">
          {loading ? "جاري الحفظ..." : "حفظ ومتابعة"}
        </Button>
      </div>
    </form>
  );
}
