"use client";

import { useActionState, useEffect, useState } from "react";
import {
  updateZoneDeliveryFeesAction,
  type ActionState,
} from "@/actions/admin-server";
import { Button } from "@/components/ui/Button";
import Toast from "@/components/ui/Toast";
import type { ZoneDeliveryArea } from "@/types/models/zone-storefront";

const initialState: ActionState = {};

export function ZoneDeliveryFeesForm({
  zoneId,
  zoneSlug,
  deliveryAreas,
}: {
  zoneId: number;
  zoneSlug: string;
  deliveryAreas: ZoneDeliveryArea[];
}) {
  const [fees, setFees] = useState<Record<number, string>>(() =>
    Object.fromEntries(
      deliveryAreas.map((entry) => [
        entry.area_id,
        entry.delivery_fee === null ? "" : String(entry.delivery_fee),
      ]),
    ),
  );
  const [state, action, isPending] = useActionState(
    updateZoneDeliveryFeesAction.bind(null, zoneId, zoneSlug),
    initialState,
  );
  const [toastOpen, setToastOpen] = useState(false);

  useEffect(() => {
    if (state.timestamp) setToastOpen(true);
  }, [state.timestamp]);

  const payload = deliveryAreas.map((entry) => ({
    area_id: entry.area_id,
    delivery_fee: Number(fees[entry.area_id]),
  }));

  return (
    <>
      {toastOpen && state.message ? (
        <Toast
          key={state.timestamp}
          message={state.message}
          type={state.success ? "success" : "error"}
          onClose={() => setToastOpen(false)}
        />
      ) : null}
      <form action={action} className="mt-4 space-y-4">
        <input
          type="hidden"
          name="delivery_areas"
          value={JSON.stringify(payload)}
        />
        <div className="grid gap-3 md:grid-cols-2">
          {deliveryAreas.map((entry) => (
            <label
              key={entry.area_id}
              className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm font-semibold text-gray-800"
            >
              <span className="block">{entry.area.name_ar}</span>
              <span className="mt-0.5 block text-xs font-normal text-gray-500">
                {entry.area.city || entry.area.governorate || "منطقة فرعية"}
              </span>
              <span className="mt-3 flex items-center gap-2">
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={fees[entry.area_id] ?? ""}
                  onChange={(event) =>
                    setFees((current) => ({
                      ...current,
                      [entry.area_id]: event.target.value,
                    }))
                  }
                  disabled={isPending}
                  className="min-h-11 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-base disabled:opacity-60"
                  aria-label={`رسوم توصيل ${entry.area.name_ar}`}
                />
                <span className="shrink-0">جنيه</span>
              </span>
            </label>
          ))}
        </div>
        {deliveryAreas.length === 0 ? (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
            لا توجد مناطق فرعية نشطة. أضف مناطق فرعية إلى المنطقة الرئيسية قبل
            تفعيل الواجهة.
          </p>
        ) : null}
        <Button type="submit" disabled={isPending || deliveryAreas.length === 0}>
          {isPending ? "جارٍ حفظ الرسوم..." : "حفظ رسوم مناطق التوصيل"}
        </Button>
      </form>
    </>
  );
}
