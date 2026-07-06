"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useDebounce } from "use-debounce";
import {
  addProductFromCatalogAction as merchantAddProductFromCatalogAction,
  bulkUpdateProductsAction as merchantBulkUpdateProductsAction,
  createProductAction as merchantCreateProductAction,
  loadProductsAction as merchantLoadProductsAction,
  loadCatalogItemsAction as merchantLoadCatalogItemsAction,
  loadHiddenCatalogItemsAction as merchantLoadHiddenCatalogItemsAction,
  hideCatalogItemAction as merchantHideCatalogItemAction,
  unhideCatalogItemAction as merchantUnhideCatalogItemAction,
  removeProductAction as merchantRemoveProductAction,
  searchTenantProductsAction as merchantSearchTenantProductsAction,
  updateProductAvailabilityAction as merchantUpdateProductAvailabilityAction,
  updateProductAction as merchantUpdateProductAction,
} from "@/actions/product-actions";
import { formatArabicInteger } from "@/lib/utils/number";
import type {
  CatalogItemsResponse,
  CatalogItem,
  Product,
  ProductOrderConfig,
  ProductOrderMode,
  ProductStatus,
  PublicProductCategory,
  PublicProductsMeta,
  TenantProductsSearchResponse,
} from "@/types/models/product";
import CatalogSection from "./CatalogSection";
import EditProductSheet from "./EditProductSheet";
import MyProductsSection from "./MyProductsSection";
import ProductMessageBanner from "./ProductMessageBanner";
import ProductOnboardingHeader from "./ProductOnboardingHeader";
import ProductSectionsTabs from "./ProductSectionsTabs";
import QuickAddSection from "./QuickAddSection";
import BulkEssentialWizard from "@/components/merchant/BulkEssentialWizard";
import { buildProductReadinessFromCount } from "@/components/merchant/ProductReadinessProgress";
import {
  ALL_CATALOG_ITEMS,
  CATEGORY_MODE_SELECT,
  DEFAULT_PRICE_PRESETS,
  DEFAULT_UNIT_LABEL,
  DEFAULT_WEIGHT_PRESETS,
  DUPLICATE_PRODUCT_PREFIX,
  MAX_PRODUCT_IMAGE_SIZE_BYTES,
  MAX_PRODUCT_IMAGE_SIZE_MB,
  MIN_SEARCH_CHARS,
  ORDER_MODE_QUANTITY,
  SEARCH_DEBOUNCE_MS,
  SEARCH_RESULTS_LIMIT,
  SECTION_MY_PRODUCTS,
  SECTION_CATALOG,
} from "../_utils/product-onboarding.constants";
import {
  buildAvailableProductCategories,
  buildOrderConfigPayload,
  buildProductsByNormalizedNameMap,
  buildSectionTabs,
  deriveEditFormState,
  hasAllowedProductImageFormat,
  isDuplicateMessage,
  isServerActionBodyLimitError,
  normalizeImageUploadErrorMessage,
  normalizeOptionalCategory,
  normalizeProductName,
  parseOptionalPositivePrice,
  resolveSectionFromQuery,
  supportsCatalogForStoreType,
} from "../_utils/product-onboarding";
import type {
  CategoryMode,
  ProductAvailabilityFilter,
  ProductSection,
  ProductStatusFilter,
} from "../_utils/product-onboarding.types";

type ProductOnboardingClientProps = {
  initialProducts: Product[];
  initialCatalogItems: CatalogItem[];
  initialCatalogMeta: PublicProductsMeta;
  catalogCategories: PublicProductCategory[];
  productCategories: string[];
  storeType?: string;
  actions?: ProductOnboardingActions;
  enableCatalogHiding?: boolean;
  enableBulkWizard?: boolean;
  layoutMode?: "merchant" | "admin";
};

type LoadCatalogItemsParams = {
  search?: string;
  category?: string;
  page?: number;
  limit?: number;
};

type ActionResult<T> = {
  success: boolean;
  data?: T;
  message?: string;
};

export type ProductOnboardingActions = {
  createProduct: (
    name: string,
    imageUrl?: string,
    currentPrice?: number,
    category?: string,
    orderMode?: ProductOrderMode,
    orderConfig?: ProductOrderConfig,
    imageFile?: File | null,
  ) => Promise<ActionResult<Product>>;
  addProductFromCatalog: (
    catalogItemId: number,
  ) => Promise<ActionResult<Product>>;
  loadCatalogItems: (
    params: LoadCatalogItemsParams,
  ) => Promise<ActionResult<CatalogItemsResponse>>;
  loadProducts?: (
    status?: ProductStatus,
  ) => Promise<ActionResult<Product[]>>;
  loadHiddenCatalogItems?: (
    params: { page?: number; limit?: number },
  ) => Promise<ActionResult<CatalogItemsResponse>>;
  searchTenantProducts: (
    search: string,
    page?: number,
    limit?: number,
    categoryOrOptions?:
      | string
      | {
          category?: string;
          rankAll?: boolean;
          excludeProductIds?: number[];
          status?: ProductStatus;
        },
  ) => Promise<ActionResult<TenantProductsSearchResponse>>;
  updateProduct: (
    productId: number,
    formData: FormData,
  ) => Promise<ActionResult<Product>>;
  updateProductAvailability: (
    productId: number,
    isAvailable: boolean,
  ) => Promise<ActionResult<Product>>;
  bulkUpdateProducts?: (payload: {
    ids: number[];
    category?: string;
    is_available?: boolean;
    status?: "active" | "archived";
  }) => Promise<ActionResult<{ success: boolean; count: number }>>;
  removeProduct: (
    productId: number,
  ) => Promise<ActionResult<unknown>>;
  hideCatalogItem?: (
    catalogItemId: number,
  ) => Promise<ActionResult<unknown>>;
  unhideCatalogItem?: (
    catalogItemId: number,
  ) => Promise<ActionResult<unknown>>;
};

const merchantProductOnboardingActions: ProductOnboardingActions = {
  createProduct: merchantCreateProductAction,
  addProductFromCatalog: merchantAddProductFromCatalogAction,
  loadCatalogItems: merchantLoadCatalogItemsAction,
  loadProducts: merchantLoadProductsAction,
  loadHiddenCatalogItems: merchantLoadHiddenCatalogItemsAction,
  searchTenantProducts: merchantSearchTenantProductsAction,
  updateProduct: merchantUpdateProductAction,
  updateProductAvailability: merchantUpdateProductAvailabilityAction,
  bulkUpdateProducts: merchantBulkUpdateProductsAction,
  removeProduct: merchantRemoveProductAction,
  hideCatalogItem: merchantHideCatalogItemAction,
  unhideCatalogItem: merchantUnhideCatalogItemAction,
};

const CATALOG_PAGE_LIMIT = 40;

const parseUploadProxyResponse = async <T,>(
  response: Response,
  fallbackMessage: string,
): Promise<ActionResult<T>> => {
  let body: ActionResult<T> | undefined;

  try {
    body = (await response.json()) as ActionResult<T>;
  } catch {
    body = undefined;
  }

  if (!response.ok || !body?.success) {
    return {
      success: false,
      message: body?.message || response.statusText || fallbackMessage,
    };
  }

  return body;
};

