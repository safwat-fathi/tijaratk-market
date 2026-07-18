"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import DeliveryConfigurationEditor from "@/components/delivery/DeliveryConfigurationEditor";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { tenantsService } from "@/services/api/tenants.service";
import { merchantDirectoryService } from "@/services/api/stores-directory.service";
import { normalizeDeliveryConfiguration } from "@/lib/delivery-configuration";
import type {
  DeliveryConfigurationInput,
  DirectoryArea,
  Tenant,
} from "@/types/models/tenant";

export default function DeliverySettingsStep({
  tenant,
  setTenant,
  onNext,
}: {
  tenant: Tenant;
  setTenant: (tenant: Tenant) => void;
  onNext: () => void;
}) {
  const [areas, setAreas] = useState<DirectoryArea[]>([]);
  const [configuration, setConfiguration] =
    useState<DeliveryConfigurationInput>(() =>
      normalizeDeliveryConfiguration({
        delivery_available: true,
        delivery_starts_at: tenant.delivery_starts_at || null,
        delivery_ends_at: tenant.delivery_ends_at || null,
        primary_area_id: tenant.directory_profile?.area_id || 0,
        delivery_areas:
          tenant.tenant_delivery_areas
            ?.filter(
              (area) =>
                area.is_active !== false && area.area?.is_active !== false,
            )
            .map((area) => ({
              area_id: area.area_id,
              delivery_fee: Number(area.delivery_fee),
            })) || [],
      }),
    );
  const [areasLoading, setAreasLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadConfiguration = async () => {
      const [profileResponse, areasResponse] = await Promise.all([
        merchantDirectoryService.getProfile(),
        merchantDirectoryService.getActiveAreas(),
      ]);
      if (cancelled) return;

      setAreas(areasResponse.data || []);
      if (profileResponse.success && profileResponse.data) {
        const primaryAreaId = profileResponse.data.area_id || 0;
        const deliveryAreas =
          profileResponse.data.delivery_areas ??
          profileResponse.data.tenant?.tenant_delivery_areas ??
          [];
        const activeDeliveryAreas = deliveryAreas.filter(
          (area) =>
            area.is_active !== false &&
            area.area?.is_active !== false &&
            area.area_id !== primaryAreaId,
        );
        setConfiguration((current) =>
          normalizeDeliveryConfiguration({
            ...current,
            primary_area_id: primaryAreaId,
            delivery_areas: activeDeliveryAreas.map((area) => ({
              area_id: area.area_id,
              delivery_fee: Number(area.delivery_fee),
            })),
          }),
        );
      }
      setAreasLoading(false);
    };

    void loadConfiguration();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!configuration.primary_area_id) {
      setError("اختر المنطقة الأساسية أولاً.");
      return;
    }
    if (
      configuration.delivery_available &&
      configuration.delivery_areas.length === 0
    ) {
      setError("اختر منطقة توصيل واحدة على الأقل.");
      return;
    }

    setSaving(true);
    const response = await tenantsService.updateMyDeliverySettings(
      normalizeDeliveryConfiguration(configuration),
    );
    setSaving(false);

    if (!response.success || !response.data) {
      setError(response.message || "تعذر حفظ إعدادات التوصيل.");
      return;
    }

    setTenant(response.data);
    await onNext();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="animate-in space-y-6 fade-in slide-in-from-right-4 duration-300"
    >
      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-800">
        تظهر المنطقة والرسوم المختارة للعميل قبل تأكيد الطلب.
      </div>

      {areasLoading ? (
        <div className="flex min-h-48 items-center justify-center">
          <LoadingSpinner className="h-7 w-7 text-brand-primary" />
        </div>
      ) : (
        <DeliveryConfigurationEditor
          areas={areas}
          value={configuration}
          onChange={setConfiguration}
          disabled={saving}
        />
      )}

      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800"
        >
          {error}
        </p>
      ) : null}

      <div className="sticky bottom-3 border-t border-gray-100 bg-white/95 pt-4 backdrop-blur safe-bottom-padding">
        <Button
          type="submit"
          disabled={saving || areasLoading}
          size="lg"
          className="min-h-12 w-full sm:w-auto sm:px-8"
        >
          {saving ? "جاري الحفظ..." : "حفظ ومتابعة"}
        </Button>
      </div>
    </form>
  );
}
