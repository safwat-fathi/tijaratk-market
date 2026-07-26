import type { Product } from "@/types/models/product";
import type { StorefrontCartDraft } from "@/types/models/storefront-cart-draft";
import type { ProductCartSelection } from "@/app/(public)/[slug]/_components/ProductList";
import {
  sendCustomerAnalyticsEvent,
  type GoogleAnalyticsItem,
} from "@/lib/analytics/google-analytics";
import { resolveSelectionLineTotal } from "@/app/(public)/[slug]/_utils/order-form";

export type StorefrontAnalyticsContext = {
  storeId: number;
  storeSlug: string;
  storeName: string;
  storeCategory: string;
  area?: string;
};

export const CUSTOMER_PWA_INSTALL_SURFACES = {
  HOME: "home",
  STORE_DIRECTORY: "store_directory",
  DIRECT_STOREFRONT: "direct_storefront",
  INSTALL_GUIDE: "install_guide",
} as const;

export type CustomerPwaInstallSurface =
  (typeof CUSTOMER_PWA_INSTALL_SURFACES)[keyof typeof CUSTOMER_PWA_INSTALL_SURFACES];

type CustomerPwaNonStoreInstallSurface = Exclude<
  CustomerPwaInstallSurface,
  typeof CUSTOMER_PWA_INSTALL_SURFACES.DIRECT_STOREFRONT
>;

export type CustomerPwaInstallTrackingContext =
  | {
      installSurface: typeof CUSTOMER_PWA_INSTALL_SURFACES.DIRECT_STOREFRONT;
      store: StorefrontAnalyticsContext;
    }
  | {
      installSurface: CustomerPwaNonStoreInstallSurface;
      store?: never;
    };

type SelectionSnapshot = {
  item: GoogleAnalyticsItem;
  value: number;
};

const toRoundedCurrency = (value: number) =>
  Number(Math.max(0, value).toFixed(2));

const toRoundedDifference = (value: number) => Number(value.toFixed(2));

const storeParameters = (store: StorefrontAnalyticsContext) => ({
  store_id: String(store.storeId),
  store_slug: store.storeSlug,
  store_name: store.storeName,
  store_category: store.storeCategory,
  storefront_type: "tenant",
  ...(store.area ? { area: store.area } : {}),
});

const resolveSelectionQuantity = (selection: ProductCartSelection) => {
  if (selection.selection_mode !== "quantity") return 1;
  const quantity = Number(selection.selection_quantity || 0);
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
};

const resolveSelectionMetric = (selection?: ProductCartSelection) => {
  if (!selection) return 0;
  if (selection.selection_mode === "weight") {
    return Number(selection.selection_grams || 0);
  }
  if (selection.selection_mode === "price") {
    return Number(selection.selection_amount_egp || 0);
  }
  return Number(selection.selection_quantity || 0);
};

export const toAnalyticsSelection = (
  product: Product,
  selection: ProductCartSelection,
): SelectionSnapshot => {
  const value = resolveSelectionLineTotal(selection, product) ?? 0;
  const quantity = resolveSelectionQuantity(selection);

  return {
    value: toRoundedCurrency(value),
    item: {
      item_id: String(product.id),
      item_name: product.name,
      ...(product.category ? { item_category: product.category } : {}),
      price: quantity > 0 ? toRoundedCurrency(value / quantity) : 0,
      quantity,
    },
  };
};

export const toAnalyticsDraftItems = (
  draft: StorefrontCartDraft | null,
): GoogleAnalyticsItem[] =>
  (draft?.items ?? []).map((entry) =>
    toAnalyticsSelection(entry.product, entry).item,
  );

export const trackStoreView = (store: StorefrontAnalyticsContext) =>
  sendCustomerAnalyticsEvent("store_view", storeParameters(store));

export const trackCustomerPwaInstall = (
  context: CustomerPwaInstallTrackingContext,
) => {
  const parameters = {
    pwa_app: "customer",
    install_surface: context.installSurface,
  };

  if (
    context.installSurface ===
    CUSTOMER_PWA_INSTALL_SURFACES.DIRECT_STOREFRONT
  ) {
    return sendCustomerAnalyticsEvent("pwa_install", {
      ...parameters,
      ...storeParameters(context.store),
    });
  }

  return sendCustomerAnalyticsEvent("pwa_install", parameters);
};

export const trackViewItem = (
  store: StorefrontAnalyticsContext,
  product: Product,
) => {
  const price = Number(product.current_price);
  const normalizedPrice =
    Number.isFinite(price) && price > 0 ? toRoundedCurrency(price) : 0;

  return sendCustomerAnalyticsEvent("view_item", {
    ...storeParameters(store),
    currency: "EGP",
    value: normalizedPrice,
    items: [
      {
        item_id: String(product.id),
        item_name: product.name,
        ...(product.category ? { item_category: product.category } : {}),
        price: normalizedPrice,
        quantity: 1,
      },
    ],
  });
};

