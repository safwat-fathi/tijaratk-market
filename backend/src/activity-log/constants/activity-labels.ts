import { OrderStatus } from 'src/common/enums/order-status.enum';
import { ProductStatus } from 'src/common/enums/product-status.enum';
import { ReplacementDecisionStatus } from 'src/common/enums/replacement-decision-status.enum';

export const ORDER_STATUS_LABELS_AR: Record<OrderStatus, string> = {
  [OrderStatus.DRAFT]: 'جديد',
  [OrderStatus.CONFIRMED]: 'مؤكد',
  [OrderStatus.OUT_FOR_DELIVERY]: 'خرج للتوصيل',
  [OrderStatus.COMPLETED]: 'مكتمل',
  [OrderStatus.CANCELLED]: 'ملغي',
  [OrderStatus.REJECTED_BY_CUSTOMER]: 'مرفوض من العميل',
};

export const PRODUCT_STATUS_LABELS_AR: Record<ProductStatus, string> = {
  [ProductStatus.ACTIVE]: 'نشط',
  [ProductStatus.ARCHIVED]: 'مؤرشف',
};

export const REPLACEMENT_DECISION_LABELS_AR: Record<
  ReplacementDecisionStatus,
  string
> = {
  [ReplacementDecisionStatus.NONE]: 'بدون قرار',
  [ReplacementDecisionStatus.PENDING]: 'بانتظار العميل',
  [ReplacementDecisionStatus.APPROVED]: 'موافق عليه',
  [ReplacementDecisionStatus.REJECTED]: 'مرفوض',
};

/**
 * Returns an Arabic label for a known value while preserving unknown values.
 */
export function formatKnownValueAr<T extends string>(
  labels: Partial<Record<T, string>>,
  value: T,
): string {
  return labels[value] ?? value;
}

