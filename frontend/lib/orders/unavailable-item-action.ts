import { UnavailableItemAction } from "@/types/enums";

export const DEFAULT_UNAVAILABLE_ITEM_ACTION =
  UnavailableItemAction.SUGGEST_REPLACEMENT;

export const UNAVAILABLE_ITEM_ACTION_OPTIONS = [
  {
    value: UnavailableItemAction.SUGGEST_REPLACEMENT,
    label: "اقترح بديل",
    merchantLabel: "العميل يفضل اقتراح بديل",
  },
  {
    value: UnavailableItemAction.DELETE_ITEM,
    label: "احذف المنتج",
    merchantLabel: "العميل يفضل حذف المنتج غير المتوفر",
  },
  {
    value: UnavailableItemAction.CANCEL_ORDER,
    label: "ألغي الطلب",
    merchantLabel: "العميل يفضل إلغاء الطلب إذا لم يتوفر منتج",
  },
] as const;

export const formatUnavailableItemAction = (
  value?: string | null,
): string | null =>
  UNAVAILABLE_ITEM_ACTION_OPTIONS.find((option) => option.value === value)
    ?.merchantLabel ?? null;
