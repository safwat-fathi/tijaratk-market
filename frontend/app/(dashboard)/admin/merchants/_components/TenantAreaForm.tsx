"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { MapPin, Settings2 } from "lucide-react";
import {
  updateTenantAreasAction,
  type AdminDeliveryConfigurationState,
} from "@/actions/admin-server";
import DeliveryConfigurationEditor from "@/components/delivery/DeliveryConfigurationEditor";
import BottomSheet from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import {
  extractMainAreaIds,
  normalizeDeliveryConfiguration,
  resolveMainAreaId,
} from "@/lib/delivery-configuration";
import type {
  DeliveryConfigurationInput,
  DirectoryArea,
} from "@/types/models/tenant";
import type {
  AdminDirectoryArea,
  AdminTenant,
} from "@/services/api/admin.service";

type TenantAreaFormProps = {
  tenant: AdminTenant;
  areas: AdminDirectoryArea[];
};

const initialState: AdminDeliveryConfigurationState = {
  success: false,
  message: "",
};

export function TenantAreaForm({ tenant, areas }: TenantAreaFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(
    updateTenantAreasAction.bind(null, tenant.id),
    initialState,
  );
  const editorAreas = useMemo<DirectoryArea[]>(
    () =>
      areas
        .filter((area) => area.is_active)
        .map((area) => ({ ...area, sort_order: 0 })),
    [areas],
  );
  const [configuration, setConfiguration] =
    useState<DeliveryConfigurationInput>(() =>
      normalizeDeliveryConfiguration({
        delivery_available: tenant.delivery_available !== false,
        delivery_starts_at: tenant.delivery_starts_at || null,
        delivery_ends_at: tenant.delivery_ends_at || null,
        main_area_ids: [tenant.directory_profile?.area_id].filter(
          (id): id is number => typeof id === "number" && id > 0
        ),
        delivery_areas:
          tenant.tenant_delivery_areas
            ?.filter(
              (area) =>
                area.is_active !== false && area.area.is_active !== false,
            )
            .map((area) => ({
              area_id: area.area_id,
              delivery_fee: Number(area.delivery_fee),
            })) || [],
      }),
    );

  // Derive main areas on initial load similar to settings form
  useEffect(() => {
    setConfiguration((current) => {
      const deliveryAreas =
        tenant.tenant_delivery_areas?.filter(
          (area) => area.is_active !== false && area.area?.is_active !== false
        ) || [];

      const mainAreaIds = extractMainAreaIds(deliveryAreas);

      if (mainAreaIds.length === 0 && tenant.directory_profile?.area_id) {
        const resolvedId = resolveMainAreaId(
          areas,
          tenant.directory_profile.area_id
        );
        if (resolvedId) mainAreaIds.push(resolvedId);
      }

      const activeDeliveryAreas = deliveryAreas.filter(
        (area) => !mainAreaIds.includes(area.area_id)
      );

      return normalizeDeliveryConfiguration({
        ...current,
        main_area_ids: mainAreaIds,
        delivery_areas: activeDeliveryAreas.map((area) => ({
          area_id: area.area_id,
          delivery_fee: Number(area.delivery_fee),
        })),
      });
    });
  }, [tenant, areas]);

  useEffect(() => {
    if (state.success) setIsOpen(false);
  }, [state.success]);

  const fees = configuration.delivery_areas.map((area) => area.delivery_fee);
  const feeSummary =
    fees.length === 0
      ? "بدون مناطق"
      : Math.min(...fees) === Math.max(...fees)
        ? `${Math.min(...fees)} جنيه`
        : `${Math.min(...fees)} - ${Math.max(...fees)} جنيه`;
  const deliveryConfigured =
    configuration.delivery_available &&
    configuration.delivery_areas.length > 0;

  return (
    <div className="w-full sm:min-w-64">
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs font-bold text-gray-700">
              <MapPin className="h-4 w-4 text-brand-primary" aria-hidden="true" />
              {configuration.delivery_areas.length} منطقة توصيل
            </p>
            <p className="mt-1 text-xs text-gray-500">
              الرسوم: {feeSummary}
            </p>
          </div>
          <span
            className={`rounded-full px-2 py-1 text-[11px] font-bold ${
              deliveryConfigured
                ? "bg-green-100 text-green-800"
                : "bg-gray-200 text-gray-700"
            }`}
          >
            {deliveryConfigured ? "متاح" : "متوقف"}
          </span>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="mt-3 min-h-11 w-full gap-2"
          onClick={() => setIsOpen(true)}
        >
          <Settings2 className="h-4 w-4" aria-hidden="true" />
          إدارة التوصيل
        </Button>
      </div>

      <BottomSheet
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={`توصيل ${tenant.name}`}
        desktopDialog
      >
        <form action={formAction} className="space-y-5">
          <input
            type="hidden"
            name="delivery_configuration"
            value={JSON.stringify(configuration)}
          />
          <DeliveryConfigurationEditor
            areas={editorAreas}
            value={configuration}
            onChange={setConfiguration}
            errors={state.errors}
            disabled={isPending}
          />
          {state.message && !state.success ? (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800"
            >
              {state.message}
            </p>
          ) : null}
          <div className="sticky bottom-0 border-t border-brand-border bg-white pt-4 safe-bottom-padding">
            <Button
              type="submit"
              disabled={isPending}
              className="min-h-12 w-full"
            >
              {isPending ? "جاري الحفظ..." : "حفظ مناطق ورسوم التوصيل"}
            </Button>
          </div>
        </form>
      </BottomSheet>
    </div>
  );
}
