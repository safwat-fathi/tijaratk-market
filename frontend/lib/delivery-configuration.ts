import { formatCurrencyOrFallback } from "@/lib/utils/currency";
import type {
  DeliveryAreaFeeInput,
  DeliveryConfigurationInput,
  DeliveryFeeMode,
  DirectoryArea,
  OptionalDecimalValue,
} from "@/types/models/tenant";

/** Fee suggested for a newly selected zone before the merchant edits it. */
export const DEFAULT_ZONE_DELIVERY_FEE = 20;

/** The pricing columns of a stored zone, as the API serializes them. */
export type StoredZonePricing = {
  delivery_fee: number | string;
  fee_mode?: DeliveryFeeMode;
  min_delivery_fee?: OptionalDecimalValue;
  max_delivery_fee?: OptionalDecimalValue;
};

export const isDeferredDeliveryFee = (
  feeMode: DeliveryFeeMode | null | undefined,
) => feeMode === "on_order";

/**
 * Renders the bounds advertised for a zone priced after the order. Both bounds
 * are optional, so this covers the range, one-sided and unbounded cases.
 */
export const formatDeferredFeeRange = (
  min: number | null | undefined,
  max: number | null | undefined,
) => {
  if (min != null && max != null) {
    return min === max ? `${min} جنيه` : `من ${min} إلى ${max} جنيه`;
  }
  if (min != null) return `${min} جنيه على الأقل`;
  if (max != null) return `حتى ${max} جنيه`;
  return null;
};

/**
 * Collapses a zone into the shape the API stores: a fixed zone keeps its fee and
 * drops any bounds, a deferred zone stores a zero fee and keeps its bounds.
 * Mirrors `normalizeAreaPricing` in the backend delivery-configuration service.
 */
export const normalizeDeliveryAreaPricing = (
  area: DeliveryAreaFeeInput,
): DeliveryAreaFeeInput =>
  isDeferredDeliveryFee(area.fee_mode)
    ? {
        area_id: area.area_id,
        delivery_fee: 0,
        fee_mode: "on_order",
        min_delivery_fee: area.min_delivery_fee ?? null,
        max_delivery_fee: area.max_delivery_fee ?? null,
      }
    : {
        area_id: area.area_id,
        delivery_fee: area.delivery_fee,
        fee_mode: "fixed",
        min_delivery_fee: null,
        max_delivery_fee: null,
      };

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

/**
 * Describes what a shopper should see for one zone: a price for fixed zones, or
 * a "priced after the order" label plus any advertised bounds for deferred ones.
 * Shared by the area selector, the cart and checkout so the three never disagree.
 */
export const describeZoneDeliveryFee = (
  area: StoredZonePricing,
): { label: string; hint: string | null; isDeferred: boolean } => {
  if (isDeferredDeliveryFee(area.fee_mode)) {
    return {
      label: "حسب العنوان",
      hint: formatDeferredFeeRange(
        area.min_delivery_fee == null ? null : Number(area.min_delivery_fee),
        area.max_delivery_fee == null ? null : Number(area.max_delivery_fee),
      ),
      isDeferred: true,
    };
  }

  const fee = Number(area.delivery_fee);
  return {
    label: fee > 0 ? formatCurrencyOrFallback(fee) : "مجاني",
    hint: null,
    isDeferred: false,
  };
};

/**
 * Converts one stored tenant zone into editor input, defaulting rows that
 * predate deferred pricing to the fixed mode.
 */
export const toDeliveryAreaFeeInput = (
  area: StoredZonePricing & { area_id: number },
): DeliveryAreaFeeInput => ({
  area_id: area.area_id,
  delivery_fee: Number(area.delivery_fee),
  fee_mode: area.fee_mode ?? "fixed",
  min_delivery_fee:
    area.min_delivery_fee == null ? null : Number(area.min_delivery_fee),
  max_delivery_fee:
    area.max_delivery_fee == null ? null : Number(area.max_delivery_fee),
});

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
  ).map(normalizeDeliveryAreaPricing),
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
