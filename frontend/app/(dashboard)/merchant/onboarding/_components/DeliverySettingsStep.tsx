"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import DeliveryConfigurationEditor from "@/components/delivery/DeliveryConfigurationEditor";
import MissingDeliveryAreaPanel from "@/components/delivery/MissingDeliveryAreaPanel";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { tenantsService } from "@/services/api/tenants.service";
import { merchantDirectoryService } from "@/services/api/stores-directory.service";
import {
  extractMainAreaIds,
  getActiveChildAreas,
  normalizeDeliveryConfiguration,
  resolveMainAreaId,
} from "@/lib/delivery-configuration";
import type {
  DeliveryConfigurationInput,
  DirectoryArea,
  MissingDeliveryAreaRequest,
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
  const [missingRequest, setMissingRequest] = useState<MissingDeliveryAreaRequest | null>(null);
  const [requestedAreaName, setRequestedAreaName] = useState("");
  const [requestNote, setRequestNote] = useState("");

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
        const deliveryAreas =
          profileResponse.data.delivery_areas ??
          profileResponse.data.tenant?.tenant_delivery_areas ??
          [];
        
        const mainAreaIds = extractMainAreaIds(deliveryAreas);
          
        if (mainAreaIds.length === 0 && profileResponse.data.area_id) {
          const resolvedId = resolveMainAreaId(areasResponse.data || [], profileResponse.data.area_id);
          if (resolvedId) mainAreaIds.push(resolvedId);
        }

        const activeDeliveryAreas = deliveryAreas.filter(
          (area) =>
            area.is_active !== false &&
            area.area?.is_active !== false &&
            !mainAreaIds.includes(area.area_id),
        );
        setConfiguration((current) =>
          normalizeDeliveryConfiguration({
            ...current,
            main_area_ids: mainAreaIds,
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

  useEffect(() => {
    // Missing area request logic is tied to the primary directory profile area,
    // which is the first ID in main_area_ids.
    const mainAreaId = configuration.main_area_ids[0];
    if (!mainAreaId) {
      setMissingRequest(null);
      return;
    }
    let cancelled = false;
    setMissingRequest(null);
    void merchantDirectoryService
      .getMissingDeliveryAreaRequest(mainAreaId)
      .then((response) => {
        if (cancelled) return;
        if (response.success) {
          setMissingRequest(response.data ?? null);
        } else {
          setError(response.message || "تعذر تحميل حالة طلب المنطقة.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [configuration.main_area_ids]);

  const activeChildren = useMemo(
    () => getActiveChildAreas(areas, configuration.main_area_ids),
    [areas, configuration.main_area_ids],
  );
  
  const mainAreaId = configuration.main_area_ids[0] || 0;
  
  const primaryArea = useMemo(
    () => areas.find((area) => area.id === mainAreaId) ?? null,
    [areas, mainAreaId],
  );

  const needsAreaReport = mainAreaId > 0 && activeChildren.length === 0;
  const currentMissingRequest = missingRequest?.main_area_id === mainAreaId
    ? missingRequest
    : null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (needsAreaReport) {
      if (!currentMissingRequest && !requestedAreaName.trim()) {
        setError("اكتب اسم منطقتك حتى يتمكن فريق الإدارة من إضافتها.");
        return;
      }
      setSaving(true);
      try {
        if (!currentMissingRequest) {
          const requestResponse = await merchantDirectoryService.createMissingDeliveryAreaRequest({
            main_area_id: mainAreaId,
            requested_area_name: requestedAreaName.trim(),
            note: requestNote.trim() || undefined,
          });
          if (!requestResponse.success || !requestResponse.data) {
            setError(requestResponse.message || "تعذر إرسال طلب المنطقة.");
            return;
          }
          setMissingRequest(requestResponse.data);
        }
        const response = await tenantsService.updateMyDeliverySettings({
          ...normalizeDeliveryConfiguration(configuration),
          delivery_available: false,
          delivery_areas: [],
        });
        if (!response.success || !response.data) {
          setError(response.message || "تعذر حفظ إعدادات التوصيل.");
          return;
        }
        setTenant(response.data);
        await onNext();
      } catch (caughtError) {
        console.error(caughtError);
        setError("تعذر إرسال طلب المنطقة أو حفظ إعدادات التوصيل.");
      } finally {
        setSaving(false);
      }
      return;
    }
    if (configuration.main_area_ids.length === 0) {
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
          emptyDeliveryAreasContent={
            needsAreaReport ? (
              <MissingDeliveryAreaPanel
                areaName={primaryArea?.name_ar ?? "المنطقة الأساسية"}
                request={currentMissingRequest}
                requestedAreaName={requestedAreaName}
                note={requestNote}
                onRequestedAreaNameChange={setRequestedAreaName}
                onNoteChange={setRequestNote}
                disabled={saving}
              />
            ) : undefined
          }
        />
      )}

      {!areasLoading && !needsAreaReport && currentMissingRequest?.status === "resolved" ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
          تمت إضافة {currentMissingRequest.resolved_area?.name_ar ?? "المنطقة المطلوبة"}. فعّل التوصيل وحدد رسومها للمتابعة.
        </p>
      ) : null}

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
          {saving ? "جاري الحفظ..." : needsAreaReport ? "إرسال الطلب والمتابعة" : "حفظ ومتابعة"}
        </Button>
      </div>
    </form>
  );
}
