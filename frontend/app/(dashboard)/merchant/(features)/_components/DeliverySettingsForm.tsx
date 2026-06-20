"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import {
  updateDeliverySettingsAction,
  type UpdateDeliverySettingsState,
} from "@/actions/tenant-actions";
import type { TenantDeliverySettings } from "@/types/models/tenant";

const initialState: UpdateDeliverySettingsState = {
  success: false,
  message: "",
};

const DELIVERY_FEE_PRESETS = [0, 10, 15, 20] as const;

const DELIVERY_TIME_PRESETS = [
  { label: "طوال اليوم", start: "", end: "" },
  { label: "وردية 12 ساعة (10 ص - 10 م)", start: "10:00", end: "22:00" },
  { label: "فترة الصباح (10 ص - 2 م)", start: "10:00", end: "14:00" },
  { label: "فترة بعد الظهر (2 م - 6 م)", start: "14:00", end: "18:00" },
  { label: "فترة المساء (6 م - 10 م)", start: "18:00", end: "22:00" },
] as const;

type DeliverySettingsFormProps = {
  deliverySettings: TenantDeliverySettings;
  onSuccess?: () => void;
};

export default function DeliverySettingsForm({ deliverySettings, onSuccess }: DeliverySettingsFormProps) {
  const [state, formAction, isPending] = useActionState(
    updateDeliverySettingsAction,
    initialState,
  );
  const deliveryFeeInputRef = useRef<HTMLInputElement | null>(null);
  const deliveryStartsAtInputRef = useRef<HTMLInputElement | null>(null);
  const deliveryEndsAtInputRef = useRef<HTMLInputElement | null>(null);

  const deliveryFee = Number(deliverySettings.delivery_fee || 0);
  const initialDeliveryAvailable = deliverySettings.delivery_available !== false;
  const [deliveryAvailable, setDeliveryAvailable] = useState(
    initialDeliveryAvailable,
  );

  const [activePreset, setActivePreset] = useState<string>(() => {
    if (!deliverySettings.delivery_starts_at && !deliverySettings.delivery_ends_at) {
      return "طوال اليوم";
    }
    const preset = DELIVERY_TIME_PRESETS.find(
      p => p.start === deliverySettings.delivery_starts_at && p.end === deliverySettings.delivery_ends_at
    );
    return preset ? preset.label : "custom";
  });

  const handleTimeChange = () => {
    const start = deliveryStartsAtInputRef.current?.value || "";
    const end = deliveryEndsAtInputRef.current?.value || "";
    if (!start && !end) {
      setActivePreset("طوال اليوم");
    } else {
      const preset = DELIVERY_TIME_PRESETS.find(p => p.start === start && p.end === end);
      setActivePreset(preset ? preset.label : "custom");
    }
  };

  useEffect(() => {
    if (state.success && onSuccess) {
      // Optional slight delay before closing
      const t = setTimeout(() => {
        onSuccess();
      }, 1000);
      return () => clearTimeout(t);
    }
  }, [state.success, onSuccess]);

  return (
    <form action={formAction} className="space-y-6">
      <div className="space-y-5">
        <fieldset className="rounded-lg border border-brand-border bg-white p-4">
          <legend className="px-1 text-sm font-semibold text-brand-text">
            حالة التوصيل
          </legend>
          <ToggleSwitch
            name="delivery_available"
            label="التوصيل متاح"
            checked={deliveryAvailable}
            onChange={setDeliveryAvailable}
            className="mt-3"
            labelClassName="font-bold text-brand-text"
          />
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            عند إيقاف التوصيل، لن يتمكن العملاء من إرسال طلبات جديدة.
          </p>
        </fieldset>

        {deliveryAvailable && (
          <>
            <Field
              label="رسوم التوصيل"
              htmlFor="delivery_fee"
              error={state.errors?.delivery_fee?.[0]}
            >
              <div className="relative">
                <Input
                  id="delivery_fee"
                  name="delivery_fee"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  autoComplete="off"
                  ref={deliveryFeeInputRef}
                  defaultValue={Number.isFinite(deliveryFee) ? deliveryFee : 0}
                  className="pe-16 text-lg font-bold tabular-nums"
                  required
                />
                <span className="pointer-events-none absolute inset-y-0 end-4 flex items-center text-sm font-semibold text-muted-foreground">
                  جنيه
                </span>
              </div>
            </Field>

            <div className="grid grid-cols-4 gap-2" aria-label="اختيارات سريعة لرسوم التوصيل">
              {DELIVERY_FEE_PRESETS.map(value => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    if (deliveryFeeInputRef.current) {
                      deliveryFeeInputRef.current.value = String(value);
                    }
                  }}
                  className="min-h-11 rounded-md border border-brand-border bg-brand-soft px-3 py-2 text-sm font-bold text-brand-text transition-[background-color,border-color,color,box-shadow] hover:border-brand-accent hover:bg-brand-soft/80 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/20"
                >
                  {value}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Field
                  label="من الساعة"
                  htmlFor="delivery_starts_at"
                  error={state.errors?.delivery_starts_at?.[0]}
                >
                  <Input
                    id="delivery_starts_at"
                    name="delivery_starts_at"
                    type="time"
                    ref={deliveryStartsAtInputRef}
                    defaultValue={deliverySettings.delivery_starts_at || ""}
                    disabled={activePreset === "طوال اليوم"}
                    onChange={handleTimeChange}
                  />
                </Field>

                <Field
                  label="إلى الساعة"
                  htmlFor="delivery_ends_at"
                  error={state.errors?.delivery_ends_at?.[0]}
                >
                  <Input
                    id="delivery_ends_at"
                    name="delivery_ends_at"
                    type="time"
                    ref={deliveryEndsAtInputRef}
                    defaultValue={deliverySettings.delivery_ends_at || ""}
                    disabled={activePreset === "طوال اليوم"}
                    onChange={handleTimeChange}
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
                        if (deliveryStartsAtInputRef.current && deliveryEndsAtInputRef.current) {
                          deliveryStartsAtInputRef.current.value = preset.start;
                          deliveryEndsAtInputRef.current.value = preset.end;
                        }
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
            {(state.errors?.delivery_starts_at || state.errors?.delivery_ends_at) && (
              <p className="text-sm text-status-error mt-2">
                يرجى التأكد من إدخال وقت صحيح، وأن يكون وقت النهاية بعد وقت البداية.
              </p>
            )}
          </>
        )}
      </div>

      {state.message ? (
        <div
          role="status"
          aria-live="polite"
          className={`rounded-lg border px-4 py-3 text-sm font-semibold ${
            state.success
              ? "border-status-success/20 bg-status-success/10 text-status-success"
              : "border-status-error/20 bg-status-error/10 text-status-error"
          }`}
        >
          {state.message}
        </div>
      ) : null}

      <div className="pt-4 border-t border-brand-border flex gap-3">
        <Button type="submit" size="lg" className="flex-1" disabled={isPending}>
          {isPending ? "جاري الحفظ…" : "حفظ التغييرات"}
        </Button>
        {onSuccess && (
           <Button type="button" size="lg" variant="outline" onClick={onSuccess} disabled={isPending}>
             إلغاء
           </Button>
        )}
      </div>
    </form>
  );
}
