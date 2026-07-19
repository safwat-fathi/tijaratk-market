"use client";

import { useActionState, useEffect, useState } from "react";
import {
  updateZoneOperatingHoursAction,
  type ActionState,
} from "@/actions/admin-server";
import { Button } from "@/components/ui/Button";
import Toast from "@/components/ui/Toast";

const initialState: ActionState = {};

export function ZoneOperatingHoursForm({ zoneId, zoneSlug, startsAt, endsAt }: {
  zoneId: number;
  zoneSlug: string;
  startsAt?: string | null;
  endsAt?: string | null;
}) {
  const [state, action, isPending] = useActionState(
    updateZoneOperatingHoursAction.bind(null, zoneId, zoneSlug),
    initialState,
  );
  const [toastOpen, setToastOpen] = useState(false);
  useEffect(() => {
    if (state.timestamp) setToastOpen(true);
  }, [state.timestamp]);

  return (
    <>
      {toastOpen && state.message ? (
        <Toast key={state.timestamp} message={state.message}
          type={state.success ? "success" : "error"}
          onClose={() => setToastOpen(false)} />
      ) : null}
      <form action={action} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex-1 text-sm font-semibold text-gray-800">
          بداية التشغيل
          <input type="time" name="delivery_starts_at" defaultValue={startsAt ?? ""}
            required disabled={isPending}
            className="mt-2 min-h-11 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-base disabled:opacity-60" />
        </label>
        <label className="flex-1 text-sm font-semibold text-gray-800">
          نهاية التشغيل
          <input type="time" name="delivery_ends_at" defaultValue={endsAt ?? ""}
            required disabled={isPending}
            className="mt-2 min-h-11 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-base disabled:opacity-60" />
        </label>
        <Button type="submit" disabled={isPending}>
          {isPending ? "جارٍ الحفظ..." : "حفظ ساعات التشغيل"}
        </Button>
      </form>
    </>
  );
}