export const trackCartSelectionChange = ({
  store,
  product,
  previousSelection,
  nextSelection,
}: {
  store: StorefrontAnalyticsContext;
  product: Product;
  previousSelection?: ProductCartSelection;
  nextSelection?: ProductCartSelection;
}) => {
  const previous = previousSelection
    ? toAnalyticsSelection(product, previousSelection)
    : null;
  const next = nextSelection
    ? toAnalyticsSelection(product, nextSelection)
    : null;
  const difference = toRoundedDifference(
    (next?.value ?? 0) - (previous?.value ?? 0),
  );
  const selectionDifference =
    resolveSelectionMetric(nextSelection) -
    resolveSelectionMetric(previousSelection);
  const isAddition =
    Boolean(next) &&
    (!previous || difference > 0 || (difference === 0 && selectionDifference > 0));
  const isRemoval =
    Boolean(previous) &&
    (!next || difference < 0 || (difference === 0 && selectionDifference < 0));

  if (isAddition && next) {
    const addedValue = Math.max(0, difference);
    const quantityDifference =
      next.item.quantity && previous?.item.quantity
        ? Math.max(1, next.item.quantity - previous.item.quantity)
        : next.item.quantity ?? 1;
    return sendCustomerAnalyticsEvent("add_to_cart", {
      ...storeParameters(store),
      currency: "EGP",
      value: addedValue,
      items: [
        {
          ...next.item,
          price: toRoundedCurrency(addedValue / quantityDifference),
          quantity: quantityDifference,
        },
      ],
    });
  }

  if (isRemoval && previous) {
    const removedValue = Math.max(0, Math.abs(difference));
    const quantityDifference =
      previous.item.quantity && next?.item.quantity
        ? Math.max(1, previous.item.quantity - next.item.quantity)
        : previous.item.quantity ?? 1;
    return sendCustomerAnalyticsEvent("remove_from_cart", {
      ...storeParameters(store),
      currency: "EGP",
      value: removedValue,
      items: [
        {
          ...previous.item,
          price: toRoundedCurrency(removedValue / quantityDifference),
          quantity: quantityDifference,
        },
      ],
    });
  }

  return false;
};

export const trackViewCart = (
  store: StorefrontAnalyticsContext,
  draft: StorefrontCartDraft | null,
) =>
  sendCustomerAnalyticsEvent("view_cart", {
    ...storeParameters(store),
    currency: "EGP",
    value: toRoundedCurrency(Number(draft?.estimated_total ?? draft?.subtotal ?? 0)),
    items: toAnalyticsDraftItems(draft),
  });

export const trackBeginCheckout = (
  store: StorefrontAnalyticsContext,
  draft: StorefrontCartDraft | null,
  value: number,
  deliveryFee: number,
) => {
  if (typeof window === "undefined") return false;
  const storageKey = `tijaratk_ga4_begin_checkout:${store.storeId}`;
  try {
    if (window.sessionStorage.getItem(storageKey) === "sent") return false;
  } catch {
    // Session storage may be unavailable; the event remains best effort.
  }

  const sent = sendCustomerAnalyticsEvent("begin_checkout", {
    ...storeParameters(store),
    currency: "EGP",
    value: toRoundedCurrency(value),
    delivery_fee: toRoundedCurrency(deliveryFee),
    items: toAnalyticsDraftItems(draft),
  });
  if (sent) {
    try {
      window.sessionStorage.setItem(storageKey, "sent");
    } catch {
      // Session storage may be unavailable; tracking must never block checkout.
    }
  }
  return sent;
};

export const trackCheckoutError = ({
  store,
  errorField,
  errorType,
  httpStatus,
}: {
  store: StorefrontAnalyticsContext;
  errorField: string;
  errorType: string;
  httpStatus?: number;
}) =>
  sendCustomerAnalyticsEvent("checkout_error", {
    ...storeParameters(store),
    checkout_step: "customer_details",
    error_field: errorField,
    error_type: errorType,
    ...(httpStatus ? { http_status: httpStatus } : {}),
  });

export const trackOrderSubmitted = ({
  store,
  orderId,
  value,
  deliveryFee,
  itemCount,
}: {
  store: StorefrontAnalyticsContext;
  orderId: number;
  value: number;
  deliveryFee: number;
  itemCount: number;
}) =>
  sendCustomerAnalyticsEvent("order_submitted", {
    ...storeParameters(store),
    order_id: String(orderId),
    currency: "EGP",
    value: toRoundedCurrency(value),
    delivery_fee: toRoundedCurrency(deliveryFee),
    items_count: itemCount,
  });
