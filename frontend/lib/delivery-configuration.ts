import type {
  DeliveryAreaFeeInput,
  DeliveryConfigurationInput,
  DirectoryArea,
} from "@/types/models/tenant";

export const extractMainAreaIds = (
  tenantDeliveryAreas: Array<{ area_id: number; area?: { parent_area_id: number | null } }>,
) => {
  const deliveryAreaIds = new Set(tenantDeliveryAreas.map((a) => a.area_id));
  return tenantDeliveryAreas
    .filter((a) => {
      const parentId = a.area?.parent_area_id;
      return parentId === null || parentId === undefined || !deliveryAreaIds.has(parentId);
    })
    .map((a) => a.area_id);
};

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
