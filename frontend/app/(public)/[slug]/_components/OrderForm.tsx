"use client";

import {
  Copy,
  Clock3,
  CreditCard,
  Search,
  Store,
  WalletCards,
  X,
} from "lucide-react";
import { useDebounce } from "use-debounce";
import Image from "next/image";
import {
  useActionState,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { FormEvent, InvalidEvent } from "react";
import type {
  Product,
  PublicProductCategory,
  PublicProductsMeta,
} from "@/types/models/product";
import type { Order } from "@/types/models/order";
import type { TenantDeliverySettings } from "@/types/models/tenant";
import type { TenantCategory } from "@/constants";
import type { PublicCustomerProfile } from "@/services/api/customers.service";
import {
  createOrderAction,
  type CreateOrderState,
} from "@/actions/order-actions";
import { OrderSource } from "@/types/enums";
import { useRouter } from "next/navigation";
import {
	markCustomAvailabilityRequestSentAction,
	markAvailabilityRequestSentAction,
	prepareCustomAvailabilityRequestAction,
	prepareAvailabilityRequestAction,
} from "@/actions/availability-request-cookie-actions";
import { productsService } from "@/services/api/products.service";
import { availabilityRequestsService } from "@/services/api/availability-requests.service";
import { getPublicCustomerByPhoneAction } from "@/actions/customer-actions";
import { dedupeByNumericId } from "@/lib/utils/collections";
import { isValidEgyptianCustomerPhone } from "@/lib/utils/phone";
import ProductList, {
	type AvailabilityRequestOutcome,
	type ProductCartSelection,
} from "./ProductList";
import Toast from "./Toast";
import CategoryEntryGrid from "./CategoryEntryGrid";
import CategoryProductsView from "./CategoryProductsView";
import OrderNotesSection from "./OrderNotesSection";
import PrescriptionUploadForm from "./PrescriptionUploadForm";
import DeliveryDetailsSection from "./DeliveryDetailsSection";
import OrderSubmitBar from "./OrderSubmitBar";
import OrderReviewSheet from "./OrderReviewSheet";
import {
  ALL_PRODUCTS_CATEGORY,
  buildInitialCartSelections,
  buildCategoryTabs,
  buildCartItems,
  calculateCartSummary,
  type PaginationState,
} from "../_utils/order-form";
import {
  INSTAPAY_PROVIDER,
} from "@/constants/payment-providers";

const initialState: CreateOrderState = {
  success: false,
  message: "",
  errors: undefined,
  data: undefined,
};

const PAGE_SIZE = 20;
const PRELOAD_THRESHOLD_ITEMS = 5;
const SEARCH_DEBOUNCE_MS = 300;
const STICKY_HEADER_SELECTOR = "[data-store-header]";
const SUBMIT_BAR_SELECTOR = "[data-order-submit-bar]";
const VIEWPORT_SCROLL_MARGIN = 16;
const CUSTOMER_PHONE_SEARCH_MIN_LENGTH = 7;

const DEFAULT_PAGINATION_STATE: PaginationState = {
  page: 1,
  lastPage: 1,
  isLoading: false,
  hasLoaded: false,
  error: null,
};

const normalizeOptionalRequestText = (value: string) => {
	const normalized = value.trim().replace(/\s+/g, " ");
	return normalized || undefined;
};

const normalizeProductSearch = (value: string) => value.trim().replace(/\s+/g, " ");

const buildProductsStateKey = (categoryKey: string, searchTerm: string) =>
  `${categoryKey}::${searchTerm}`;

type PaymentMethod = {
  id: "instapay" | "ewallet";
  label: string;
  providerLabel: string;
  logoSrc: string | null;
  accountName: string;
  accountNumber: string;
};

type ToastState = {
  message: string;
  type: "success" | "error";
};

type OrderFormValidationField =
  | "customer_name"
  | "customer_phone"
  | "delivery_address"
  | "order_request";

type OrderFormValidationErrors = Partial<
  Record<OrderFormValidationField, string[]>
>;

type LandingSource = "directory" | "qr";

type LandingAttributionInput = {
  source?: string;
  areaSlug?: string;
  categorySlug?: string;
  landedAt?: string;
};

type ResolvedLandingAttribution = {
  orderSource: OrderSource.DIRECTORY | OrderSource.STOREFRONT;
  sourceMetadata: {
    landingSource: LandingSource;
    areaSlug?: string;
    categorySlug?: string;
    landedAt: string;
  };
};

const normalizeOptionalAttributionValue = (value?: string) => {
  const normalized = value?.trim();
  return normalized || undefined;
};

const normalizeLandingSource = (source?: string): LandingSource | null => {
  const normalized = source?.trim().toLowerCase();
  if (normalized === "directory" || normalized === "qr") {
    return normalized;
  }

  return null;
};

const resolveLandingAttribution = (
  input?: LandingAttributionInput,
): ResolvedLandingAttribution | null => {
  const landingSource = normalizeLandingSource(input?.source);
  if (!landingSource) {
    return null;
  }

  const areaSlug = normalizeOptionalAttributionValue(input?.areaSlug);
  const categorySlug = normalizeOptionalAttributionValue(input?.categorySlug);
  const landedAt =
    normalizeOptionalAttributionValue(input?.landedAt) ||
    new Date().toISOString();

  return {
    orderSource:
      landingSource === "directory"
        ? OrderSource.DIRECTORY
        : OrderSource.STOREFRONT,
    sourceMetadata: {
      landingSource,
      ...(areaSlug ? { areaSlug } : {}),
      ...(categorySlug ? { categorySlug } : {}),
      landedAt,
    },
  };
};

const parseStoredLandingAttribution = (
  value: string | null,
): ResolvedLandingAttribution | null => {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as ResolvedLandingAttribution;
    const landingSource = parsed.sourceMetadata?.landingSource;
    const landedAt = parsed.sourceMetadata?.landedAt;
    const validOrderSource =
      parsed.orderSource === OrderSource.DIRECTORY ||
      parsed.orderSource === OrderSource.STOREFRONT;

    if (
      !validOrderSource ||
      (landingSource !== "directory" && landingSource !== "qr") ||
      typeof landedAt !== "string"
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
};

const getFirstValidationErrorField = (
  errors: OrderFormValidationErrors,
): OrderFormValidationField | null => {
  if (errors.customer_name) return "customer_name";
  if (errors.customer_phone) return "customer_phone";
  if (errors.delivery_address) return "delivery_address";
  if (errors.order_request) return "order_request";
  return null;
};

const removeValidationError = (
  errors: OrderFormValidationErrors,
  fieldName: OrderFormValidationField,
) => {
  const nextErrors = { ...errors };

  if (fieldName === "customer_name") {
    delete nextErrors.customer_name;
  } else if (fieldName === "customer_phone") {
    delete nextErrors.customer_phone;
  } else if (fieldName === "delivery_address") {
    delete nextErrors.delivery_address;
  } else {
    delete nextErrors.order_request;
  }

  return nextErrors;
};

const getValidationFieldSelector = (fieldName: OrderFormValidationField) => {
  if (fieldName === "customer_name") return '[name="customer_name"]';
  if (fieldName === "customer_phone") return '[name="customer_phone"]';
  if (fieldName === "delivery_address") return '[name="delivery_address"]';
  return '[name="order_request"]';
};

const getCreatedOrderPublicToken = (data: unknown) => {
  if (!data || typeof data !== "object" || !("public_token" in data)) {
    return "";
  }

  const publicToken = (data as { public_token?: unknown }).public_token;
  return typeof publicToken === "string" ? publicToken.trim() : "";
};

type OrderFormProps = {
  tenantSlug: string;
  areaSlug?: string;
  landingAttribution?: LandingAttributionInput;
  isPharmacy?: boolean;
  tenantCategory?: TenantCategory;
  deliverySettings: TenantDeliverySettings;
  initialCategory?: string;
  initialProducts: Product[];
  initialProductsMeta: PublicProductsMeta;
  initialCategories: PublicProductCategory[];
  initialOrder?: Order | null;
  savedCustomerProfile?: {
    name?: string;
    phone: string;
    address?: string;
    notes?: string;
    updated_at: string;
  } | null;
};

export default function OrderForm({
  tenantSlug,
  areaSlug,
  landingAttribution,
  isPharmacy,
  tenantCategory,
  deliverySettings,
  initialCategory,
  initialProducts,
  initialProductsMeta,
  initialCategories,
  initialOrder,
  savedCustomerProfile,
}: OrderFormProps) {
  const router = useRouter();
  const [cartSelections, setCartSelections] = useState<
    Record<number, ProductCartSelection>
  >(() => buildInitialCartSelections(initialOrder));
  const [notes, setNotes] = useState(
    initialOrder?.notes || savedCustomerProfile?.notes || "",
  );
  const [customerName, setCustomerName] = useState(
    initialOrder?.customer?.name || savedCustomerProfile?.name || "",
  );
  const [customerPhone, setCustomerPhone] = useState(
    initialOrder?.customer?.phone || savedCustomerProfile?.phone || "",
  );
  const [deliveryAddress, setDeliveryAddress] = useState(
    initialOrder?.customer?.address || savedCustomerProfile?.address || "",
  );
  const [savedAddressOptions, setSavedAddressOptions] = useState<string[]>([]);
  const [suggestedCustomerProfile, setSuggestedCustomerProfile] =
    useState<PublicCustomerProfile | null>(null);
  const deferredCustomerPhone = useDeferredValue(customerPhone);
  const [orderRequest, setOrderRequest] = useState(
    initialOrder?.free_text_payload?.text || "",
  );
  const [productSearch, setProductSearch] = useState("");
  const [debouncedProductSearch] = useDebounce(
    normalizeProductSearch(productSearch),
    SEARCH_DEBOUNCE_MS,
  );
  const [isPaymentSheetOpen, setIsPaymentSheetOpen] = useState(false);
  const [cardOnDeliveryRequested, setCardOnDeliveryRequested] =
    useState(false);
  const [resolvedLandingAttribution, setResolvedLandingAttribution] =
    useState<ResolvedLandingAttribution | null>(() =>
      resolveLandingAttribution(landingAttribution),
    );
  const [hasPrescription, setHasPrescription] = useState(false);
  const [state, formAction, isPending] = useActionState(
    createOrderAction.bind(null, tenantSlug),
    initialState,
  );

  const resolvedInitialCategory =
    initialCategory &&
    initialCategories.some((c) => c.category === initialCategory)
      ? initialCategory
      : ALL_PRODUCTS_CATEGORY;
  const initialProductsStateKey = buildProductsStateKey(
    resolvedInitialCategory,
    "",
  );

  const [activeCategory, setActiveCategory] = useState(resolvedInitialCategory);
  const [isCategoryProductsView, setIsCategoryProductsView] = useState(
    resolvedInitialCategory !== ALL_PRODUCTS_CATEGORY,
  );
  const [isReviewSheetOpen, setIsReviewSheetOpen] = useState(false);
  const [toastState, setToastState] = useState<ToastState | null>(null);
  const [validationErrors, setValidationErrors] =
    useState<OrderFormValidationErrors>({});
  const [productsByCategory, setProductsByCategory] = useState<
    Record<string, Product[]>
  >({
    [initialProductsStateKey]: initialProducts,
  });
  const [paginationByCategory, setPaginationByCategory] = useState<
    Record<string, PaginationState>
  >({
    [initialProductsStateKey]: {
      page: initialProductsMeta.page,
      lastPage: initialProductsMeta.last_page,
      isLoading: false,
      hasLoaded: true,
      error: null,
    },
  });
  const [knownProductsById, setKnownProductsById] = useState<
    Record<number, Product>
  >(
    () =>
      Object.fromEntries(
        initialProducts.map((product) => [product.id, product]),
      ) as Record<number, Product>,
  );
  const deliveryAvailable = deliverySettings?.delivery_available !== false;
  const cardOnDeliveryAvailable =
    deliverySettings.card_on_delivery_available === true;
  const storeOpen = deliveryAvailable;
  let searchPlaceholder = "ابحث عن منتج";
  if (isPharmacy) {
    searchPlaceholder = "ابحث عن دواء أو مستحضرات تجميل";
  } else if (tenantCategory === "grocery") {
    searchPlaceholder = "ابحث عن منتجات غذائية";
  }
  const activeProductsStateKey = buildProductsStateKey(
    activeCategory,
    debouncedProductSearch,
  );
  const paymentMethods = useMemo<PaymentMethod[]>(() => {
    const methods: PaymentMethod[] = [];
    const instapayName = deliverySettings.instapay_account_name?.trim();
    const instapayNumber = deliverySettings.instapay_account_number?.trim();
    const ewalletName = deliverySettings.ewallet_account_name?.trim();
    const ewalletNumber = deliverySettings.ewallet_account_number?.trim();

    if (instapayName && instapayNumber) {
      methods.push({
        id: "instapay",
        label: "إنستاباي",
        providerLabel: INSTAPAY_PROVIDER.labelAr,
        logoSrc: INSTAPAY_PROVIDER.logoSrc,
        accountName: instapayName,
        accountNumber: instapayNumber,
      });
    }

    if (ewalletName && ewalletNumber) {
      methods.push({
        id: "ewallet",
        label: "محفظة إلكترونية",
        providerLabel: "محفظة إلكترونية",
        logoSrc: null,
        accountName: ewalletName,
        accountNumber: ewalletNumber,
      });
    }

    return methods;
  }, [
    deliverySettings.ewallet_account_name,
    deliverySettings.ewallet_account_number,

    deliverySettings.instapay_account_name,
    deliverySettings.instapay_account_number,
  ]);

  const loadMoreObserver = useRef<IntersectionObserver | null>(null);
  const prefetchTriggeredRef = useRef<Set<string>>(new Set());
  const categoryPillRefs = useRef<Map<string, HTMLElement | null>>(new Map());
  const hasHandledInvalidRef = useRef(false);
  const formRef = useRef<HTMLFormElement | null>(null);
  const reviewTriggerButtonRef = useRef<HTMLButtonElement | null>(null);
  const hasNavigatedToSuccessRef = useRef(false);
  const lastProcessedStateRef = useRef<CreateOrderState | null>(null);

  useEffect(() => {
    const storageKey = `tijaratk:storefront-attribution:${tenantSlug}`;
    const currentAttribution = resolveLandingAttribution(landingAttribution);

    if (currentAttribution) {
      sessionStorage.setItem(storageKey, JSON.stringify(currentAttribution));
      setResolvedLandingAttribution(currentAttribution);
      return;
    }

    const storedAttribution = parseStoredLandingAttribution(
      sessionStorage.getItem(storageKey),
    );
    setResolvedLandingAttribution(storedAttribution);
  }, [
    tenantSlug,
    landingAttribution?.source,
    landingAttribution?.areaSlug,
    landingAttribution?.categorySlug,
    landingAttribution?.landedAt,
  ]);

  const categoryTabs = useMemo(
    () =>
      buildCategoryTabs(
        initialCategories,
        initialProducts,
        initialProductsMeta.total,
      ),
    [initialCategories, initialProducts, initialProductsMeta.total],
  );

  const categoryCards = useMemo(
    () =>
      categoryTabs.filter((category) => category.key !== ALL_PRODUCTS_CATEGORY),
    [categoryTabs],
  );

  const hasMerchantProducts =
    initialProductsMeta.total > 0 ||
    initialProducts.length > 0 ||
    initialCategories.some((category) => category.count > 0);
  const productsByCategoryMap = useMemo(
    () => new Map(Object.entries(productsByCategory)),
    [productsByCategory],
  );
  const paginationByCategoryMap = useMemo(
    () => new Map(Object.entries(paginationByCategory)),
    [paginationByCategory],
  );

  const activeProducts = productsByCategoryMap.get(activeProductsStateKey) || [];
  const activePagination =
    paginationByCategoryMap.get(activeProductsStateKey) ||
    DEFAULT_PAGINATION_STATE;
  const hasMoreInActiveCategory =
    activePagination.page < activePagination.lastPage;
  const activeLoadMoreIndex =
    activeProducts.length === 0
      ? -1
      : Math.max(0, activeProducts.length - (PRELOAD_THRESHOLD_ITEMS + 1));

  const fetchProductsPage = useCallback(
    async (
      categoryKey: string,
      page: number,
      replace: boolean,
      searchTerm = debouncedProductSearch,
    ) => {
      const stateKey = buildProductsStateKey(categoryKey, searchTerm);
      const currentState =
        paginationByCategoryMap.get(stateKey) || DEFAULT_PAGINATION_STATE;
      if (currentState.isLoading) {
        return;
      }

      setPaginationByCategory((prev) => {
        const prevMap = new Map(Object.entries(prev));
        const previousState =
          prevMap.get(stateKey) || DEFAULT_PAGINATION_STATE;
        prevMap.set(stateKey, {
          ...previousState,
          isLoading: true,
          error: null,
        });
        return Object.fromEntries(prevMap);
      });

      const response = await productsService.getPublicProducts(tenantSlug, {
        search: searchTerm || undefined,
        category:
          categoryKey === ALL_PRODUCTS_CATEGORY ? undefined : categoryKey,
        page,
        limit: PAGE_SIZE,
      });

      if (!response.success || !response.data) {
        setPaginationByCategory((prev) => {
          const prevMap = new Map(Object.entries(prev));
          const previousState =
            prevMap.get(stateKey) || DEFAULT_PAGINATION_STATE;
          prevMap.set(stateKey, {
            ...previousState,
            isLoading: false,
            hasLoaded: true,
            error: "تعذر تحميل المنتجات حالياً",
          });
          return Object.fromEntries(prevMap);
        });
        return;
      }

      const nextProducts = response.data.data;
      const nextMeta = response.data.meta;

      setProductsByCategory((prev) => {
        const prevMap = new Map(Object.entries(prev));
        const previousProducts = prevMap.get(stateKey) || [];
        prevMap.set(
          stateKey,
          replace
            ? nextProducts
            : dedupeByNumericId([...previousProducts, ...nextProducts]),
        );
        return Object.fromEntries(prevMap);
      });

      setKnownProductsById((prev) => {
        const nextMap = new Map(
          Object.entries(prev).map(([productId, product]) => [
            Number(productId),
            product,
          ]),
        );
        for (const product of nextProducts) {
          nextMap.set(product.id, product);
        }
        return Object.fromEntries(nextMap) as Record<number, Product>;
      });

      setPaginationByCategory((prev) => {
        const prevMap = new Map(Object.entries(prev));
        prevMap.set(stateKey, {
          page: nextMeta.page,
          lastPage: nextMeta.last_page,
          isLoading: false,
          hasLoaded: true,
          error: null,
        });
        return Object.fromEntries(prevMap);
      });
    },
    [debouncedProductSearch, paginationByCategoryMap, tenantSlug],
  );

  const handleCategoryChange = useCallback(
    (categoryKey: string) => {
      setActiveCategory(categoryKey);

      const stateKey = buildProductsStateKey(
        categoryKey,
        debouncedProductSearch,
      );
      const categoryState =
        paginationByCategoryMap.get(stateKey) || DEFAULT_PAGINATION_STATE;

      if (!categoryState.hasLoaded && !categoryState.isLoading) {
        void fetchProductsPage(categoryKey, 1, true, debouncedProductSearch);
      }
    },
    [
      debouncedProductSearch,
      fetchProductsPage,
      paginationByCategoryMap,
    ],
  );

  const handleCategoryEntry = useCallback(
    (categoryKey: string) => {
      setIsCategoryProductsView(true);
      handleCategoryChange(categoryKey);
    },
    [handleCategoryChange],
  );

  const handleCategoryInViewPrefetch = useCallback(
    (categoryKey: string) => {
      if (categoryKey === ALL_PRODUCTS_CATEGORY || debouncedProductSearch) {
        return;
      }

      if (prefetchTriggeredRef.current.has(categoryKey)) {
        return;
      }

      const stateKey = buildProductsStateKey(
        categoryKey,
        debouncedProductSearch,
      );
      const categoryState =
        paginationByCategoryMap.get(stateKey) || DEFAULT_PAGINATION_STATE;
      if (categoryState.hasLoaded || categoryState.isLoading) {
        return;
      }

      prefetchTriggeredRef.current.add(categoryKey);
      void fetchProductsPage(categoryKey, 1, true, debouncedProductSearch);
    },
    [
      debouncedProductSearch,
      fetchProductsPage,
      paginationByCategoryMap,
    ],
  );

  const scrollActiveCategoryPillIntoView = useCallback(
    (categoryKey: string) => {
      const pillNode = categoryPillRefs.current.get(categoryKey);
      if (!pillNode) {
        return;
      }

      pillNode.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
    },
    [],
  );

  const loadNextPage = useCallback(() => {
    const categoryState =
      paginationByCategoryMap.get(activeProductsStateKey) ||
      DEFAULT_PAGINATION_STATE;

    if (
      categoryState.isLoading ||
      categoryState.page >= categoryState.lastPage
    ) {
      return;
    }

    void fetchProductsPage(
      activeCategory,
      categoryState.page + 1,
      false,
      debouncedProductSearch,
    );
  }, [
    activeCategory,
    activeProductsStateKey,
    debouncedProductSearch,
    fetchProductsPage,
    paginationByCategoryMap,
  ]);

  const setLoadMoreTarget = useCallback(
    (node: HTMLDivElement | null) => {
      if (loadMoreObserver.current) {
        loadMoreObserver.current.disconnect();
      }

      if (!node || !hasMoreInActiveCategory || activePagination.isLoading) {
        return;
      }

      loadMoreObserver.current = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) {
            loadNextPage();
          }
        },
        {
          root: null,
          threshold: 0.5,
          rootMargin: "0px 0px 120px 0px",
        },
      );

      loadMoreObserver.current.observe(node);
    },
    [activePagination.isLoading, hasMoreInActiveCategory, loadNextPage],
  );

  const setCategoryPillRef = useCallback(
    (categoryKey: string, node: HTMLElement | null) => {
      if (node) {
        categoryPillRefs.current.set(categoryKey, node);
        return;
      }

      categoryPillRefs.current.delete(categoryKey);
    },
    [],
  );

  useEffect(() => {
    return () => {
      loadMoreObserver.current?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!hasMerchantProducts) {
      return;
    }

    const stateKey = buildProductsStateKey(
      activeCategory,
      debouncedProductSearch,
    );
    const categoryState =
      paginationByCategoryMap.get(stateKey) || DEFAULT_PAGINATION_STATE;

    if (!categoryState.hasLoaded && !categoryState.isLoading) {
      const timeoutId = window.setTimeout(() => {
        void fetchProductsPage(
          activeCategory,
          1,
          true,
          debouncedProductSearch,
        );
      }, 0);

      return () => window.clearTimeout(timeoutId);
    }
  }, [
    activeCategory,
    debouncedProductSearch,
    fetchProductsPage,
    hasMerchantProducts,
    paginationByCategoryMap,
  ]);

  useEffect(() => {
    if (!state.success || hasNavigatedToSuccessRef.current) {
      return;
    }

    const publicToken = getCreatedOrderPublicToken(state.data);
    if (!publicToken) {
      return;
    }

    hasNavigatedToSuccessRef.current = true;
    router.replace(
      `/${encodeURIComponent(tenantSlug)}/success?token=${encodeURIComponent(
        publicToken,
      )}`,
    );
  }, [router, state.data, state.success, tenantSlug]);


  useEffect(() => {
    if (!isCategoryProductsView) {
      return;
    }

    const raf = requestAnimationFrame(() => {
      scrollActiveCategoryPillIntoView(activeCategory);
    });

    return () => cancelAnimationFrame(raf);
  }, [
    activeCategory,
    isCategoryProductsView,
    scrollActiveCategoryPillIntoView,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const url = new URL(window.location.href);
    if (!isCategoryProductsView || activeCategory === ALL_PRODUCTS_CATEGORY) {
      url.searchParams.delete("category");
    } else {
      url.searchParams.set("category", activeCategory);
    }

    window.history.replaceState(null, "", url.toString());
  }, [activeCategory, isCategoryProductsView]);

  useEffect(() => {
    if (savedCustomerProfile || initialOrder?.customer) {
      return;
    }

    const normalizedPhone = deferredCustomerPhone.trim();
    if (normalizedPhone.length < CUSTOMER_PHONE_SEARCH_MIN_LENGTH) {
      return;
    }

    let isCurrent = true;

    const searchCustomer = async () => {
      const response = await getPublicCustomerByPhoneAction({
        slug: tenantSlug,
        phone: normalizedPhone,
      });

      if (!isCurrent) {
        return;
      }

      if (!response.success || !response.data) {
        setSuggestedCustomerProfile(null);
        setSavedAddressOptions([]);
        return;
      }

      const addresses = response.data.addresses || [];

      setSuggestedCustomerProfile(response.data);
      setSavedAddressOptions(addresses);
    };

    void searchCustomer();

    return () => {
      isCurrent = false;
    };
  }, [
    deferredCustomerPhone,
    initialOrder?.customer,
    savedCustomerProfile,
    tenantSlug,
  ]);

  const applySuggestedCustomerDetails = useCallback(
    () => {
      if (!suggestedCustomerProfile) {
        return;
      }

      setCustomerName((prev) => prev || suggestedCustomerProfile.name || "");
      setNotes((prev) => prev || suggestedCustomerProfile.notes || "");
      if (suggestedCustomerProfile.addresses.length === 1) {
        setDeliveryAddress(
          (prev) => prev || suggestedCustomerProfile.addresses[0] || "",
        );
      }
    },
    [suggestedCustomerProfile],
  );

  const handleSavedAddressSelect = useCallback(
    (address: string) => {
      if (suggestedCustomerProfile) {
        setCustomerName((prev) => prev || suggestedCustomerProfile.name || "");
        setNotes((prev) => prev || suggestedCustomerProfile.notes || "");
      }
      setDeliveryAddress(address);
    },
    [suggestedCustomerProfile],
  );

  const handleCustomerPhoneChange = useCallback((value: string) => {
    setCustomerPhone(value);
    setSuggestedCustomerProfile(null);
    setSavedAddressOptions([]);
  }, []);

  const handleUpdateSelection = (
    product: Product,
    selection: ProductCartSelection | null,
  ) => {
    if (!product.is_available) {
      return;
    }

    setCartSelections((prev) => {
      if (!selection) {
        const next = { ...prev };
        delete next[product.id];
        return next;
      }

      const previousItemNote = prev[product.id]?.item_note;
      const nextItemNote =
        selection.item_note !== undefined
          ? selection.item_note
          : previousItemNote;

      return {
        ...prev,
        [product.id]: {
          ...selection,
          item_note: nextItemNote,
        },
      };
    });
  };

  const handleProductAdded = () => {
    setToastState({ message: "تمت الإضافة", type: "success" });
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.vibrate === "function"
    ) {
      navigator.vibrate(10);
    }
  };

  const handleCopyPaymentNumber = useCallback(async (method: PaymentMethod) => {
    try {
      await navigator.clipboard.writeText(method.accountNumber);
      setToastState({ message: "تم نسخ الرقم", type: "success" });
    } catch {
      setToastState({ message: "تعذر نسخ الرقم", type: "error" });
    }
  }, []);

  const getViewportOffsets = useCallback(() => {
    const stickyHeader = document.querySelector<HTMLElement>(
      STICKY_HEADER_SELECTOR,
    );
    const submitBar = document.querySelector<HTMLElement>(SUBMIT_BAR_SELECTOR);
    const safeTop =
      (stickyHeader?.getBoundingClientRect().height || 0) +
      VIEWPORT_SCROLL_MARGIN;
    const desiredSafeBottom =
      window.innerHeight -
      (submitBar?.getBoundingClientRect().height || 0) -
      VIEWPORT_SCROLL_MARGIN;
    const safeBottom = Math.max(safeTop + 120, desiredSafeBottom);
    return { safeTop, safeBottom };
  }, []);

  const keepElementVisibleInViewport = useCallback(
    (element: HTMLElement, behavior: ScrollBehavior) => {
      const { safeTop, safeBottom } = getViewportOffsets();
      const rect = element.getBoundingClientRect();
      let targetTop: number | null = null;

      if (rect.top < safeTop) {
        targetTop = window.scrollY + rect.top - safeTop;
      } else if (rect.bottom > safeBottom) {
        targetTop = window.scrollY + rect.bottom - safeBottom;
      }

      if (targetTop === null) {
        return;
      }

      window.scrollTo({
        top: Math.max(0, targetTop),
        behavior,
      });
    },
    [getViewportOffsets],
  );

  const handleRequestAvailability = useCallback(
    async (product: Product): Promise<AvailabilityRequestOutcome> => {
      if (product.is_available) {
        return "failed";
      }

      const prepared = await prepareAvailabilityRequestAction({
        slug: tenantSlug,
        product_id: product.id,
      });

      if (!prepared.success || !prepared.visitor_key) {
        setToastState({
          message: prepared.message || "تعذر إرسال الطلب حالياً",
          type: "error",
        });
        return "failed";
      }

      if (prepared.already_requested_today) {
        setToastState({
          message: "سبق وسجلنا طلبك لهذا المنتج اليوم",
          type: "success",
        });
        return "already_requested_today";
      }

      const response = await availabilityRequestsService.createPublicRequest(
        tenantSlug,
        {
          product_id: product.id,
          visitor_key: prepared.visitor_key,
					customer_name: normalizeOptionalRequestText(customerName),
					customer_phone: normalizeOptionalRequestText(customerPhone),
					customer_address: normalizeOptionalRequestText(deliveryAddress),
					customer_notes: normalizeOptionalRequestText(notes),
        },
      );

      if (!response.success || !response.data) {
        setToastState({
          message: response.message || "تعذر إرسال الطلب حالياً",
          type: "error",
        });
        return "failed";
      }

      await markAvailabilityRequestSentAction({
        slug: tenantSlug,
        product_id: product.id,
        date_key: prepared.date_key,
      });

      if (response.data.status === "created") {
        setToastState({ message: "تم إرسال طلبك للتاجر", type: "success" });
      } else {
        setToastState({
          message: "سبق وسجلنا طلبك لهذا المنتج اليوم",
          type: "success",
        });
      }

      return response.data.status;
    },
    [customerName, customerPhone, deliveryAddress, notes, tenantSlug],
  );

	const handleRequestCustomAvailability = useCallback(
		async (requestedProductName: string): Promise<AvailabilityRequestOutcome> => {
			const prepared = await prepareCustomAvailabilityRequestAction({
				slug: tenantSlug,
				requested_product_name: requestedProductName,
			});

			if (!prepared.success || !prepared.visitor_key) {
				setToastState({
					message: prepared.message || "تعذر إرسال الطلب حالياً",
					type: "error",
				});
				return "failed";
			}

			if (prepared.already_requested_today) {
				setToastState({
					message: "سبق وسجلنا طلبك لهذا المنتج اليوم",
					type: "success",
				});
				return "already_requested_today";
			}

			const response = await availabilityRequestsService.createPublicRequest(
				tenantSlug,
				{
					requested_product_name: prepared.requested_product_name,
					visitor_key: prepared.visitor_key,
					customer_name: normalizeOptionalRequestText(customerName),
					customer_phone: normalizeOptionalRequestText(customerPhone),
					customer_address: normalizeOptionalRequestText(deliveryAddress),
					customer_notes: normalizeOptionalRequestText(notes),
				},
			);

			if (!response.success || !response.data) {
				setToastState({
					message: response.message || "تعذر إرسال الطلب حالياً",
					type: "error",
				});
				return "failed";
			}

			await markCustomAvailabilityRequestSentAction({
				slug: tenantSlug,
				requested_product_name: prepared.requested_product_name,
				date_key: prepared.date_key,
			});

			if (response.data.status === "created") {
				setToastState({ message: "تم إرسال طلبك للتاجر", type: "success" });
			} else {
				setToastState({
					message: "سبق وسجلنا طلبك لهذا المنتج اليوم",
					type: "success",
				});
			}

			return response.data.status;
		},
		[customerName, customerPhone, deliveryAddress, notes, tenantSlug],
	);

  const handleReviewSelectionUpdate = useCallback(
    (productId: number, nextSelection: ProductCartSelection | null) => {
      setCartSelections((prev) => {
        const nextMap = new Map<number, ProductCartSelection>(
          Object.entries(prev).map(([id, selection]) => [
            Number(id),
            selection,
          ]),
        );

        if (!nextSelection) {
          nextMap.delete(productId);
          return Object.fromEntries(nextMap) as Record<
            number,
            ProductCartSelection
          >;
        }

        nextMap.set(productId, nextSelection);
        return Object.fromEntries(nextMap) as Record<
          number,
          ProductCartSelection
        >;
      });
    },
    [],
  );

  const knownProductsByIdMap = useMemo(
    () =>
      new Map(
        Object.entries(knownProductsById).map(([productId, product]) => [
          Number(productId),
          product,
        ]),
      ),
    [knownProductsById],
  );

  const effectiveCartSelections = useMemo(() => {
    const effectiveSelectionEntries = Object.entries(cartSelections).flatMap(
      ([productId, selection]) => {
        const parsedProductId = Number(productId);
        const product = knownProductsByIdMap.get(parsedProductId);
        if (product?.is_available === false) {
          return [];
        }

        return [[parsedProductId, selection]] as Array<
          [number, ProductCartSelection]
        >;
      },
    );

    return Object.fromEntries(effectiveSelectionEntries) as Record<
      number,
      ProductCartSelection
    >;
  }, [cartSelections, knownProductsByIdMap]);

  const { totalItems, estimatedTotal, hasPricedItems } = useMemo(
    () => calculateCartSummary(effectiveCartSelections, knownProductsById),
    [effectiveCartSelections, knownProductsById],
  );

  const cartItems = useMemo(
    () =>
      buildCartItems(effectiveCartSelections, knownProductsById).filter(
        (item) => {
          const product = knownProductsByIdMap.get(item.product_id);
          return product ? product.is_available !== false : true;
        },
      ),
    [effectiveCartSelections, knownProductsById, knownProductsByIdMap],
  );

  const displayedErrors = useMemo(
    () => ({
      ...validationErrors,
      ...(state.errors ?? {}),
    }),
    [state.errors, validationErrors],
  );

  const clearValidationError = useCallback((fieldName: OrderFormValidationField) => {
    setValidationErrors((currentErrors) => {
      const nextErrors = removeValidationError(currentErrors, fieldName);
      if (nextErrors === currentErrors) {
        return currentErrors;
      }

      return nextErrors;
    });
  }, []);

  const focusOrderFormField = useCallback(
    (
      fieldName: OrderFormValidationField,
      behavior: ScrollBehavior = "smooth",
    ) => {
      requestAnimationFrame(() => {
        const inputNode = document.querySelector(
          getValidationFieldSelector(fieldName),
        );
        if (inputNode instanceof HTMLElement) {
          inputNode.focus({ preventScroll: true });
          keepElementVisibleInViewport(inputNode, behavior);
        }
      });
    },
    [keepElementVisibleInViewport],
  );

  const validateBeforeReview = useCallback(() => {
    const nextErrors: OrderFormValidationErrors = {};

    if (customerName.trim().length < 2) {
      nextErrors.customer_name = ["اكتب اسمك على الأقل حرفين"];
    }

    if (!isValidEgyptianCustomerPhone(customerPhone)) {
      nextErrors.customer_phone = ["اكتب رقم هاتف صحيح"];
    }

    if (deliveryAddress.trim().length < 5) {
      nextErrors.delivery_address = ["اكتب عنوان توصيل واضح"];
    }

    if (totalItems === 0 && !orderRequest.trim() && !hasPrescription) {
      nextErrors.order_request = ["اختر منتجاً أو اكتب طلبك هنا"];
    }

    setValidationErrors(nextErrors);
    return nextErrors;
  }, [
    customerName,
    customerPhone,
    deliveryAddress,
    hasPrescription,
    orderRequest,
    totalItems,
  ]);

  const closeReviewSheet = useCallback((restoreFocus = true) => {
    setIsReviewSheetOpen(false);
    if (!restoreFocus) {
      return;
    }

    requestAnimationFrame(() => {
      reviewTriggerButtonRef.current?.focus();
    });
  }, []);

  const openReviewSheet = useCallback(() => {
    if (isPending) {
      return;
    }

    hasHandledInvalidRef.current = false;
    const nextErrors = validateBeforeReview();
    const firstErrorField = getFirstValidationErrorField(nextErrors);

    if (firstErrorField) {
      setToastState({
        message: "يرجى تصحيح الأخطاء في البيانات المدخلة",
        type: "error",
      });
      focusOrderFormField(firstErrorField);
      return;
    }

    setIsReviewSheetOpen(true);
  }, [focusOrderFormField, isPending, validateBeforeReview]);

  const handleFormSubmitCapture = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      hasHandledInvalidRef.current = false;

      const nativeEvent = event.nativeEvent;
      const submitter =
        nativeEvent instanceof SubmitEvent ? nativeEvent.submitter : null;
      const isReviewConfirm =
        submitter instanceof HTMLElement &&
        submitter.hasAttribute("data-review-confirm-submit");

      if (isReviewConfirm) {
        return;
      }

      event.preventDefault();
      openReviewSheet();
    },
    [openReviewSheet],
  );

  const handleFormInvalidCapture = useCallback(
    (event: InvalidEvent<HTMLFormElement>) => {
      if (hasHandledInvalidRef.current) {
        return;
      }

      const invalidElement = event.target;
      if (!(invalidElement instanceof HTMLElement)) {
        return;
      }

      hasHandledInvalidRef.current = true;
      invalidElement.focus({ preventScroll: true });
      keepElementVisibleInViewport(invalidElement, "auto");
    },
    [keepElementVisibleInViewport],
  );

  const handleEditManualRequestFromSheet = useCallback(() => {
    closeReviewSheet(false);

    requestAnimationFrame(() => {
      const targetSection = document.getElementById("order-notes");
      if (targetSection) {
        const { safeTop } = getViewportOffsets();
        const sectionTop =
          window.scrollY + targetSection.getBoundingClientRect().top;
        window.scrollTo({
          top: Math.max(0, sectionTop - safeTop),
          behavior: "smooth",
        });
      }

      const textarea = document.getElementById(
        "order-request-textarea",
      ) as HTMLTextAreaElement | null;
      if (!textarea) {
        return;
      }

      textarea.focus({ preventScroll: true });
      keepElementVisibleInViewport(textarea, "smooth");
    });
  }, [closeReviewSheet, getViewportOffsets, keepElementVisibleInViewport]);

  useEffect(() => {
    if (isPending) {
      hasHandledInvalidRef.current = false;
      return;
    }

    if (!state.success && (state.errors || state.message)) {
      if (lastProcessedStateRef.current === state) {
        return;
      }
      lastProcessedStateRef.current = state;

      closeReviewSheet(false);

      if (state.errors) {
        setToastState({
          message: "يرجى تصحيح الأخطاء في البيانات المدخلة",
          type: "error",
        });

        const firstErrorField = Object.keys(state.errors)[0];
        if (firstErrorField) {
          requestAnimationFrame(() => {
            const inputNode = document.querySelector(
              `[name="${firstErrorField}"]`,
            );
            if (inputNode instanceof HTMLElement) {
              inputNode.focus({ preventScroll: true });
              keepElementVisibleInViewport(inputNode, "smooth");
            }
          });
        }
      } else if (state.message) {
        setToastState({
          message: state.message,
          type: "error",
        });
      }
    }
  }, [state, isPending, closeReviewSheet, keepElementVisibleInViewport]);

  return (
    <>
      {toastState && (
        <Toast
          message={toastState.message}
          type={toastState.type}
          position="bottom"
          duration={1400}
          onClose={() => setToastState(null)}
        />
      )}
      <form
        ref={formRef}
        action={formAction}
        onSubmitCapture={handleFormSubmitCapture}
        onInvalidCapture={handleFormInvalidCapture}
      >
        <input type="hidden" name="cart" value={JSON.stringify(cartItems)} />
        {areaSlug && (
          <input type="hidden" name="delivery_area_slug" value={areaSlug} />
        )}
        {resolvedLandingAttribution && (
          <>
            <input
              type="hidden"
              name="order_source"
              value={resolvedLandingAttribution.orderSource}
            />
            <input
              type="hidden"
              name="source_metadata"
              value={JSON.stringify(
                resolvedLandingAttribution.sourceMetadata,
              )}
            />
          </>
        )}
        {cardOnDeliveryAvailable && cardOnDeliveryRequested && (
          <input type="hidden" name="card_on_delivery_requested" value="true" />
        )}

        <div className="px-4 pt-4">
          <label className="relative block">
            <span className="sr-only">البحث عن منتج</span>
            <Search
              className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              type="search"
              value={productSearch}
              onChange={(event) => {
                const nextSearch = event.target.value;
                setProductSearch(nextSearch);
                if (normalizeProductSearch(nextSearch)) {
                  setIsCategoryProductsView(true);
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                }
              }}
              placeholder={searchPlaceholder}
              className="h-14 w-full rounded-full border border-brand-border bg-white pr-12 pl-4 text-right text-base text-brand-text shadow-soft outline-none transition-shadow placeholder:text-muted-foreground focus:ring-4 focus:ring-brand-accent/20"
              dir="rtl"
            />
          </label>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold ${
                storeOpen
                  ? "border-emerald-200 bg-emerald-50 text-brand-primary"
                  : "border-status-error/20 bg-status-error/10 text-status-error"
              }`}
            >
              <Store className="h-4 w-4" aria-hidden="true" />
              {storeOpen ? "مفتوح الآن" : "مغلق حالياً"}
            </span>
            <span className="inline-flex min-h-10 items-center gap-2 rounded-full border border-brand-border bg-white px-3 py-2 text-sm font-semibold text-brand-text">
              <Clock3 className="h-4 w-4" aria-hidden="true" />
              {deliveryAvailable ? "التوصيل خلال 30-45 دقيقة" : "التوصيل غير متاح"}
            </span>
            <button
              type="button"
              onClick={() => setIsPaymentSheetOpen(true)}
              className="inline-flex min-h-10 items-center gap-2 rounded-full border border-brand-border bg-white px-3 py-2 text-sm font-semibold text-brand-text shadow-sm transition-colors hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/20"
            >
              <WalletCards className="h-4 w-4" aria-hidden="true" />
              طرق الدفع
            </button>
          </div>
        </div>

        {hasMerchantProducts && (
          <div className="mt-4 space-y-4">
            {!isCategoryProductsView && (
              <>
                <CategoryEntryGrid
                  categoryCards={categoryCards}
                  onSelectCategory={handleCategoryEntry}
                  onShowAll={() => handleCategoryEntry(ALL_PRODUCTS_CATEGORY)}
                  onCategoryInView={handleCategoryInViewPrefetch}
                />
                <ProductList
                  products={[]}
                  selections={effectiveCartSelections}
                  onUpdateSelection={(product, selection) => {
                    clearValidationError("order_request");
                    handleUpdateSelection(product, selection);
                  }}
                  onRequestCustomAvailability={handleRequestCustomAvailability}
                />
              </>
            )}

            {isCategoryProductsView && (
              <CategoryProductsView
                categoryTabs={categoryTabs}
                activeCategory={activeCategory}
                searchTerm={debouncedProductSearch}
                activeProducts={activeProducts}
                activePagination={activePagination}
                hasMoreInActiveCategory={hasMoreInActiveCategory}
                activeLoadMoreIndex={activeLoadMoreIndex}
                cartSelections={effectiveCartSelections}
                onBack={() => setIsCategoryProductsView(false)}
                onCategoryChange={handleCategoryChange}
                setCategoryPillRef={setCategoryPillRef}
                onUpdateSelection={(product, selection) => {
                  clearValidationError("order_request");
                  handleUpdateSelection(product, selection);
                }}
                onProductAdded={handleProductAdded}
                onRequestAvailability={handleRequestAvailability}
                onRequestCustomAvailability={handleRequestCustomAvailability}
                setLoadMoreTarget={setLoadMoreTarget}
              />
            )}
          </div>
        )}

				{!hasMerchantProducts && (
					<div className="mt-4">
						<ProductList
							products={[]}
							selections={effectiveCartSelections}
							onUpdateSelection={(product, selection) => {
								clearValidationError("order_request");
								handleUpdateSelection(product, selection);
							}}
							onRequestCustomAvailability={handleRequestCustomAvailability}
						/>
					</div>
				)}

        <OrderNotesSection
          isPharmacy={isPharmacy}
          orderRequest={orderRequest}
          onOrderRequestChange={(value) => {
            clearValidationError("order_request");
            setOrderRequest(value);
          }}
          error={displayedErrors.order_request?.[0]}
        />

        {isPharmacy && (
          <PrescriptionUploadForm 
            onFileChange={(hasFile) => {
              clearValidationError("order_request");
              setHasPrescription(hasFile);
            }}
          />
        )}

        <DeliveryDetailsSection
          deliverySettings={deliverySettings}
          customerName={customerName}
          customerPhone={customerPhone}
          deliveryAddress={deliveryAddress}
          suggestedCustomerProfile={suggestedCustomerProfile}
          savedAddressOptions={savedAddressOptions}
          notes={notes}
          onCustomerNameChange={(value) => {
            clearValidationError("customer_name");
            setCustomerName(value);
          }}
          onCustomerPhoneChange={(value) => {
            clearValidationError("customer_phone");
            handleCustomerPhoneChange(value);
          }}
          onDeliveryAddressChange={(value) => {
            clearValidationError("delivery_address");
            setDeliveryAddress(value);
          }}
          onUseSavedCustomerProfile={() => {
            clearValidationError("customer_name");
            clearValidationError("delivery_address");
            applySuggestedCustomerDetails();
          }}
          onSavedAddressSelect={(address) => {
            clearValidationError("delivery_address");
            handleSavedAddressSelect(address);
          }}
          onNotesChange={setNotes}
          errors={displayedErrors}
          message={state.message}
          success={state.success}
        />

        <OrderSubmitBar
          totalItems={totalItems}
          hasPricedItems={hasPricedItems}
          estimatedTotal={estimatedTotal}
          orderRequest={orderRequest}
          isPending={isPending}
          deliveryAvailable={deliveryAvailable}
          hasPrescription={hasPrescription}
          onSubmitClick={openReviewSheet}
          triggerButtonRef={reviewTriggerButtonRef}
        />

        <OrderReviewSheet
          isOpen={isReviewSheetOpen}
          isPending={isPending}
          totalItems={totalItems}
          estimatedTotal={estimatedTotal}
          hasPricedItems={hasPricedItems}
          orderRequest={orderRequest}
          deliveryAvailable={deliveryAvailable}
          hasPrescription={hasPrescription}
          selections={effectiveCartSelections}
          knownProductsById={knownProductsById}
          onClose={() => closeReviewSheet(true)}
          onEditManualRequest={handleEditManualRequestFromSheet}
          onUpdateSelection={handleReviewSelectionUpdate}
        />
      </form>

      {isPaymentSheetOpen && (
        <div
          className="fixed inset-0 z-75 flex items-end bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby="payment-method-title"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="إغلاق تفاصيل الدفع"
            onClick={() => setIsPaymentSheetOpen(false)}
          />
          <div className="relative max-h-[88vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl">
            <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-gray-200" />
            <div className="flex items-start justify-between gap-4">
              <div>
                <p
                  id="payment-method-title"
                  className="text-lg font-bold text-brand-text"
                >
                  طرق الدفع
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  كل طرق الدفع المتاحة لهذا المتجر
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPaymentSheetOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-brand-border text-brand-text focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/20"
                aria-label="إغلاق"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {paymentMethods.length === 0 && (
                <div className="rounded-2xl border border-dashed border-brand-border bg-brand-soft/40 p-4 text-sm text-muted-foreground">
                  لم يضف المتجر بيانات دفع إلكترونية بعد.
                </div>
              )}

              {paymentMethods.map((method) => (
                <div
                  key={method.id}
                  className="rounded-2xl border border-brand-border bg-brand-soft/40 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-bold text-brand-text">
                        {method.label}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-muted-foreground">
                        {method.providerLabel}
                      </p>
                    </div>
                    {method.logoSrc ? (
                      <Image
                        src={method.logoSrc}
                        alt={method.providerLabel}
                        width={92}
                        height={36}
                        className="h-9 w-auto object-contain"
                      />
                    ) : (
                      <span className="rounded-md bg-white px-3 py-1 text-sm font-black tracking-wide text-[#4B2383]">
                        {method.providerLabel}
                      </span>
                    )}
                  </div>

                  <div className="mt-4 grid gap-3 rounded-xl bg-white p-3">
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground">
                        الاسم
                      </p>
                      <p className="mt-1 text-base font-bold text-brand-text">
                        {method.accountName}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground">
                        الرقم أو الحساب
                      </p>
                      <p className="mt-1 text-base font-bold text-brand-text" dir="ltr">
                        {method.accountNumber}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopyPaymentNumber(method)}
                    className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-brand-border bg-white px-4 py-2 text-sm font-bold text-brand-text transition-colors hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/20"
                  >
                    <Copy className="h-4 w-4" aria-hidden="true" />
                    نسخ الرقم
                  </button>
                </div>
              ))}
            </div>

            {cardOnDeliveryAvailable && (
              <label
                className={`mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors ${
                  cardOnDeliveryRequested
                    ? "border-brand-primary bg-brand-soft"
                    : "border-brand-border bg-white"
                }`}
              >
                <input
                  type="checkbox"
                  checked={cardOnDeliveryRequested}
                  onChange={(event) =>
                    setCardOnDeliveryRequested(event.target.checked)
                  }
                  className="mt-1 h-5 w-5 rounded border-brand-border text-brand-primary focus:ring-brand-accent"
                />
                <span className="flex-1">
                  <span className="flex items-center gap-2 text-sm font-bold text-brand-text">
                    <CreditCard className="h-4 w-4" aria-hidden="true" />
                    أطلب الدفع بالكارت مع التوصيل
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    سنبلغ التاجر أنك تفضل الدفع بالكارت عند وصول الطلب.
                  </span>
                </span>
              </label>
            )}
          </div>
        </div>
      )}
    </>
  );
}
