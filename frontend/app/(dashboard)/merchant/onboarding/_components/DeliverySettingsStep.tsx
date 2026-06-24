"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Tenant } from "@/types/models/tenant";
import { Field, Input } from "@/components/ui/Field";
import { tenantsService } from "@/services/api/tenants.service";

const DELIVERY_TIME_PRESETS = [
  { label: "طوال اليوم", start: "", end: "" },
  { label: "وردية 12 ساعة (10 ص - 10 م)", start: "10:00", end: "22:00" },
  { label: "فترة الصباح (10 ص - 2 م)", start: "10:00", end: "14:00" },
  { label: "فترة بعد الظهر (2 م - 6 م)", start: "14:00", end: "18:00" },
  { label: "فترة المساء (6 م - 10 م)", start: "18:00", end: "22:00" },
] as const;

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
      const payload: any = {
        delivery_fee: Number(fee) || 0,
        delivery_available: true,
      };
      
      payload.delivery_starts_at = startsAt || null;
      payload.delivery_ends_at = endsAt || null;

      const response = await tenantsService.updateMyDeliverySettings(payload);
      
      if (response.success && response.data) {
        setTenant(response.data);
        await onNext();
      } else {
        setError("حدث خطأ أثناء حفظ الإعدادات");
      }
    } catch (err) {
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
      </div>

      <div className="pt-4 border-t border-gray-100 flex justify-end">
        <Button type="submit" disabled={loading} size="lg" className="w-full sm:w-auto px-8">
          {loading ? "جاري الحفظ..." : "حفظ ومتابعة"}
        </Button>
      </div>
    </form>
  );
}