const createMerchantProductWithImage = async (
  formData: FormData,
): Promise<ActionResult<Product>> => {
  const response = await fetch("/api/merchant/products", {
    method: "POST",
    body: formData,
  });

  return parseUploadProxyResponse<Product>(response, "تعذر إضافة المنتج");
};

const updateMerchantProductWithImage = async (
  productId: number,
  formData: FormData,
): Promise<ActionResult<Product>> => {
  const response = await fetch(`/api/merchant/products/${productId}`, {
    method: "PATCH",
    body: formData,
  });

  return parseUploadProxyResponse<Product>(response, "تعذر تعديل المنتج");
};

const buildCreateProductImageFormData = ({
  name,
  price,
  category,
  orderMode,
  orderConfig,
  imageFile,
}: {
  name: string;
  price: number | null;
  category?: string;
  orderMode: ProductOrderMode;
  orderConfig: ProductOrderConfig;
  imageFile: File;
}): FormData => {
  const formData = new FormData();
  formData.set("name", name);
  formData.set("order_mode", orderMode);
  formData.set("order_config", JSON.stringify(orderConfig));
  if (price !== null) {
    formData.set("current_price", String(price));
  }
  if (category) {
    formData.set("category", category);
  }
  formData.set("file", imageFile);
  return formData;
};

const removeProductFromList = (productList: Product[], productId: number) =>
  productList.filter((item) => item.id !== productId);

const replaceProductInList = (
  productList: Product[],
  productId: number,
  updatedProduct: Product,
) => productList.map((item) => (item.id === productId ? updatedProduct : item));

const removeCatalogItemFromList = (
  catalogItemList: CatalogItem[],
  catalogItemId: number,
) => catalogItemList.filter((item) => item.id !== catalogItemId);

const filterProductsByAvailability = (
  productList: Product[],
  availabilityFilter: ProductAvailabilityFilter,
) => {
  if (availabilityFilter === "available") {
    return productList.filter((product) => product.is_available !== false);
  }

  if (availabilityFilter === "unavailable") {
    return productList.filter((product) => product.is_available === false);
  }

  return productList;
};

const ALL_PRODUCT_CATEGORIES = "all";
const UNCATEGORIZED_PRODUCT_CATEGORY = "أخرى";

const normalizeProductCategoryFilter = (category?: string | null) => {
  const normalized = category?.trim();
  return normalized || UNCATEGORIZED_PRODUCT_CATEGORY;
};

const filterProductsByCategory = (
  productList: Product[],
  categoryFilter: string,
) => {
  if (categoryFilter === ALL_PRODUCT_CATEGORIES) {
    return productList;
  }

  return productList.filter(
    (product) =>
      normalizeProductCategoryFilter(product.category) === categoryFilter,
  );
};

const countProductsByAvailability = (productList: Product[]) => {
  const unavailable = productList.filter(
    (product) => product.is_available === false,
  ).length;

  return {
    all: productList.length,
    available: productList.length - unavailable,
    unavailable,
  };
};

