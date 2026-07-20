import type {
  DeliveryAreaFeeInput,
  DeliveryConfigurationInput,
  DirectoryArea,
} from "@/types/models/tenant";

export const excludePrimaryAreaFromDeliveryAreas = (
  deliveryAreas: DeliveryAreaFeeInput[],
  primaryAreaId: number,
) =>
  deliveryAreas.filter(
    (deliveryArea) => deliveryArea.area_id !== primaryAreaId,
  );

export const normalizeDeliveryConfiguration = (
  configuration: DeliveryConfigurationInput,
): DeliveryConfigurationInput => ({
  ...configuration,
  delivery_areas: excludePrimaryAreaFromDeliveryAreas(
    configuration.delivery_areas,
    configuration.primary_area_id,
  ),
});

export const getActiveChildAreas = (
  areas: DirectoryArea[],
  primaryAreaId: number,
) =>
  areas.filter(
    (area) =>
      area.is_active && area.parent_area_id === primaryAreaId,
  );

export const resolveMainAreaId = (
  areas: DirectoryArea[],
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
