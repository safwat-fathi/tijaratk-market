import type {
  DeliveryAreaFeeInput,
  DeliveryConfigurationInput,
  DirectoryArea,
} from "@/types/models/tenant";

/** Formats an `HH:MM` operating-hours value as Arabic 12-hour time. */
export const formatArabicTime = (value: string) => {
  const [hourValue, minutes] = value.split(":");
  const hour = Number(hourValue);

  return `${hour % 12 || 12}:${minutes} ${hour >= 12 ? "مساءً" : "صباحاً"}`;
};

/** Formats an operating-hours pair as `من … إلى …`, or null when incomplete. */
export const formatArabicTimeWindow = (
  startsAt: string | null | undefined,
  endsAt: string | null | undefined,
) =>
  startsAt && endsAt
    ? `من ${formatArabicTime(startsAt)} إلى ${formatArabicTime(endsAt)}`
    : null;

export const extractMainAreaIds = (
  tenantDeliveryAreas: Array<{ area_id: number; area?: { parent_area_id: number | null } }>,
) =>
  Array.from(
    tenantDeliveryAreas.reduce((mainAreaIds, deliveryArea) => {
      const parentAreaId = deliveryArea.area?.parent_area_id;

      if (typeof parentAreaId === "number") {
        mainAreaIds.add(parentAreaId);
      } else if (parentAreaId === null) {
        mainAreaIds.add(deliveryArea.area_id);
      }

      return mainAreaIds;
    }, new Set<number>()),
  );

export const excludeMainAreasFromDeliveryAreas = (
  deliveryAreas: DeliveryAreaFeeInput[],
  mainAreaIds: number[],
) =>
  deliveryAreas.filter(
    (deliveryArea) => !mainAreaIds.includes(deliveryArea.area_id),
  );

export const normalizeDeliveryConfiguration = (
  configuration: DeliveryConfigurationInput,
): DeliveryConfigurationInput => ({
  ...configuration,
  delivery_areas: excludeMainAreasFromDeliveryAreas(
    configuration.delivery_areas,
    configuration.main_area_ids,
  ),
});

export const getActiveChildAreas = (
  areas: DirectoryArea[],
  mainAreaIds: number[],
) =>
  areas.filter(
    (area) =>
      area.is_active &&
      area.parent_area_id !== null &&
      mainAreaIds.includes(area.parent_area_id),
  );

export const resolveMainAreaId = (
  areas: { id: number; is_active: boolean; parent_area_id: number | null }[],
  areaId: number,
) => {
  const selectedArea = areas.find((area) => area.id === areaId);
  if (!selectedArea || !selectedArea.is_active) return 0;
  if (selectedArea.parent_area_id === null) return selectedArea.id;
  const parentArea = areas.find(
    (area) =>
      area.id === selectedArea.parent_area_id &&
      area.is_active &&
      area.parent_area_id === null,
  );
  return parentArea?.id ?? 0;
};
