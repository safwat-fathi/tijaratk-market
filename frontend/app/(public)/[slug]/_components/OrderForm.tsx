"use client";

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
import type { PublicCustomerProfile } from "@/services/api/customers.service";
import {
  createOrderAction,
  type CreateOrderState,
} from "@/actions/order-actions";
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

const initialState: CreateOrderState = {
  success: false,
  message: "",
  errors: undefined,
  data: undefined,
};

const PAGE_SIZE = 20;
const PRELOAD_THRESHOLD_ITEMS = 5;
const STICKY_HEADER_SELECTOR = "[data-store-header]";
const SUBMIT_BAR_SELECTOR = "[data-order-submit-bar]";
const VIEWPORT_SCROLL_MARGIN = 16;
const CUSTOMER_PHONE_SEARCH_MIN_LENGTH = 7;

const DEFAULT_PAGINATION_STATE: PaginationState = {
  page: 1,
  lastPage: 1,
  isLoading: false,
  error: null,
};

const normalizeOptionalRequestText = (value: string) => {
	const normalized = value.trim().replace(/\s+/g, " ");
	return normalized || undefined;
};

type ToastState = {
  message: string;
  type: "success" | "error";
};

type OrderFormProps = {
  tenantSlug: string;
  areaSlug?: string;
  isPharmacy?: boolean;
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
  isPharmacy,
  deliverySettings,
  initialCategory,
  initialProducts,
  initialProductsMeta,
  initialCategories,
  initialOrder,
  savedCustomerProfile,
}: OrderFormProps) {
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
  const [state, formAction, isPending] = useActionState(
    createOrderAction.bind(null, tenantSlug),
    initialState,
  );

  const resolvedInitialCategory =
    initialCategory &&
    initialCategories.some((c) => c.category === initialCategory)
      ? initialCategory
      : ALL_PRODUCTS_CATEGORY;

  const [activeCategory, setActiveCategory] = useState(resolvedInitialCategory);
  const [isCategoryProductsView, setIsCategoryProductsView] = useState(
    resolvedInitialCategory !== ALL_PRODUCTS_CATEGORY,
  );
  const [isReviewSheetOpen, setIsReviewSheetOpen] = useState(false);
  const [toastState, setToastState] = useState<ToastState | null>(null);
  const [productsByCategory, setProductsByCategory] = useState<
    Record<string, Product[]>
  >({
    [resolvedInitialCategory]: initialProducts,
  });
  const [paginationByCategory, setPaginationByCategory] = useState<
    Record<string, PaginationState>
  >({
    [resolvedInitialCategory]: {
      page: initialProductsMeta.page,
      lastPage: initialProductsMeta.last_page,
      isLoading: false,
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

  const loadMoreObserver = useRef<IntersectionObserver | null>(null);
  const prefetchTriggeredRef = useRef<Set<string>>(new Set());
  const categoryPillRefs = useRef<Map<string, HTMLElement | null>>(new Map());
  const hasHandledInvalidRef = useRef(false);
  const formRef = useRef<HTMLFormElement | null>(null);
  const reviewTriggerButtonRef = useRef<HTMLButtonElement | null>(null);

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

  const activeProducts = productsByCategoryMap.get(activeCategory) || [];
  const activePagination =
    paginationByCategoryMap.get(activeCategory) || DEFAULT_PAGINATION_STATE;
  const hasMoreInActiveCategory =
    activePagination.page < activePagination.lastPage;
  const activeLoadMoreIndex =
    activeProducts.length === 0
      ? -1
      : Math.max(0, activeProducts.length - (PRELOAD_THRESHOLD_ITEMS + 1));

  const fetchProductsPage = useCallback(
    async (categoryKey: string, page: number, replace: boolean) => {
      const currentState =
        paginationByCategoryMap.get(categoryKey) || DEFAULT_PAGINATION_STATE;
      if (currentState.isLoading) {
        return;
      }

      setPaginationByCategory((prev) => {
        const prevMap = new Map(Object.entries(prev));
        const previousState =
          prevMap.get(categoryKey) || DEFAULT_PAGINATION_STATE;
        prevMap.set(categoryKey, {
          ...previousState,
          isLoading: true,
          error: null,
        });
        return Object.fromEntries(prevMap);
      });

      const response = await productsService.getPublicProducts(tenantSlug, {
        category:
          categoryKey === ALL_PRODUCTS_CATEGORY ? undefined : categoryKey,
        page,
        limit: PAGE_SIZE,
      });

      if (!response.success || !response.data) {
        setPaginationByCategory((prev) => {
          const prevMap = new Map(Object.entries(prev));
          const previousState =
            prevMap.get(categoryKey) || DEFAULT_PAGINATION_STATE;
          prevMap.set(categoryKey, {
            ...previousState,
            isLoading: false,
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
        const previousProducts = prevMap.get(categoryKey) || [];
        prevMap.set(
          categoryKey,
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
        prevMap.set(categoryKey, {
          page: nextMeta.page,
          lastPage: nextMeta.last_page,
          isLoading: false,
          error: null,
        });
        return Object.fromEntries(prevMap);
      });
    },
    [paginationByCategoryMap, tenantSlug],
  );

  const handleCategoryChange = useCallback(
    (categoryKey: string) => {
      setActiveCategory(categoryKey);

      const hasData = (productsByCategoryMap.get(categoryKey) || []).length > 0;
      const categoryState =
        paginationByCategoryMap.get(categoryKey) || DEFAULT_PAGINATION_STATE;

      if (!hasData && !categoryState.isLoading) {
        void fetchProductsPage(categoryKey, 1, true);
      }
    },
    [fetchProductsPage, paginationByCategoryMap, productsByCategoryMap],
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
      if (categoryKey === ALL_PRODUCTS_CATEGORY) {
        return;
      }

      if (prefetchTriggeredRef.current.has(categoryKey)) {
        return;
      }

      const hasData = (productsByCategoryMap.get(categoryKey) || []).length > 0;
      const categoryState =
        paginationByCategoryMap.get(categoryKey) || DEFAULT_PAGINATION_STATE;
      if (hasData || categoryState.isLoading) {
        return;
      }

      prefetchTriggeredRef.current.add(categoryKey);
      void fetchProductsPage(categoryKey, 1, true);
    },
    [fetchProductsPage, paginationByCategoryMap, productsByCategoryMap],
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
      paginationByCategoryMap.get(activeCategory) || DEFAULT_PAGINATION_STATE;

    if (
      categoryState.isLoading ||
      categoryState.page >= categoryState.lastPage
    ) {
      return;
    }

    void fetchProductsPage(activeCategory, categoryState.page + 1, false);
  }, [activeCategory, fetchProductsPage, paginationByCategoryMap]);

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
    const formNode = formRef.current;
    if (!formNode) {
      return;
    }

    const isValid = formNode.reportValidity();
    if (!isValid) {
      return;
    }

    setIsReviewSheetOpen(true);
  }, [isPending]);

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
                  onUpdateSelection={handleUpdateSelection}
                  onRequestCustomAvailability={handleRequestCustomAvailability}
                />
              </>
            )}

            {isCategoryProductsView && (
              <CategoryProductsView
                categoryTabs={categoryTabs}
                activeCategory={activeCategory}
                activeProducts={activeProducts}
                activePagination={activePagination}
                hasMoreInActiveCategory={hasMoreInActiveCategory}
                activeLoadMoreIndex={activeLoadMoreIndex}
                cartSelections={effectiveCartSelections}
                onBack={() => setIsCategoryProductsView(false)}
                onCategoryChange={handleCategoryChange}
                setCategoryPillRef={setCategoryPillRef}
                onUpdateSelection={handleUpdateSelection}
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
							onUpdateSelection={handleUpdateSelection}
							onRequestCustomAvailability={handleRequestCustomAvailability}
						/>
					</div>
				)}

        <OrderNotesSection
          isPharmacy={isPharmacy}
          orderRequest={orderRequest}
          onOrderRequestChange={setOrderRequest}
          error={state.errors?.order_request?.[0]}
        />

        {isPharmacy && (
          <PrescriptionUploadForm tenantSlug={tenantSlug} />
        )}

        <DeliveryDetailsSection
          deliverySettings={deliverySettings}
          customerName={customerName}
          customerPhone={customerPhone}
          deliveryAddress={deliveryAddress}
          suggestedCustomerProfile={suggestedCustomerProfile}
          savedAddressOptions={savedAddressOptions}
          notes={notes}
          onCustomerNameChange={setCustomerName}
          onCustomerPhoneChange={handleCustomerPhoneChange}
          onDeliveryAddressChange={setDeliveryAddress}
          onUseSavedCustomerProfile={applySuggestedCustomerDetails}
          onSavedAddressSelect={handleSavedAddressSelect}
          onNotesChange={setNotes}
          errors={state.errors}
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
          selections={effectiveCartSelections}
          knownProductsById={knownProductsById}
          onClose={() => closeReviewSheet(true)}
          onEditManualRequest={handleEditManualRequestFromSheet}
          onUpdateSelection={handleReviewSelectionUpdate}
        />
      </form>
    </>
  );
}
