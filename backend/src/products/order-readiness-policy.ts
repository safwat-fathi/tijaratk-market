import { ProductStatus } from 'src/common/enums/product-status.enum';
import { TenantCategory } from '../../generated/prisma/client';

export const MIN_ACTIVE_PRODUCTS_FOR_ORDERS = 200;
export const MIN_ACTIVE_PRODUCTS_FOR_LIGHTWEIGHT_ORDERS = 50;

export type ProductOrderReadinessStatus =
  | 'ready_for_orders'
  | 'add_products'
  | 'not_ready_for_orders';

export type ProductOrderReadiness = {
  active_products_count: number;
  required_products_count: number;
  remaining_products_count: number;
  completion_percentage: number;
  status: ProductOrderReadinessStatus;
  milestones: number[];
};

type TenantCategoryInput = TenantCategory | null | undefined;

export const PRODUCT_ORDER_READINESS_MILESTONES = [50, 100, 150, 200];
export const LIGHTWEIGHT_PRODUCT_ORDER_READINESS_MILESTONES = [10, 25, 50];

export const ACTIVE_PRODUCT_FOR_ORDERS_WHERE = {
  status: ProductStatus.ACTIVE,
  deleted_at: null,
} as const;

export function buildProductOrderReadiness(
  activeProductsCount: number,
  tenantCategory?: TenantCategoryInput,
): ProductOrderReadiness {
  const safeActiveProductsCount = Math.max(0, Math.floor(activeProductsCount));
  const requiredProductsCount =
    resolveRequiredProductsForTenantCategory(tenantCategory);
  const milestones =
    resolveProductReadinessMilestonesForTenantCategory(tenantCategory);
  const remainingProductsCount = Math.max(
    0,
    requiredProductsCount - safeActiveProductsCount,
  );
  const completionPercentage = Math.min(
    100,
    Math.round((safeActiveProductsCount / requiredProductsCount) * 1000) / 10,
  );

  return {
    active_products_count: safeActiveProductsCount,
    required_products_count: requiredProductsCount,
    remaining_products_count: remainingProductsCount,
    completion_percentage: completionPercentage,
    status: resolveProductOrderReadinessStatus(
      safeActiveProductsCount,
      requiredProductsCount,
    ),
    milestones,
  };
}

export function resolveRequiredProductsForTenantCategory(
  tenantCategory?: TenantCategoryInput,
): number {
  if (
    tenantCategory === TenantCategory.grocery ||
    tenantCategory === TenantCategory.pharmacy
  ) {
    return MIN_ACTIVE_PRODUCTS_FOR_ORDERS;
  }

  return MIN_ACTIVE_PRODUCTS_FOR_LIGHTWEIGHT_ORDERS;
}

export function resolveProductReadinessMilestonesForTenantCategory(
  tenantCategory?: TenantCategoryInput,
): number[] {
  if (
    tenantCategory === TenantCategory.grocery ||
    tenantCategory === TenantCategory.pharmacy
  ) {
    return PRODUCT_ORDER_READINESS_MILESTONES;
  }

  return LIGHTWEIGHT_PRODUCT_ORDER_READINESS_MILESTONES;
}

function resolveProductOrderReadinessStatus(
  activeProductsCount: number,
  requiredProductsCount: number,
): ProductOrderReadinessStatus {
  if (activeProductsCount >= requiredProductsCount) {
    return 'ready_for_orders';
  }

  return activeProductsCount > 0 ? 'add_products' : 'not_ready_for_orders';
}
