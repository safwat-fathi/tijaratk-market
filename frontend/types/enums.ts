export enum OrderStatus {
  DRAFT = 'draft',
  CONFIRMED = 'confirmed',
  OUT_FOR_DELIVERY = 'out_for_delivery',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  REJECTED_BY_CUSTOMER = 'rejected_by_customer',
}

export enum ReplacementDecisionStatus {
  NONE = 'none',
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export enum UnavailableItemAction {
  SUGGEST_REPLACEMENT = 'suggest_replacement',
  DELETE_ITEM = 'delete_item',
  CANCEL_ORDER = 'cancel_order',
}

export enum OrderType {
  CATALOG = 'catalog',
  FREE_TEXT = 'free_text',
}

export enum OrderSource {
  STOREFRONT = 'storefront',
  DIRECTORY = 'directory',
  WHATSAPP = 'whatsapp',
  MANUAL = 'manual',
  ZONE_STOREFRONT = 'zone_storefront',
}

export enum PricingMode {
  AUTO = 'auto',
  MANUAL = 'manual',
}