const buildProductCategoryCounts = (productList: Product[]) => {
  const counts = new Map<string, number>();

  for (const product of productList) {
    const category = normalizeProductCategoryFilter(product.category);
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((left, right) => left.category.localeCompare(right.category, "ar"));
};

export default function ProductOnboardingClient({
  initialProducts,
  initialCatalogItems,
  initialCatalogMeta,
  catalogCategories,
  productCategories,
  storeType,
  actions = merchantProductOnboardingActions,
  enableCatalogHiding = true,
  enableBulkWizard = true,
  layoutMode = "merchant",
}: ProductOnboardingClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [totalActiveProductsCount, setTotalActiveProductsCount] = useState<number>(
    () => initialProducts.filter((p) => p.status === "active").length || initialProducts.length,
  );
  const [productStatusFilter, setProductStatusFilter] =
    useState<ProductStatusFilter>("active");
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);

  useEffect(() => {
    if (productStatusFilter === "active") {
      setProducts(initialProducts);
    }
  }, [initialProducts, productStatusFilter]);

  const [catalogItems, setCatalogItems] =
    useState<CatalogItem[]>(initialCatalogItems);
  const [catalogMeta, setCatalogMeta] =
    useState<PublicProductsMeta>(initialCatalogMeta);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [isShowingHidden, setIsShowingHidden] = useState(false);
  const [isBulkWizardOpen, setIsBulkWizardOpen] = useState(false);

  const canUseBulkWizard = enableBulkWizard && storeType === "grocery";
  const handleOpenBulkWizard = canUseBulkWizard ? () => setIsBulkWizardOpen(true) : undefined;
  const shouldUseMerchantUploadProxy = actions === merchantProductOnboardingActions;

  const defaultUnitLabel =
    storeType === "pharmacy" ? "علبة" : DEFAULT_UNIT_LABEL;

  const [manualName, setManualName] = useState("");
  const [manualPrice, setManualPrice] = useState("");
  const [manualOrderMode, setManualOrderMode] =
    useState<ProductOrderMode>(ORDER_MODE_QUANTITY);
  const [manualUnitLabel, setManualUnitLabel] = useState(defaultUnitLabel);
  const [manualSecondaryUnitLabel, setManualSecondaryUnitLabel] = useState("");
  const [manualSecondaryUnitMultiplier, setManualSecondaryUnitMultiplier] =
    useState("");
  const [manualWeightPresets, setManualWeightPresets] = useState(
    DEFAULT_WEIGHT_PRESETS,
  );
  const [manualPricePresets, setManualPricePresets] = useState(
    DEFAULT_PRICE_PRESETS,
  );
  const [manualCategoryMode, setManualCategoryMode] =
    useState<CategoryMode>(CATEGORY_MODE_SELECT);
  const [manualCategorySelect, setManualCategorySelect] = useState("");
  const [manualCategoryCustom, setManualCategoryCustom] = useState("");
  const [manualImageFile, setManualImageFile] = useState<File | null>(null);
  const [manualImagePreview, setManualImagePreview] = useState<string | null>(
    null,
  );
  const [manualImageError, setManualImageError] = useState<string | null>(null);

  const [message, setMessage] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState(ALL_CATALOG_ITEMS);
  const [pendingCatalogIds, setPendingCatalogIds] = useState<
    Record<number, boolean>
  >({});

  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editIsAvailable, setEditIsAvailable] = useState(true);
  const [editOrderMode, setEditOrderMode] =
    useState<ProductOrderMode>(ORDER_MODE_QUANTITY);
  const [editUnitLabel, setEditUnitLabel] = useState(defaultUnitLabel);
  const [editSecondaryUnitLabel, setEditSecondaryUnitLabel] = useState("");
  const [editSecondaryUnitMultiplier, setEditSecondaryUnitMultiplier] =
    useState("");
  const [editWeightPresets, setEditWeightPresets] = useState(
    DEFAULT_WEIGHT_PRESETS,
  );
  const [editPricePresets, setEditPricePresets] = useState(
    DEFAULT_PRICE_PRESETS,
  );
  const [editCategoryMode, setEditCategoryMode] =
    useState<CategoryMode>(CATEGORY_MODE_SELECT);
  const [editCategorySelect, setEditCategorySelect] = useState("");
  const [editCategoryCustom, setEditCategoryCustom] = useState("");
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null);
  const [editImageError, setEditImageError] = useState<string | null>(null);

  const [confirmRemoveProductId, setConfirmRemoveProductId] = useState<
    number | null
  >(null);
  const [removingProductId, setRemovingProductId] = useState<number | null>(
    null,
  );
  const [availabilityPendingProductId, setAvailabilityPendingProductId] =
    useState<number | null>(null);
  const [highlightedProductId, setHighlightedProductId] = useState<
    number | null
  >(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchRefreshKey, setSearchRefreshKey] = useState(0);
  const [availabilityFilter, setAvailabilityFilter] =
    useState<ProductAvailabilityFilter>("all");
  const [productCategoryFilter, setProductCategoryFilter] =
    useState<string>(ALL_PRODUCT_CATEGORIES);

  const [catalogSearchQuery, setCatalogSearchQuery] = useState("");
  const [debouncedCatalogSearchQuery] = useDebounce(
    catalogSearchQuery,
    SEARCH_DEBOUNCE_MS,
  );

  const productRowRefs = useRef<Map<number, HTMLLIElement | null>>(new Map());
  const categoryRequestIdRef = useRef(0);

  const [isPending, startTransition] = useTransition();
  const [isEditPending, startEditTransition] = useTransition();
  const [, startRemoveTransition] = useTransition();

  const [debouncedSearchQuery] = useDebounce(searchQuery, SEARCH_DEBOUNCE_MS);

  const [activeSection, setActiveSection] = useState<ProductSection>(() =>
    resolveSectionFromQuery(searchParams.get("section")),
  );

  const [availableProductCategories, setAvailableProductCategories] = useState<
    string[]
  >(() => buildAvailableProductCategories(productCategories));

  const availableProductCategorySet = useMemo(
    () => new Set(availableProductCategories),
    [availableProductCategories],
  );

  const categoryTabs = useMemo(() => {
    const categoryMap = new Map<
      string,
      { key: string; label: string; count: number; imageUrl: string | null }
    >();

    for (const category of catalogCategories) {
      const categoryName = category.category.trim();
      if (!categoryName) {
        continue;
      }

      const existingCategory = categoryMap.get(categoryName);
      if (existingCategory) {
        existingCategory.count += category.count;
        if (!existingCategory.imageUrl && category.image_url) {
          existingCategory.imageUrl = category.image_url;
        }
        continue;
      }

      categoryMap.set(categoryName, {
        key: categoryName,
        label: categoryName,
        count: category.count,
        imageUrl: category.image_url ?? null,
      });
    }

    const tabs = Array.from(categoryMap.values());

    return [
      {
        key: ALL_CATALOG_ITEMS,
        label: "الكل",
        count: catalogMeta.total,
        imageUrl: null,
      },
      ...tabs,
    ];
  }, [catalogCategories, catalogMeta.total]);

  const normalizedSearchInput = searchQuery.trim();
  const normalizedDebouncedSearch = debouncedSearchQuery.trim();
  const isSearchActive = normalizedDebouncedSearch.length >= MIN_SEARCH_CHARS;
  const isSearchSettling =
    normalizedSearchInput.length >= MIN_SEARCH_CHARS &&
    normalizedSearchInput !== normalizedDebouncedSearch;
  const isSearchLoading = isSearchSettling || isSearching;
  const needsMoreSearchChars =
    normalizedSearchInput.length > 0 &&
    normalizedSearchInput.length < MIN_SEARCH_CHARS;

  const productsDisplaySource = isSearchActive ? searchResults : products;
  const productCategoryCounts = useMemo(
    () => buildProductCategoryCounts(productsDisplaySource),
    [productsDisplaySource],
  );
  const categoryFilteredProducts = useMemo(
    () => filterProductsByCategory(productsDisplaySource, productCategoryFilter),
    [productCategoryFilter, productsDisplaySource],
  );
  const availabilityFilterCounts = useMemo(
    () => countProductsByAvailability(categoryFilteredProducts),
    [categoryFilteredProducts],
  );
  const displayedProducts = useMemo(
    () =>
      filterProductsByAvailability(categoryFilteredProducts, availabilityFilter),
    [availabilityFilter, categoryFilteredProducts],
  );
  const displayedProductsCountLabel = isSearchActive
    ? `نتائج البحث: ${formatArabicInteger(displayedProducts.length) || displayedProducts.length}`
    : `${formatArabicInteger(displayedProducts.length) || displayedProducts.length} منتج`;

  const sectionTabs = useMemo(
    () => buildSectionTabs(catalogMeta.total, products.length, storeType),
    [catalogMeta.total, products.length, storeType],
  );
  const canUseCatalog = supportsCatalogForStoreType(storeType);

  const activeSectionLabel =
    sectionTabs.find((section) => section.key === activeSection)?.label ||
    sectionTabs[0].label;

  const safeMessage = typeof message === "string" ? message : "";
  const isDuplicateWarning = safeMessage.startsWith(DUPLICATE_PRODUCT_PREFIX);

  const productsByNormalizedName = useMemo(
    () => buildProductsByNormalizedNameMap(products),
    [products],
  );
  const productReadiness = useMemo(
    () => buildProductReadinessFromCount(totalActiveProductsCount, storeType),
    [totalActiveProductsCount, storeType],
  );

  useEffect(() => {
    if (
      productCategoryFilter === ALL_PRODUCT_CATEGORIES ||
      productCategoryCounts.some(
        (category) => category.category === productCategoryFilter,
      )
    ) {
      return;
    }

    setProductCategoryFilter(ALL_PRODUCT_CATEGORIES);
  }, [productCategoryCounts, productCategoryFilter]);

  useEffect(() => {
    if (productStatusFilter === "active") {
      setProducts(initialProducts);
      setIsLoadingProducts(false);
      refreshSearchResultsIfActive();
      return;
    }

    const loadProducts = actions.loadProducts;
    if (!loadProducts) {
      setProducts([]);
      setIsLoadingProducts(false);
      return;
    }

    let isCancelled = false;
    setIsLoadingProducts(true);
    setSearchResults([]);
    setSearchError(null);

    void (async () => {
      const response = await loadProducts(productStatusFilter);
      if (isCancelled) {
        return;
      }

      setIsLoadingProducts(false);
      if (!response.success || !response.data) {
        setProducts([]);
        setMessage(response.message || "تعذر تحميل المنتجات");
        return;
      }

      setProducts(response.data);
    })();

    return () => {
      isCancelled = true;
    };
  }, [actions, initialProducts, productStatusFilter]);

  useEffect(() => {
    if (!message) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setMessage(null);
    }, 3000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [message]);

  useEffect(() => {
    const sectionFromQuery = resolveSectionFromQuery(
      searchParams.get("section"),
    );
    const resolvedSection =
      !canUseCatalog && sectionFromQuery === "catalog"
        ? "quick-add"
        : sectionFromQuery;

    setActiveSection((currentSection) =>
      currentSection === resolvedSection ? currentSection : resolvedSection,
    );
  }, [canUseCatalog, searchParams]);

  const replaceSectionInQuery = (section: ProductSection) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    if (section === "quick-add") {
      nextParams.delete("section");
    } else {
      nextParams.set("section", section);
    }

    const currentQuery = searchParams.toString();
    const nextQuery = nextParams.toString();
    if (currentQuery === nextQuery) {
      return;
    }

    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;
    router.replace(nextUrl, { scroll: false });
  };

  const handleSectionChange = (section: ProductSection) => {
    setActiveSection(section);
    replaceSectionInQuery(section);
  };

  const resolveCatalogCategoryParam = (category: string, search?: string) => {
    const normalizedSearch = search?.trim() || "";
    if (normalizedSearch.length >= MIN_SEARCH_CHARS) {
      return undefined;
    }

    return category === ALL_CATALOG_ITEMS ? undefined : category;
  };

  const loadCatalogPage = async ({
    category,
    page,
    search,
    append,
  }: {
    category: string;
    page: number;
    search?: string;
    append: boolean;
  }) => {
    if (append && isLoadingCatalog) {
      return;
    }

    const requestId = categoryRequestIdRef.current + 1;
    categoryRequestIdRef.current = requestId;
    setIsLoadingCatalog(true);
    setCatalogError(null);

    const loadAction =
      isShowingHidden && actions.loadHiddenCatalogItems
        ? actions.loadHiddenCatalogItems
        : actions.loadCatalogItems;
    const response = await loadAction({
      search: search?.trim() || undefined,
      category: resolveCatalogCategoryParam(category, search),
      page,
      limit: CATALOG_PAGE_LIMIT,
    });

    if (categoryRequestIdRef.current !== requestId) {
      return;
    }

    setIsLoadingCatalog(false);
    if (!response.success || !response.data) {
      setCatalogError(response.message || "تعذر تحميل منتجات الكتالوج");
      return;
    }

    const catalogResponse = response.data;
    setCatalogMeta(catalogResponse.meta);
    setCatalogItems((currentItems) =>
      append
        ? [...currentItems, ...catalogResponse.data]
        : catalogResponse.data,
    );
  };

  const handleCategoryChange = (category: string) => {
    if (category === activeCategory) {
      return;
    }

    setActiveCategory(category);
    setCatalogItems([]);
    setCatalogMeta({
      total: 0,
      page: 1,
      limit: CATALOG_PAGE_LIMIT,
      last_page: 1,
      has_next: false,
    });
    void loadCatalogPage({
      category,
      page: 1,
      search: debouncedCatalogSearchQuery,
      append: false,
    });
  };

  useEffect(() => {
    setCatalogItems([]);
    setCatalogMeta({
      total: 0,
      page: 1,
      limit: CATALOG_PAGE_LIMIT,
      last_page: 1,
      has_next: false,
    });
    void loadCatalogPage({
      category: activeCategory,
      page: 1,
      search: debouncedCatalogSearchQuery,
      append: false,
    });
  }, [debouncedCatalogSearchQuery, isShowingHidden]);

  const handleLoadMoreCatalogItems = () => {
    if (isLoadingCatalog || !catalogMeta.has_next) {
      return;
    }

    void loadCatalogPage({
      category: activeCategory,
      page: catalogMeta.page + 1,
      search: debouncedCatalogSearchQuery,
      append: true,
    });
  };

  useEffect(() => {
    if (!highlightedProductId) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setHighlightedProductId(null);
    }, 1800);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [highlightedProductId]);

  useEffect(() => {
    if (!isSearchActive) {
      setSearchResults([]);
      setSearchError(null);
      setIsSearching(false);
      return;
    }

    let isCancelled = false;
    setIsSearching(true);
    setSearchError(null);

    void (async () => {
      const response = await actions.searchTenantProducts(
        normalizedDebouncedSearch,
        1,
        SEARCH_RESULTS_LIMIT,
        { status: productStatusFilter },
      );

      if (isCancelled) {
        return;
      }

      if (!response.success || !response.data) {
        setSearchResults([]);
        setSearchError(response.message || "تعذر تحميل نتائج البحث");
        setIsSearching(false);
        return;
      }

      setSearchResults(response.data.data);
      setIsSearching(false);
    })();

    return () => {
      isCancelled = true;
    };
  }, [
    actions,
    isSearchActive,
    normalizedDebouncedSearch,
    productStatusFilter,
    searchRefreshKey,
  ]);

  const refreshSearchResultsIfActive = () => {
    if (!isSearchActive) {
      return;
    }

    setSearchRefreshKey((prev) => prev + 1);
  };

  const handleSearchQueryChange = (value: string) => {
    setSearchQuery(value);

    if (value.trim().length >= MIN_SEARCH_CHARS) {
      return;
    }

    setSearchResults([]);
    setSearchError(null);
    setIsSearching(false);
  };

  const handleProductStatusFilterChange = (value: ProductStatusFilter) => {
    if (value === productStatusFilter) {
      return;
    }

    setProductStatusFilter(value);
    setAvailabilityFilter("all");
    setProductCategoryFilter(ALL_PRODUCT_CATEGORIES);
    setSearchResults([]);
    setSearchError(null);
    setIsSearching(false);
    setConfirmRemoveProductId(null);
  };

  const handleClearSearchQuery = () => {
    setSearchQuery("");
    setSearchResults([]);
    setSearchError(null);
    setIsSearching(false);
  };

  const addCategoryOption = (category: string | null | undefined) => {
    const normalizedCategory = normalizeOptionalCategory(category ?? "");
    if (!normalizedCategory) {
      return;
    }

    setAvailableProductCategories((prev) => {
      if (prev.includes(normalizedCategory)) {
        return prev;
      }

      return [...prev, normalizedCategory].sort((left, right) =>
        left.localeCompare(right, "ar"),
      );
    });
  };

  const highlightExistingProduct = (product: Product) => {
    setActiveSection(SECTION_MY_PRODUCTS);
    replaceSectionInQuery(SECTION_MY_PRODUCTS);
    setHighlightedProductId(product.id);
    setMessage(`${DUPLICATE_PRODUCT_PREFIX} ${product.name}`);
    setConfirmRemoveProductId(null);

    requestAnimationFrame(() => {
      const row = productRowRefs.current.get(product.id);
      if (!row) {
        return;
      }

      row.scrollIntoView({ behavior: "smooth", block: "center" });
      row.focus();
    });
  };

  const handleManualSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setManualImageError(null);

    const trimmedName = manualName.trim();
    if (!trimmedName) {
      setMessage("اكتب اسم المنتج أولاً");
      return;
    }

    const parsedPrice = parseOptionalPositivePrice(manualPrice);
    if (!parsedPrice.valid) {
      setMessage("ادخل سعرًا صحيحًا أكبر من صفر");
      return;
    }

    const normalizedCategory = normalizeOptionalCategory(
      manualCategoryMode === CATEGORY_MODE_SELECT
        ? manualCategorySelect
        : manualCategoryCustom,
    );

    const duplicateProduct = productsByNormalizedName.get(
      normalizeProductName(trimmedName),
    );
    if (duplicateProduct) {
      highlightExistingProduct(duplicateProduct);
      return;
    }

    startTransition(async () => {
      const orderConfig = buildOrderConfigPayload({
        mode: manualOrderMode,
        unitLabel: manualUnitLabel,
        secondaryLabel: manualSecondaryUnitLabel,
        secondaryMultiplier: manualSecondaryUnitMultiplier,
        weightPresets: manualWeightPresets,
        pricePresets: manualPricePresets,
      });

      let response: ActionResult<Product>;
      if (manualImageFile && shouldUseMerchantUploadProxy) {
        response = await createMerchantProductWithImage(
          buildCreateProductImageFormData({
            name: trimmedName,
            price: parsedPrice.value,
            category: normalizedCategory,
            orderMode: manualOrderMode,
            orderConfig,
            imageFile: manualImageFile,
          }),
        );
      } else {
        response = await actions.createProduct(
          trimmedName,
          undefined,
          parsedPrice.value ?? undefined,
          normalizedCategory,
          manualOrderMode,
          orderConfig,
          manualImageFile,
        );
      }

      if (!response.success || !response.data) {
        const imageErrorMessage = normalizeImageUploadErrorMessage(
          response.message,
        );
        if (imageErrorMessage) {
          setManualImageError(imageErrorMessage);
          setMessage(null);
          return;
        }

        if (isDuplicateMessage(response.message)) {
          const existingProduct = productsByNormalizedName.get(
            normalizeProductName(trimmedName),
          );
          if (existingProduct) {
            highlightExistingProduct(existingProduct);
            return;
          }
        }

        setMessage(response.message || "تعذر إضافة المنتج");
        return;
      }

      if (productStatusFilter === "active") {
        setProducts((prev) => [response.data as Product, ...prev]);
      }
      setTotalActiveProductsCount((prev) => prev + 1);
      addCategoryOption(response.data!.category);
      setManualName("");
      setManualPrice("");
      setManualOrderMode(ORDER_MODE_QUANTITY);
      setManualUnitLabel(defaultUnitLabel);
      setManualSecondaryUnitLabel("");
      setManualSecondaryUnitMultiplier("");
      setManualWeightPresets(DEFAULT_WEIGHT_PRESETS);
      setManualPricePresets(DEFAULT_PRICE_PRESETS);
      setManualCategoryMode(CATEGORY_MODE_SELECT);
      setManualCategorySelect("");
      setManualCategoryCustom("");
      if (manualImagePreview?.startsWith("blob:")) {
        URL.revokeObjectURL(manualImagePreview);
      }
      setManualImageFile(null);
      setManualImagePreview(null);
      setManualImageError(null);
      refreshSearchResultsIfActive();
      setConfirmRemoveProductId(null);
      setMessage("تم حفظ المنتج");
    });
  };

  const handleManualImageChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const selectedFile = event.target.files?.[0] ?? null;
    setManualImageError(null);

    if (manualImagePreview?.startsWith("blob:")) {
      URL.revokeObjectURL(manualImagePreview);
    }

    if (selectedFile && selectedFile.size > MAX_PRODUCT_IMAGE_SIZE_BYTES) {
      setManualImageFile(null);
      setManualImagePreview(null);
      event.target.value = "";
      setMessage(null);
      setManualImageError(
        `حجم الصورة كبير. الحد الأقصى ${MAX_PRODUCT_IMAGE_SIZE_MB} ميجابايت.`,
      );
      return;
    }

    if (selectedFile && !hasAllowedProductImageFormat(selectedFile)) {
      setManualImageFile(null);
      setManualImagePreview(null);
      event.target.value = "";
      setMessage(null);
      setManualImageError(
        "صيغة الصورة غير مدعومة. استخدم JPG أو PNG أو WEBP أو HEIC أو HEIF.",
      );
      return;
    }

    setManualImageFile(selectedFile);
    setManualImagePreview(
      selectedFile ? URL.createObjectURL(selectedFile) : null,
    );
  };

  const handleAddFromCatalog = (item: CatalogItem) => {
    const duplicateProduct = productsByNormalizedName.get(
      normalizeProductName(item.name),
    );
    if (duplicateProduct) {
      highlightExistingProduct(duplicateProduct);
      return;
    }

    const catalogItemId = item.id;
    setPendingCatalogIds((prev) => ({
      ...prev,
      [catalogItemId]: true,
    }));

    void (async () => {
      try {
        const response = await actions.addProductFromCatalog(catalogItemId);

        if (!response.success || !response.data) {
          if (isDuplicateMessage(response.message)) {
            const existingProduct = productsByNormalizedName.get(
              normalizeProductName(item.name),
            );
            if (existingProduct) {
              highlightExistingProduct(existingProduct);
              return;
            }
          }

          setMessage(response.message || "تعذر إضافة المنتج من الكتالوج");
          return;
        }

        if (productStatusFilter === "active") {
          setProducts((prev) => [response.data as Product, ...prev]);
        }
        setTotalActiveProductsCount((prev) => prev + 1);
        setCatalogItems((prev) => removeCatalogItemFromList(prev, catalogItemId));
        setCatalogMeta((prev) => ({
          ...prev,
          total: Math.max(0, prev.total - 1),
        }));
        addCategoryOption(response.data!.category);
        refreshSearchResultsIfActive();
        setConfirmRemoveProductId(null);
        setMessage("تمت الإضافة");
      } finally {
        setPendingCatalogIds((prev) => ({
          ...prev,
          [catalogItemId]: false,
        }));
      }
    })();
  };

  const handleHideCatalogItem = (item: CatalogItem) => {
    const catalogItemId = item.id;
    setPendingCatalogIds((prev) => ({ ...prev, [catalogItemId]: true }));
    void (async () => {
      try {
        if (!actions.hideCatalogItem) {
          setMessage("إخفاء منتجات الكتالوج غير متاح هنا");
          return;
        }

        const response = await actions.hideCatalogItem(catalogItemId);
        if (response.success) {
          setCatalogItems((prev) =>
            removeCatalogItemFromList(prev, catalogItemId),
          );
          setCatalogMeta((prev) => ({
            ...prev,
            total: Math.max(0, prev.total - 1),
          }));
          setMessage("تم إخفاء المنتج بنجاح");
        } else {
          setMessage(response.message || "تعذر إخفاء المنتج");
        }
      } finally {
        setPendingCatalogIds((prev) => ({ ...prev, [catalogItemId]: false }));
      }
    })();
  };

  const handleUnhideCatalogItem = (item: CatalogItem) => {
    const catalogItemId = item.id;
    setPendingCatalogIds((prev) => ({ ...prev, [catalogItemId]: true }));
    void (async () => {
      try {
        if (!actions.unhideCatalogItem) {
          setMessage("إظهار منتجات الكتالوج غير متاح هنا");
          return;
        }

        const response = await actions.unhideCatalogItem(catalogItemId);
        if (response.success) {
          setCatalogItems((prev) =>
            removeCatalogItemFromList(prev, catalogItemId),
          );
          setCatalogMeta((prev) => ({
            ...prev,
            total: Math.max(0, prev.total - 1),
          }));
          setMessage("تم إظهار المنتج بنجاح");
        } else {
          setMessage(response.message || "تعذر إظهار المنتج");
        }
      } finally {
        setPendingCatalogIds((prev) => ({ ...prev, [catalogItemId]: false }));
      }
    })();
  };

  const handleToggleShowingHidden = () => {
    if (!enableCatalogHiding || !actions.loadHiddenCatalogItems) {
      return;
    }

    setIsShowingHidden((prev) => !prev);
  };

  const handleStartEdit = (product: Product) => {
    if (editImagePreview?.startsWith("blob:")) {
      URL.revokeObjectURL(editImagePreview);
    }

    const editState = deriveEditFormState(
      product,
      availableProductCategorySet,
      defaultUnitLabel,
    );

    setEditingProduct(product);
    setEditName(editState.name);
    setEditPrice(editState.price);
    setEditIsAvailable(editState.isAvailable);
    setEditOrderMode(editState.orderMode);
    setEditUnitLabel(editState.unitLabel);
    setEditSecondaryUnitLabel(editState.secondaryUnitLabel);
    setEditSecondaryUnitMultiplier(editState.secondaryUnitMultiplier);
    setEditWeightPresets(editState.weightPresets);
    setEditPricePresets(editState.pricePresets);
    setEditCategoryMode(editState.categoryMode);
    setEditCategorySelect(editState.categorySelect);
    setEditCategoryCustom(editState.categoryCustom);
    setEditImageFile(null);
    setEditImagePreview(null);
    setEditImageError(null);
    setConfirmRemoveProductId(null);
    setMessage(null);
  };

  const handleCloseEdit = () => {
    if (editImagePreview?.startsWith("blob:")) {
      URL.revokeObjectURL(editImagePreview);
    }

    setEditingProduct(null);
    setEditName("");
    setEditPrice("");
    setEditIsAvailable(true);
    setEditOrderMode(ORDER_MODE_QUANTITY);
    setEditUnitLabel(defaultUnitLabel);
    setEditSecondaryUnitLabel("");
    setEditSecondaryUnitMultiplier("");
    setEditWeightPresets(DEFAULT_WEIGHT_PRESETS);
    setEditPricePresets(DEFAULT_PRICE_PRESETS);
    setEditCategoryMode(CATEGORY_MODE_SELECT);
    setEditCategorySelect("");
    setEditCategoryCustom("");
    setEditImageFile(null);
    setEditImagePreview(null);
    setEditImageError(null);
  };

  const handleRequestRemove = (productId: number) => {
    if (removingProductId) {
      return;
    }

    setConfirmRemoveProductId((prev) =>
      prev === productId ? null : productId,
    );
    setMessage(null);
  };

  const handleRemoveProduct = (product: Product) => {
    setRemovingProductId(product.id);

    startRemoveTransition(async () => {
      const response = await actions.removeProduct(product.id);
      setRemovingProductId(null);

      if (!response.success) {
        setMessage(response.message || "تعذر حذف المنتج");
        return;
      }

      setProducts((prev) => removeProductFromList(prev, product.id));
      if (product.status === "active") {
        setTotalActiveProductsCount((prev) => Math.max(0, prev - 1));
      }
      refreshSearchResultsIfActive();
      setConfirmRemoveProductId((prev) => (prev === product.id ? null : prev));
      if (editingProduct?.id === product.id) {
        handleCloseEdit();
      }
      if (highlightedProductId === product.id) {
        setHighlightedProductId(null);
      }
      setMessage(response.message || "تم حذف المنتج");
    });
  };

  const handleToggleProductAvailability = (product: Product) => {
    if (availabilityPendingProductId) {
      return;
    }

    const nextAvailability = product.is_available === false;
    setAvailabilityPendingProductId(product.id);
    setMessage(null);

    void (async () => {
      const response = await actions.updateProductAvailability(
        product.id,
        nextAvailability,
      );

      setAvailabilityPendingProductId(null);

      if (!response.success || !response.data) {
        setMessage(response.message || "تعذر تحديث توفر المنتج");
        return;
      }

      const updatedProduct = response.data as Product;
      setProducts((prev) =>
        replaceProductInList(prev, product.id, updatedProduct),
      );
      setSearchResults((prev) =>
        replaceProductInList(prev, product.id, updatedProduct),
      );
      setMessage(nextAvailability ? "تم إتاحة المنتج" : "تم إيقاف المنتج");
    })();
  };

  const handleBulkUpdateProducts = async (payload: {
    ids: number[];
    category?: string;
    is_available?: boolean;
    status?: "active" | "archived";
  }) => {
    if (!actions.bulkUpdateProducts) {
      return {
        success: false,
        message: "تعذر تحديث المنتجات المحددة",
      };
    }

    const response = await actions.bulkUpdateProducts(payload);
    if (!response.success) {
      return response;
    }

    const selectedIds = new Set(payload.ids);
    const nextStatus = payload.status;
    const shouldRemoveFromCurrentView =
      nextStatus !== undefined && nextStatus !== productStatusFilter;
    const updateProduct = (product: Product): Product =>
      selectedIds.has(product.id)
        ? {
            ...product,
            category: payload.category ?? product.category,
            is_available:
              payload.is_available !== undefined
                ? payload.is_available
                : product.is_available,
            status: payload.status ?? product.status,
          }
        : product;

    if (payload.status === "archived") {
      setTotalActiveProductsCount((prev) => Math.max(0, prev - selectedIds.size));
    } else if (payload.status === "active") {
      setTotalActiveProductsCount((prev) => prev + selectedIds.size);
    }

    setProducts((prev) =>
      shouldRemoveFromCurrentView
        ? prev.filter((product) => !selectedIds.has(product.id))
        : prev.map(updateProduct),
    );
    setSearchResults((prev) =>
      shouldRemoveFromCurrentView
        ? prev.filter((product) => !selectedIds.has(product.id))
        : prev.map(updateProduct),
    );
    if (payload.category) {
      addCategoryOption(payload.category);
    }
    if (payload.status === "archived") {
      setMessage("تمت أرشفة المنتجات المحددة");
    } else if (payload.status === "active") {
      setMessage("تم تنشيط المنتجات المحددة");
    } else {
      setMessage("تم تحديث المنتجات المحددة");
    }

    return response;
  };

  const handleEditImageChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const selectedFile = event.target.files?.[0] ?? null;
    setEditImageError(null);

    if (editImagePreview?.startsWith("blob:")) {
      URL.revokeObjectURL(editImagePreview);
    }

    if (selectedFile && selectedFile.size > MAX_PRODUCT_IMAGE_SIZE_BYTES) {
      setEditImageFile(null);
      setEditImagePreview(null);
      event.target.value = "";
      setMessage(null);
      setEditImageError(
        `حجم الصورة كبير. الحد الأقصى ${MAX_PRODUCT_IMAGE_SIZE_MB} ميجابايت.`,
      );
      return;
    }

    if (selectedFile && !hasAllowedProductImageFormat(selectedFile)) {
      setEditImageFile(null);
      setEditImagePreview(null);
      event.target.value = "";
      setMessage(null);
      setEditImageError(
        "صيغة الصورة غير مدعومة. استخدم JPG أو PNG أو WEBP أو HEIC أو HEIF.",
      );
      return;
    }

    setEditImageFile(selectedFile);
    setEditImagePreview(
      selectedFile ? URL.createObjectURL(selectedFile) : null,
    );
  };

  const resolveDuplicateEditProduct = ({
    editingProductId,
    trimmedName,
  }: {
    editingProductId: number;
    trimmedName: string;
  }) =>
    products.find(
      (product) =>
        product.id !== editingProductId &&
        normalizeProductName(product.name) ===
          normalizeProductName(trimmedName),
    );

  const handleUpdateProductErrorResponse = ({
    responseMessage,
    editingProductId,
    trimmedName,
  }: {
    responseMessage?: string;
    editingProductId: number;
    trimmedName: string;
  }): void => {
    if (isDuplicateMessage(responseMessage)) {
      const existingProduct = resolveDuplicateEditProduct({
        editingProductId,
        trimmedName,
      });
      if (existingProduct) {
        highlightExistingProduct(existingProduct);
        return;
      }
    }

    const imageErrorMessage = normalizeImageUploadErrorMessage(responseMessage);
    if (imageErrorMessage) {
      setMessage(null);
      setEditImageError(imageErrorMessage);
      return;
    }

    setMessage(responseMessage || "تعذر تعديل المنتج، حاول مرة أخرى.");
  };

  const handleUpdateProductException = (error: unknown): void => {
    if (isServerActionBodyLimitError(error)) {
      setMessage(null);
      setEditImageError(
        `حجم الصورة كبير. الحد الأقصى ${MAX_PRODUCT_IMAGE_SIZE_MB} ميجابايت.`,
      );
      return;
    }

    const imageErrorMessage = normalizeImageUploadErrorMessage(
      error instanceof Error ? error.message : undefined,
    );
    if (imageErrorMessage) {
      setMessage(null);
      setEditImageError(imageErrorMessage);
      return;
    }

    setMessage("تعذر تعديل المنتج، حاول مرة أخرى.");
  };

  const runEditProductSubmit = async ({
    editingProductId,
    trimmedName,
    priceValue,
    normalizedCategory,
    selectedImageFile,
  }: {
    editingProductId: number;
    trimmedName: string;
    priceValue: number | null;
    normalizedCategory?: string;
    selectedImageFile: File | null;
  }) => {
    try {
      const formData = new FormData();
      formData.set("name", trimmedName);
      formData.set("order_mode", editOrderMode);
      formData.set(
        "order_config",
        JSON.stringify(
          buildOrderConfigPayload({
            mode: editOrderMode,
            unitLabel: editUnitLabel,
            secondaryLabel: editSecondaryUnitLabel,
            secondaryMultiplier: editSecondaryUnitMultiplier,
            weightPresets: editWeightPresets,
            pricePresets: editPricePresets,
          }),
        ),
      );
      if (priceValue !== null) {
        formData.set("current_price", String(priceValue));
      }
      formData.set("is_available", String(editIsAvailable));
      if (normalizedCategory) {
        formData.set("category", normalizedCategory);
      }
      if (selectedImageFile) {
        formData.set("file", selectedImageFile);
      }

      const response =
        selectedImageFile && shouldUseMerchantUploadProxy
          ? await updateMerchantProductWithImage(editingProductId, formData)
          : await actions.updateProduct(editingProductId, formData);
      if (!response.success || !response.data) {
        handleUpdateProductErrorResponse({
          responseMessage: response.message,
          editingProductId,
          trimmedName,
        });
        return;
      }

      const updatedProduct = response.data as Product;
      setProducts((prev) =>
        replaceProductInList(prev, editingProductId, updatedProduct),
      );
      setSearchResults((prev) =>
        replaceProductInList(prev, editingProductId, updatedProduct),
      );
      addCategoryOption(updatedProduct.category);
      refreshSearchResultsIfActive();
      setEditImageError(null);
      setMessage("تم تعديل المنتج");
      handleCloseEdit();
    } catch (error) {
      handleUpdateProductException(error);
    }
  };

  const handleEditSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setEditImageError(null);

    if (!editingProduct) {
      return;
    }

    const trimmedName = editName.trim();
    if (!trimmedName) {
      setMessage("اسم المنتج مطلوب");
      return;
    }

    const parsedPrice = parseOptionalPositivePrice(editPrice);
    if (!parsedPrice.valid) {
      setMessage("ادخل سعرًا صحيحًا أكبر من صفر");
      return;
    }

    const normalizedCategory = normalizeOptionalCategory(
      editCategoryMode === CATEGORY_MODE_SELECT
        ? editCategorySelect
        : editCategoryCustom,
    );

    const duplicateProduct = resolveDuplicateEditProduct({
      editingProductId: editingProduct.id,
      trimmedName,
    });
    if (duplicateProduct) {
      highlightExistingProduct(duplicateProduct);
      return;
    }

    const editingProductId = editingProduct.id;
    const selectedImageFile = editImageFile;
    startEditTransition(() => {
      void runEditProductSubmit({
        editingProductId,
        trimmedName,
        priceValue: parsedPrice.value,
        normalizedCategory,
        selectedImageFile,
      });
    });
  };

  const isAdminLayout = layoutMode === "admin";

  return (
    <div
      className={
        isAdminLayout
          ? "w-full space-y-3 pb-6"
          : "mx-auto w-full max-w-5xl space-y-4 pb-10"
      }
    >
      <div
        className={
          isAdminLayout
            ? "sticky top-[92px] z-20 rounded-lg border border-gray-200 bg-white/95 p-2 shadow-sm backdrop-blur"
            : "sticky top-[57px] z-20 rounded-2xl border border-gray-200 bg-white/95 p-3 shadow-sm backdrop-blur lg:top-0"
        }
      >
        <ProductOnboardingHeader
          activeSectionLabel={activeSectionLabel}
          productsCount={products.length}
          productReadiness={productReadiness}
          onOpenBulkWizard={handleOpenBulkWizard}
        />
        <ProductSectionsTabs
          sectionTabs={sectionTabs}
          activeSection={activeSection}
          onSectionChange={handleSectionChange}
        />
      </div>

      {safeMessage && (
        <ProductMessageBanner
          message={safeMessage}
          isDuplicateWarning={isDuplicateWarning}
        />
      )}

      <QuickAddSection
        active={activeSection === "quick-add"}
        onSubmit={handleManualSubmit}
        onShowMyProducts={() => handleSectionChange(SECTION_MY_PRODUCTS)}
        isPending={isPending}
        manualName={manualName}
        onManualNameChange={setManualName}
        manualPrice={manualPrice}
        onManualPriceChange={setManualPrice}
        manualOrderMode={manualOrderMode}
        onManualOrderModeChange={setManualOrderMode}
        manualUnitLabel={manualUnitLabel}
        onManualUnitLabelChange={setManualUnitLabel}
        manualSecondaryUnitLabel={manualSecondaryUnitLabel}
        onManualSecondaryUnitLabelChange={setManualSecondaryUnitLabel}
        manualSecondaryUnitMultiplier={manualSecondaryUnitMultiplier}
        onManualSecondaryUnitMultiplierChange={setManualSecondaryUnitMultiplier}
        manualWeightPresets={manualWeightPresets}
        onManualWeightPresetsChange={setManualWeightPresets}
        manualPricePresets={manualPricePresets}
        onManualPricePresetsChange={setManualPricePresets}
        manualCategoryMode={manualCategoryMode}
        onManualCategoryModeChange={setManualCategoryMode}
        manualCategorySelect={manualCategorySelect}
        onManualCategorySelectChange={setManualCategorySelect}
        manualCategoryCustom={manualCategoryCustom}
        onManualCategoryCustomChange={setManualCategoryCustom}
        availableProductCategories={availableProductCategories}
        manualImagePreview={manualImagePreview}
        manualImageError={manualImageError}
        onManualImageChange={handleManualImageChange}
        storeType={storeType}
      />

      {canUseCatalog && (
        <CatalogSection
          active={activeSection === SECTION_CATALOG}
          catalogItems={catalogItems}
          categoryTabs={categoryTabs}
          activeCategory={activeCategory}
          onCategoryChange={handleCategoryChange}
          searchQuery={catalogSearchQuery}
          onSearchQueryChange={setCatalogSearchQuery}
          onClearSearchQuery={() => setCatalogSearchQuery("")}
          catalogMeta={catalogMeta}
          isLoadingCatalog={isLoadingCatalog}
          catalogError={catalogError}
          onLoadMore={handleLoadMoreCatalogItems}
          pendingCatalogIds={pendingCatalogIds}
          onAddFromCatalog={handleAddFromCatalog}
          isShowingHidden={isShowingHidden}
          onToggleShowingHidden={
            enableCatalogHiding && actions.loadHiddenCatalogItems
              ? handleToggleShowingHidden
              : undefined
          }
          onHideCatalogItem={
            enableCatalogHiding && actions.hideCatalogItem
              ? handleHideCatalogItem
              : undefined
          }
          onUnhideCatalogItem={
            enableCatalogHiding && actions.unhideCatalogItem
              ? handleUnhideCatalogItem
              : undefined
          }
        />
      )}

      <MyProductsSection
        active={activeSection === "my-products"}
        displayedProductsCountLabel={displayedProductsCountLabel}
        onOpenBulkWizard={handleOpenBulkWizard}
        searchQuery={searchQuery}
        onSearchQueryChange={handleSearchQueryChange}
        onClearSearchQuery={handleClearSearchQuery}
        categoryFilter={productCategoryFilter}
        onCategoryFilterChange={setProductCategoryFilter}
        categoryFilterCounts={productCategoryCounts}
        categoryFilterTotalCount={productsDisplaySource.length}
        allCategoryFilterKey={ALL_PRODUCT_CATEGORIES}
        availabilityFilter={availabilityFilter}
        onAvailabilityFilterChange={setAvailabilityFilter}
        availabilityFilterCounts={availabilityFilterCounts}
        needsMoreSearchChars={needsMoreSearchChars}
        isSearchLoading={isSearchLoading || isLoadingProducts}
        searchError={searchError}
        isSearchActive={isSearchActive}
        displayedProducts={displayedProducts}
        confirmRemoveProductId={confirmRemoveProductId}
        removingProductId={removingProductId}
        availabilityPendingProductId={availabilityPendingProductId}
        highlightedProductId={highlightedProductId}
        onStartEdit={handleStartEdit}
        onToggleAvailability={handleToggleProductAvailability}
        onRequestRemove={handleRequestRemove}
        onRemoveProduct={handleRemoveProduct}
        onCancelRemove={() => setConfirmRemoveProductId(null)}
        productStatusFilter={productStatusFilter}
        onProductStatusFilterChange={handleProductStatusFilterChange}
        bulkUpdateProducts={
          actions.bulkUpdateProducts
            ? handleBulkUpdateProducts
            : undefined
        }
        bulkCategoryOptions={availableProductCategories}
        setProductRowRef={(productId, node) => {
          if (node) {
            productRowRefs.current.set(productId, node);
            return;
          }

          productRowRefs.current.delete(productId);
        }}
      />

      <EditProductSheet
        editingProduct={editingProduct}
        onClose={handleCloseEdit}
        onSubmit={handleEditSubmit}
        isEditPending={isEditPending}
        editName={editName}
        onEditNameChange={setEditName}
        editPrice={editPrice}
        onEditPriceChange={setEditPrice}
        editIsAvailable={editIsAvailable}
        onEditIsAvailableChange={setEditIsAvailable}
        editOrderMode={editOrderMode}
        onEditOrderModeChange={setEditOrderMode}
        editUnitLabel={editUnitLabel}
        onEditUnitLabelChange={setEditUnitLabel}
        editSecondaryUnitLabel={editSecondaryUnitLabel}
        onEditSecondaryUnitLabelChange={setEditSecondaryUnitLabel}
        editSecondaryUnitMultiplier={editSecondaryUnitMultiplier}
        onEditSecondaryUnitMultiplierChange={setEditSecondaryUnitMultiplier}
        editWeightPresets={editWeightPresets}
        onEditWeightPresetsChange={setEditWeightPresets}
        editPricePresets={editPricePresets}
        onEditPricePresetsChange={setEditPricePresets}
        editCategoryMode={editCategoryMode}
        onEditCategoryModeChange={setEditCategoryMode}
        editCategorySelect={editCategorySelect}
        onEditCategorySelectChange={setEditCategorySelect}
        editCategoryCustom={editCategoryCustom}
        onEditCategoryCustomChange={setEditCategoryCustom}
        availableProductCategories={availableProductCategories}
        editImagePreview={editImagePreview}
        editImageError={editImageError}
        onEditImageChange={handleEditImageChange}
        storeType={storeType}
      />

      {enableBulkWizard ? (
        <BulkEssentialWizard
          isOpen={isBulkWizardOpen}
          onClose={() => setIsBulkWizardOpen(false)}
          onSuccess={() => {
            refreshSearchResultsIfActive();
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}
