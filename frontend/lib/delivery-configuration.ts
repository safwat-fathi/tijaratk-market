import type {
  DeliveryAreaFeeInput,
  DeliveryConfigurationInput,
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
