"use server";

import { adminService } from "@/services/api/admin.service";
import { redirect } from "next/navigation";
import { setCookieAction, deleteCookieAction } from "@/app/actions/cookie-store";
import { STORAGE_KEYS } from "@/constants";
import { revalidatePath } from "next/cache";
import { loginSchema } from "@/lib/validations/auth";
import { isNextRedirectError } from "@/lib/auth/navigation-errors";
import type {
  BulkEssentialStage,
  CatalogItemsResponse,
  Product,
  ProductOrderConfig,
  ProductOrderMode,
  PublicProductCategory,
} from "@/types/models/product";
import type {
  AdminCatalogItem,
  AdminCatalogSource,
  AdminProductSheetUploadSummary,
  UpdateAdminCatalogItemPayload,
} from "@/services/api/admin.service";

export type ActionState = {
  success?: boolean;
  message?: string;
  errors?: Record<string, string[] | undefined>;
  timestamp?: number;
};

export type DirectoryStatusActionState = {
  success: boolean;
  message?: string;
};

const UPDATE_PRODUCT_FALLBACK_MESSAGE = "تعذر تعديل المنتج، حاول مرة أخرى.";
const UPDATE_PRODUCT_IMAGE_SIZE_MESSAGE =
  "حجم الصورة كبير. الحد الأقصى 15 ميجابايت.";
const UPDATE_PRODUCT_IMAGE_FORMAT_MESSAGE =
  "صيغة الصورة غير مدعومة. استخدم JPG أو PNG أو WEBP أو HEIC أو HEIF.";
const UPDATE_PRODUCT_TIMEOUT_MESSAGE =
  "استغرق رفع/معالجة الصورة وقتًا أطول من المتوقع. حاول مرة أخرى.";

type LoadCatalogItemsParams = {
  search?: string;
  category?: string;
  page?: number;
  limit?: number;
};

type AdminProductOnboardingData = {
  products: Product[];
  productCategories: string[];
  catalogItemsResponse: CatalogItemsResponse;
  catalogCategories: PublicProductCategory[];
};

const createEmptyCatalogItemsResponse = (
  limit = 40,
): CatalogItemsResponse => ({
  data: [],
  meta: {
    total: 0,
    page: 1,
    limit,
    last_page: 1,
    has_next: false,
  },
});

const normalizeUpdateProductErrorMessage = (message?: string): string => {
  const normalized = message?.trim();
  if (!normalized) {
    return UPDATE_PRODUCT_FALLBACK_MESSAGE;
  }

  if (
    /(unsupported image format|unsupported codec|صيغة الصورة غير مدعومة)/i.test(
      normalized,
    )
  ) {
    return UPDATE_PRODUCT_IMAGE_FORMAT_MESSAGE;
  }

  if (
    /(limit_file_size|payload too large|entity too large|file too large|حجم الصورة|exceed.*(?:size|limit))/i.test(
      normalized,
    )
  ) {
    return UPDATE_PRODUCT_IMAGE_SIZE_MESSAGE;
  }

  if (
    /(timeout|timed out|aborterror|operation was aborted|signal is aborted)/i.test(
      normalized,
    )
  ) {
    return UPDATE_PRODUCT_TIMEOUT_MESSAGE;
  }

  return normalized;
};

const setTrimmedField = (
  payload: FormData,
  key: string,
  value: FormDataEntryValue | null,
) => {
  if (typeof value !== "string") {
    return;
  }

  const trimmed = value.trim();
  if (trimmed) {
    payload.set(key, trimmed);
  }
};

const setNormalizedAvailabilityField = (
  payload: FormData,
  value: FormDataEntryValue | null,
) => {
  if (typeof value !== "string") {
    return;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1") {
    payload.set("is_available", "true");
  } else if (normalized === "false" || normalized === "0") {
    payload.set("is_available", "false");
  }
};

const normalizeProductFormData = (formData: FormData): FormData => {
  const normalizedPayload = new FormData();

  setTrimmedField(normalizedPayload, "name", formData.get("name"));
  setTrimmedField(normalizedPayload, "current_price", formData.get("current_price"));
  setTrimmedField(normalizedPayload, "category", formData.get("category"));
  setTrimmedField(normalizedPayload, "order_mode", formData.get("order_mode"));
  setTrimmedField(normalizedPayload, "order_config", formData.get("order_config"));
  setNormalizedAvailabilityField(normalizedPayload, formData.get("is_available"));

  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    normalizedPayload.set("file", file);
  }

  return normalizedPayload;
};

const buildCreateProductFormData = ({
  name,
  imageUrl,
  currentPrice,
  category,
  orderMode,
  orderConfig,
  imageFile,
}: {
  name: string;
  imageUrl?: string;
  currentPrice?: number;
  category?: string;
  orderMode?: ProductOrderMode;
  orderConfig?: ProductOrderConfig;
  imageFile: File;
}): FormData => {
  const payload = new FormData();
  payload.set("name", name);

  if (imageUrl?.trim()) {
    payload.set("image_url", imageUrl.trim());
  }
  if (typeof currentPrice === "number") {
    payload.set("current_price", String(currentPrice));
  }
  if (category) {
    payload.set("category", category);
  }
  if (orderMode) {
    payload.set("order_mode", orderMode);
  }
  if (orderConfig) {
    payload.set("order_config", JSON.stringify(orderConfig));
  }

  payload.set("file", imageFile);
  return payload;
};

export async function adminLoginAction(prevState: ActionState, formData: FormData): Promise<ActionState> {
  const rawData = Object.fromEntries(formData.entries());
  
  // Validate Fields (assuming same loginSchema shape for admin)
  const validated = loginSchema.safeParse(rawData);
  if (!validated.success) {
    return {
      success: false,
      message: "يرجى التحقق من الأخطاء أدناه.",
      errors: validated.error.flatten().fieldErrors,
      timestamp: Date.now(),
    };
  }

  try {
    const payload = {
      phone: validated.data.phone,
      password: validated.data.password,
    };

    const response = await adminService.login(payload);

    // Ensure we read the token correctly based on AdminController response format
    // backend returns { admin_access_token: '...', user: {...} }
    const token = response.data?.admin_access_token;
    
    if (response.success && token) {
      await setCookieAction(STORAGE_KEYS.ADMIN_ACCESS_TOKEN, token);
      // Redirect handled outside
    } else {
      return {
        success: false,
        message: response.message || "بيانات الدخول غير صحيحة",
        timestamp: Date.now(),
      };
    }
  } catch (error) {
    console.error("Admin login action failed:", error);
    return {
      success: false,
      message: "حدث خطأ غير متوقع",
      timestamp: Date.now(),
    };
  }
  
  redirect("/admin");
}

export async function adminLogoutAction() {
  await deleteCookieAction(STORAGE_KEYS.ADMIN_ACCESS_TOKEN);
  await adminService.logout();
  redirect("/admin/login");
}

export async function toggleTenantStatusAction(id: number, currentStatus: string): Promise<void> {
  const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
  const response = await adminService.updateTenantStatus(id, newStatus);
  if (response.success) {
    revalidatePath("/admin/merchants");
  }
}

export async function updateTenantPlanAction(id: number, plan_id: number): Promise<void> {
  const response = await adminService.updateTenantPlan(id, plan_id);
  if (response.success) {
    revalidatePath("/admin/merchants");
  }
}

const parsePositiveInteger = (value: FormDataEntryValue | null) => {
  if (typeof value !== "string") {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const DIRECTORY_STATUSES = new Set(["draft", "listed", "hidden", "suspended"]);

const parseDirectoryStatus = (value: FormDataEntryValue | null) => {
  if (typeof value !== "string" || !DIRECTORY_STATUSES.has(value)) {
    return undefined;
  }

  return value as "draft" | "listed" | "hidden" | "suspended";
};

export async function updateTenantAreasAction(tenantId: number, formData: FormData): Promise<void> {
  const areaId = parsePositiveInteger(formData.get("area_id"));
  if (!areaId) {
    throw new Error("يجب اختيار المنطقة الأساسية للمتجر");
  }

  const deliveryAreaIds = formData
    .getAll("delivery_area_ids")
    .map(parsePositiveInteger)
    .filter((value): value is number => typeof value === "number");

  const uniqueDeliveryAreaIds = Array.from(new Set([areaId, ...deliveryAreaIds]));
  const directoryStatus = parseDirectoryStatus(formData.get("directory_status"));

  const response = await adminService.updateTenantDirectoryProfile(tenantId, {
    area_id: areaId,
    delivery_area_ids: uniqueDeliveryAreaIds,
    directory_status: directoryStatus,
  });

  if (!response.success) {
    throw new Error(response.message || "تعذر تحديث مناطق المتجر");
  }

  revalidatePath("/admin/merchants");
}

export async function updateTenantDirectoryStatusAction(
  tenantId: number,
  _prevState: DirectoryStatusActionState,
  formData: FormData,
): Promise<DirectoryStatusActionState> {
  const directoryStatus = parseDirectoryStatus(formData.get("directory_status"));
  if (!directoryStatus) {
    return {
      success: false,
      message: "حالة الدليل غير صحيحة",
    };
  }

  const response = await adminService.updateTenantDirectoryProfile(tenantId, {
    directory_status: directoryStatus,
  });

  if (!response.success) {
    return {
      success: false,
      message: response.message || "تعذر تحديث حالة الدليل",
    };
  }

  revalidatePath("/admin/merchants");

  return {
    success: true,
  };
}

export async function adminLoadBulkEssentialStagesAction(
  tenantId: number,
): Promise<{
  success: boolean;
  data?: BulkEssentialStage[];
  message?: string;
}> {
  try {
    const response = await adminService.getTenantBulkEssentialStages(tenantId);

    if (!response.success || !response.data) {
      return {
        success: false,
        message: response.message || "تعذر تحميل مجموعات المنتجات الأساسية",
      };
    }

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    console.error("Admin load bulk essential stages failed:", error);
    return {
      success: false,
      message: "تعذر تحميل مجموعات المنتجات الأساسية",
    };
  }
}

export async function adminBulkAddEssentialItemsAction(
  tenantId: number,
  payload:
    | {
        category: string;
        catalogItemIds: number[];
      }
    | string[],
): Promise<
  | {
      success: false;
      message: string;
      data?: undefined;
    }
  | {
      success: true;
      data: { count: number };
      message?: undefined;
    }
> {
  try {
    const response = await adminService.adminBulkAddEssentialItems(
      tenantId,
      Array.isArray(payload)
        ? { categories: payload }
        : {
            category: payload.category,
            catalog_item_ids: payload.catalogItemIds,
          },
    );
    if (!response.success || !response.data) {
      return {
        success: false,
        message: response.message || "تعذر إضافة التشكيلة الأساسية",
      };
    }

    revalidatePath("/admin/merchants");
    revalidatePath("/admin/products");
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    console.error("Admin bulk add essential items failed:", error);
    return {
      success: false,
      message: "تعذر إضافة التشكيلة الأساسية",
    };
  }
}

export async function adminUploadProductCatalogSheetAction(
  tenantId: number,
  formData: FormData,
): Promise<{
  success: boolean;
  message?: string;
  data?: AdminProductSheetUploadSummary;
}> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return {
      success: false,
      message: "ملف المنتجات مطلوب",
    };
  }

  const payload = new FormData();
  payload.set("file", file);

  const response = await adminService.uploadTenantProductCatalogSheet(
    tenantId,
    payload,
  );

  if (!response.success || !response.data) {
    return {
      success: false,
      message: response.message || "تعذر رفع ملف المنتجات",
    };
  }

  revalidatePath("/admin/products");
  return {
    success: true,
    data: response.data,
  };
}

const parseOptionalPositiveNumber = (value: FormDataEntryValue | null) => {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

const parseProductStatus = (value: FormDataEntryValue | null) => {
  return value === "archived" ? "archived" : "active";
};

const parseCheckboxBoolean = (value: FormDataEntryValue | null) =>
  value === "on" || value === "true";

const parseExplicitBoolean = (values: FormDataEntryValue[]) => {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const value = values[index];
    if (typeof value !== "string") continue;
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "on" || normalized === "1") {
      return true;
    }
    if (normalized === "false" || normalized === "0") {
      return false;
    }
  }

  return undefined;
};

export async function adminCreateProductAction(formData: FormData): Promise<void> {
  const tenantId = parsePositiveInteger(formData.get("tenant_id"));
  const name = typeof formData.get("name") === "string"
    ? String(formData.get("name")).trim()
    : "";
  if (!tenantId || !name) {
    throw new Error("يجب اختيار التاجر وكتابة اسم المنتج");
  }

  const category = typeof formData.get("category") === "string"
    ? String(formData.get("category")).trim()
    : "";

  const response = await adminService.createTenantProduct(tenantId, {
    name,
    current_price: parseOptionalPositiveNumber(formData.get("current_price")),
    category: category || undefined,
    is_available: parseCheckboxBoolean(formData.get("is_available")),
  });

  if (!response.success) {
    throw new Error(response.message || "تعذر إضافة المنتج");
  }

  revalidatePath("/admin/products");
}

export async function adminUpdateProductAction(productId: number, formData: FormData): Promise<void> {
  const name = typeof formData.get("name") === "string"
    ? String(formData.get("name")).trim()
    : "";
  if (!name) {
    throw new Error("اسم المنتج مطلوب");
  }

  const category = typeof formData.get("category") === "string"
    ? String(formData.get("category")).trim()
    : "";

  const response = await adminService.updateProduct(productId, {
    name,
    current_price: parseOptionalPositiveNumber(formData.get("current_price")),
    category: category || undefined,
    is_available: parseCheckboxBoolean(formData.get("is_available")),
    status: parseProductStatus(formData.get("status")),
  });

  if (!response.success) {
    throw new Error(response.message || "تعذر تحديث المنتج");
  }

  revalidatePath("/admin/products");
}

export async function adminLoadProductOnboardingAction(
  tenantId: number,
): Promise<{
  success: boolean;
  data?: AdminProductOnboardingData;
  message?: string;
}> {
  try {
    const [products, productCategories, catalogItems, catalogCategories] =
      await Promise.all([
        adminService.getTenantProducts(tenantId),
        adminService.getTenantProductCategories(tenantId),
        adminService.getTenantCatalogItems(tenantId, { page: 1, limit: 40 }),
        adminService.getTenantCatalogCategories(tenantId),
      ]);

    return {
      success: true,
      data: {
        products: products.success && products.data ? products.data : [],
        productCategories:
          productCategories.success && productCategories.data
            ? productCategories.data
            : [],
        catalogItemsResponse:
          catalogItems.success && catalogItems.data
            ? catalogItems.data
            : createEmptyCatalogItemsResponse(),
        catalogCategories:
          catalogCategories.success && catalogCategories.data
            ? catalogCategories.data
            : [],
      },
    };
  } catch (error) {
    console.error("Admin product onboarding load failed:", error);
    return {
      success: false,
      message: "تعذر تحميل بيانات منتجات التاجر",
    };
  }
}

export async function adminCreateProductForTenantAction(
  tenantId: number,
  name: string,
  imageUrl?: string,
  currentPrice?: number,
  category?: string,
  orderMode?: ProductOrderMode,
  orderConfig?: ProductOrderConfig,
  imageFile?: File | null,
) {
  try {
    const normalizedName = name.trim();
    const normalizedCategory = category?.trim() || undefined;

    if (imageFile && imageFile.size > 0) {
      const payload = buildCreateProductFormData({
        name: normalizedName,
        imageUrl,
        currentPrice,
        category: normalizedCategory,
        orderMode,
        orderConfig,
        imageFile,
      });
      const response = await adminService.createTenantProductPayload(
        tenantId,
        payload,
      );

      if (!response.success || !response.data) {
        return {
          success: false,
          message: normalizeUpdateProductErrorMessage(response.message),
        };
      }

      revalidatePath("/admin/products");
      return { success: true, data: response.data };
    }

    const response = await adminService.createTenantProductPayload(tenantId, {
      name: normalizedName,
      image_url: imageUrl,
      current_price: currentPrice,
      category: normalizedCategory,
      order_mode: orderMode,
      order_config: orderConfig,
    });

    if (!response.success || !response.data) {
      return {
        success: false,
        message: response.message || "تعذر إضافة المنتج",
      };
    }

    revalidatePath("/admin/products");
    return { success: true, data: response.data };
  } catch (error) {
    console.error("Admin create product failed:", error);
    return {
      success: false,
      message: normalizeUpdateProductErrorMessage(
        error instanceof Error ? error.message : undefined,
      ),
    };
  }
}

export async function adminAddProductFromCatalogAction(
  tenantId: number,
  catalogItemId: number,
) {
  try {
    const response = await adminService.addTenantProductFromCatalog(
      tenantId,
      catalogItemId,
    );

    if (!response.success || !response.data) {
      return {
        success: false,
        message: response.message || "تعذر إضافة المنتج من الكتالوج",
      };
    }

    revalidatePath("/admin/products");
    return { success: true, data: response.data };
  } catch (error) {
    console.error("Admin add product from catalog failed:", error);
    return {
      success: false,
      message: "تعذر إضافة المنتج من الكتالوج",
    };
  }
}

export async function adminLoadCatalogItemsAction(
  tenantId: number,
  params: LoadCatalogItemsParams,
): Promise<{
  success: boolean;
  data?: CatalogItemsResponse;
  message?: string;
}> {
  try {
    const response = await adminService.getTenantCatalogItems(tenantId, params);

    if (!response.success || !response.data) {
      return {
        success: false,
        message: response.message || "تعذر تحميل منتجات الكتالوج",
      };
    }

    return { success: true, data: response.data };
  } catch (error) {
    console.error("Admin load catalog items failed:", error);
    return {
      success: false,
      message: "تعذر تحميل منتجات الكتالوج",
    };
  }
}

export async function adminSearchTenantProductsAction(
  tenantId: number,
  search: string,
  page = 1,
  limit = 20,
  categoryOrOptions?:
    | string
    | {
        category?: string;
        rankAll?: boolean;
        excludeProductIds?: number[];
      },
) {
  try {
    const normalizedSearch = search.trim();
    if (normalizedSearch.length < 2) {
      return {
        success: true,
        data: {
          data: [],
          meta: {
            total: 0,
            page: 1,
            limit,
            last_page: 1,
            has_next: false,
          },
        },
      };
    }

    const searchOptions =
      typeof categoryOrOptions === "string"
        ? { category: categoryOrOptions }
        : categoryOrOptions || {};
    const normalizedExcludedProductIds = Array.from(
      new Set(
        (searchOptions.excludeProductIds || []).filter(
          (id): id is number =>
            Number.isInteger(id) && Number.isFinite(id) && id > 0,
        ),
      ),
    );

    const response = await adminService.searchTenantProducts(tenantId, {
      search: normalizedSearch,
      category: searchOptions.category?.trim() || undefined,
      page,
      limit,
      rank_all: searchOptions.rankAll,
      exclude_product_ids:
        normalizedExcludedProductIds.length > 0
          ? normalizedExcludedProductIds.join(",")
          : undefined,
    });

    if (!response.success || !response.data) {
      return {
        success: false,
        message: response.message || "تعذر تحميل نتائج البحث",
      };
    }

    return { success: true, data: response.data };
  } catch (error) {
    console.error("Admin search tenant products failed:", error);
    return {
      success: false,
      message: "تعذر تحميل نتائج البحث",
    };
  }
}

export async function adminUpdateProductPayloadAction(
  productId: number,
  formData: FormData,
) {
  try {
    const normalizedPayload = normalizeProductFormData(formData);
    const response = await adminService.updateProductPayload(
      productId,
      normalizedPayload,
    );

    if (!response.success || !response.data) {
      return {
        success: false,
        message: normalizeUpdateProductErrorMessage(response.message),
      };
    }

    revalidatePath("/admin/products");
    return { success: true, data: response.data as Product };
  } catch (error) {
    console.error("Admin update product failed:", error);
    return {
      success: false,
      message: normalizeUpdateProductErrorMessage(
        error instanceof Error ? error.message : undefined,
      ),
    };
  }
}

export async function adminUpdateProductAvailabilityAction(
  productId: number,
  isAvailable: boolean,
) {
  const formData = new FormData();
  formData.set("is_available", String(isAvailable));
  return adminUpdateProductPayloadAction(productId, formData);
}

export async function adminBulkUpdateProductsAction(payload: {
  ids: number[];
  category?: string;
  is_available?: boolean;
  status?: "active" | "archived";
}) {
  try {
    const ids = Array.from(
      new Set(
        payload.ids.filter(
          (id) => Number.isInteger(id) && Number.isFinite(id) && id > 0,
        ),
      ),
    );
    const category = payload.category?.trim();
    const hasAction =
      Boolean(category) ||
      payload.is_available !== undefined ||
      payload.status !== undefined;

    if (ids.length === 0 || !hasAction) {
      return {
        success: false,
        message: "اختر منتجات وإجراء للتطبيق",
      };
    }

    const response = await adminService.bulkUpdateProducts({
      ids,
      category: category || undefined,
      is_available: payload.is_available,
      status: payload.status,
    });

    if (!response.success) {
      return {
        success: false,
        message: response.message || "تعذر تحديث المنتجات المحددة",
      };
    }

    revalidatePath("/admin/products");
    return { success: true, data: response.data };
  } catch (error) {
    console.error("Admin bulk update products failed:", error);
    return {
      success: false,
      message: "تعذر تحديث المنتجات المحددة",
    };
  }
}

export async function adminRemoveProductAction(productId: number) {
  try {
    const response = await adminService.removeProduct(productId);

    if (!response.success) {
      return {
        success: false,
        message: response.message || "تعذر حذف المنتج",
      };
    }

    revalidatePath("/admin/products");
    return {
      success: true,
      message: "تم حذف المنتج",
    };
  } catch (error) {
    console.error("Admin remove product failed:", error);
    return {
      success: false,
      message: "تعذر حذف المنتج",
    };
  }
}

const ADMIN_CATALOG_ITEMS_PATH = "/admin/catalog-items";
const ADMIN_CATEGORIES_PATH = "/admin/categories";
const ADMIN_CATALOG_SOURCES = new Set(["talabat_csv", "chefaa_csv"]);

const parseNullableString = (value: FormDataEntryValue | null) => {
  if (typeof value !== "string") {
    return null;
  }

  return value.trim() || null;
};

const appendTrimmedFormDataField = (
  target: FormData,
  key: string,
  value: FormDataEntryValue | null,
) => {
  if (typeof value !== "string") {
    return;
  }

  const trimmedValue = value.trim();
  if (trimmedValue) {
    target.set(key, trimmedValue);
  }
};

const appendOptionalFileField = (
  target: FormData,
  file: FormDataEntryValue | null,
) => {
  if (file instanceof File && file.size > 0) {
    target.set("file", file);
  }
};

const parseAdminCatalogSource = (
  value: FormDataEntryValue | null,
): AdminCatalogSource | null => {
  if (typeof value !== "string" || !ADMIN_CATALOG_SOURCES.has(value)) {
    return null;
  }

  return value as AdminCatalogSource;
};


const buildAdminCatalogItemFormData = (
  formData: FormData,
  includeSource: boolean,
) => {
  const payload = new FormData();
  if (includeSource) {
    appendTrimmedFormDataField(payload, "source", formData.get("source"));
  }
  appendTrimmedFormDataField(payload, "name", formData.get("name"));
  appendTrimmedFormDataField(payload, "category", formData.get("category"));
  appendTrimmedFormDataField(payload, "price", formData.get("price"));
  appendTrimmedFormDataField(payload, "currency", formData.get("currency"));
  appendTrimmedFormDataField(payload, "image_url", formData.get("image_url"));
  appendTrimmedFormDataField(payload, "external_id", formData.get("external_id"));
  appendTrimmedFormDataField(
    payload,
    "essential_sort_order",
    formData.get("essential_sort_order"),
  );
  appendOptionalFileField(payload, formData.get("file"));
  const isActive = parseExplicitBoolean(formData.getAll("is_active"));
  const isEssential = parseExplicitBoolean(formData.getAll("is_essential"));
  if (isActive !== undefined) {
    payload.set("is_active", String(isActive));
  }
  if (isEssential !== undefined) {
    payload.set("is_essential", String(isEssential));
  }

  return payload;
};

export async function adminCreateCatalogItemAction(
  formData: FormData,
): Promise<void> {
  const source = parseAdminCatalogSource(formData.get("source"));
  const name = parseNullableString(formData.get("name"));
  const category = parseNullableString(formData.get("category"));
  if (!source || !name || !category) {
    throw new Error("المصدر واسم المنتج والتصنيف مطلوبة");
  }

  const response = await adminService.createAdminCatalogItem(
    buildAdminCatalogItemFormData(formData, true),
  );

  if (!response.success) {
    throw new Error(response.message || "تعذر إضافة عنصر الكتالوج");
  }

  revalidatePath(ADMIN_CATALOG_ITEMS_PATH);
}

export async function adminUpdateCatalogItemAction(
  catalogItemId: number,
  formData: FormData,
): Promise<AdminCatalogItem | undefined> {
  const name = parseNullableString(formData.get("name"));
  const category = parseNullableString(formData.get("category"));
  if (!name || !category) {
    throw new Error("اسم المنتج والتصنيف مطلوبان");
  }

  const response = await adminService.updateAdminCatalogItem(
    catalogItemId,
    buildAdminCatalogItemFormData(formData, false),
  );

  if (!response.success) {
    throw new Error(response.message || "تعذر تحديث عنصر الكتالوج");
  }

  revalidatePath(ADMIN_CATALOG_ITEMS_PATH);
  return response.data;
}

export async function adminUpdateCatalogItemPayloadAction(
  catalogItemId: number,
  payload: Exclude<UpdateAdminCatalogItemPayload, FormData>,
): Promise<AdminCatalogItem | undefined> {
  const name = payload.name?.trim();
  const category = payload.category?.trim();
  if (!name || !category) {
    throw new Error("اسم المنتج والتصنيف مطلوبان");
  }

  const response = await adminService.updateAdminCatalogItem(catalogItemId, {
    ...payload,
    name,
    category,
  });

  if (!response.success) {
    throw new Error(response.message || "تعذر تحديث عنصر الكتالوج");
  }

  revalidatePath(ADMIN_CATALOG_ITEMS_PATH);
  return response.data;
}

export async function adminDeleteCatalogItemAction(
  catalogItemId: number,
): Promise<void> {
  const response = await adminService.deleteAdminCatalogItem(catalogItemId);
  if (!response.success) {
    throw new Error(response.message || "تعذر تعطيل عنصر الكتالوج");
  }

  revalidatePath(ADMIN_CATALOG_ITEMS_PATH);
}

export async function adminBulkUpdateCatalogItemsAction(payload: {
  ids: number[];
  category?: string;
  is_active?: boolean;
  is_essential?: boolean;
}) {
  try {
    const ids = Array.from(
      new Set(
        payload.ids.filter(
          (id) => Number.isInteger(id) && Number.isFinite(id) && id > 0,
        ),
      ),
    );
    const category = payload.category?.trim();
    const hasAction =
      Boolean(category) ||
      payload.is_active !== undefined ||
      payload.is_essential !== undefined;

    if (ids.length === 0 || !hasAction) {
      return {
        success: false,
        message: "اختر عناصر كتالوج وإجراء للتطبيق",
      };
    }

    const response = await adminService.bulkUpdateAdminCatalogItems({
      ids,
      category: category || undefined,
      is_active: payload.is_active,
      is_essential: payload.is_essential,
    });

    if (!response.success) {
      return {
        success: false,
        message: response.message || "تعذر تحديث عناصر الكتالوج المحددة",
      };
    }

    revalidatePath(ADMIN_CATALOG_ITEMS_PATH);
    return { success: true, data: response.data };
  } catch (error) {
    console.error("Admin bulk update catalog items failed:", error);
    return {
      success: false,
      message: "تعذر تحديث عناصر الكتالوج المحددة",
    };
  }
}

export async function adminCreateCatalogCategoryAction(
  formData: FormData,
): Promise<void> {
  const source = parseAdminCatalogSource(formData.get("source"));
  const name = parseNullableString(formData.get("name"));
  if (!source || !name) {
    throw new Error("المصدر واسم التصنيف مطلوبان");
  }

  const response = await adminService.createAdminCatalogCategory({
    source,
    name,
  });

  if (!response.success) {
    throw new Error(response.message || "تعذر إضافة التصنيف");
  }

  revalidatePath(ADMIN_CATEGORIES_PATH);
  revalidatePath(ADMIN_CATALOG_ITEMS_PATH);
}

export async function adminUpdateCatalogCategoryAction(
  categoryId: number,
  formData: FormData,
): Promise<void> {
  const name = parseNullableString(formData.get("name"));
  if (!name) {
    throw new Error("اسم التصنيف مطلوب");
  }

  const response = await adminService.updateAdminCatalogCategory(categoryId, {
    name,
  });

  if (!response.success) {
    throw new Error(response.message || "تعذر تعديل التصنيف");
  }

  revalidatePath(ADMIN_CATEGORIES_PATH);
  revalidatePath(ADMIN_CATALOG_ITEMS_PATH);
}

export async function adminDeleteCatalogCategoryAction(
  categoryId: number,
): Promise<void> {
  const response = await adminService.deleteAdminCatalogCategory(categoryId);
  if (!response.success) {
    throw new Error(response.message || "تعذر حذف التصنيف");
  }

  revalidatePath(ADMIN_CATEGORIES_PATH);
  revalidatePath(ADMIN_CATALOG_ITEMS_PATH);
}

export async function adminCreateTenantProductCategoryAction(
  tenantId: number,
  formData: FormData,
): Promise<void> {
  const name = parseNullableString(formData.get("name"));
  if (!name) {
    throw new Error("اسم التصنيف مطلوب");
  }

  const response = await adminService.createAdminTenantProductCategory(
    tenantId,
    { name },
  );

  if (!response.success) {
    throw new Error(response.message || "تعذر إضافة تصنيف التاجر");
  }

  revalidatePath(ADMIN_CATEGORIES_PATH);
  revalidatePath("/admin/products");
}

export async function adminUpdateTenantProductCategoryAction(
  tenantId: number,
  categoryId: number,
  formData: FormData,
): Promise<void> {
  const name = parseNullableString(formData.get("name"));
  if (!name) {
    throw new Error("اسم التصنيف مطلوب");
  }

  const response = await adminService.updateAdminTenantProductCategory(
    tenantId,
    categoryId,
    { name },
  );

  if (!response.success) {
    throw new Error(response.message || "تعذر تعديل تصنيف التاجر");
  }

  revalidatePath(ADMIN_CATEGORIES_PATH);
  revalidatePath("/admin/products");
}

export async function adminDeleteTenantProductCategoryAction(
  tenantId: number,
  categoryId: number,
): Promise<void> {
  const response = await adminService.deleteAdminTenantProductCategory(
    tenantId,
    categoryId,
  );

  if (!response.success) {
    throw new Error(response.message || "تعذر حذف تصنيف التاجر");
  }

  revalidatePath(ADMIN_CATEGORIES_PATH);
  revalidatePath("/admin/products");
}

export async function togglePlanStatusAction(id: number, currentStatus: boolean): Promise<void> {
  const response = await adminService.togglePlanStatus(id, !currentStatus);
  if (response.success) {
    revalidatePath("/admin/plans");
  }
}

export async function uploadCatalogImportAction(formData: FormData): Promise<void> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("ملف الاستيراد مطلوب");
  }

  const cleanFormData = new FormData();
  cleanFormData.set("file", file);
  cleanFormData.set("type", "catalog_items");
  cleanFormData.set("mode", String(formData.get("mode") || "upsert"));

  const format = formData.get("format");
  if (format) {
    cleanFormData.set("format", String(format));
  }

  const response = await adminService.createImport(cleanFormData);
  if (response.success && response.data?.id) {
    revalidatePath("/admin/imports");
    redirect(`/admin/imports/${response.data.id}`);
  }

  throw new Error(response.message || "تعذر رفع ملف الاستيراد");
}

export async function cancelImportAction(id: number): Promise<void> {
  const response = await adminService.cancelImport(id);
  if (!response.success) {
    throw new Error(response.message || "تعذر إلغاء الاستيراد");
  }
  revalidatePath("/admin/imports");
  revalidatePath(`/admin/imports/${id}`);
}

import { AdminDirectoryArea } from "@/services/api/admin.service";

export async function createDirectoryAreaAction(payload: Partial<AdminDirectoryArea>): Promise<void> {
  const response = await adminService.createDirectoryArea(payload);
  if (!response.success) {
    throw new Error(response.message || "تعذر إضافة المنطقة");
  }
  revalidatePath("/admin/areas");
}

export async function updateDirectoryAreaAction(id: number, payload: Partial<AdminDirectoryArea>): Promise<void> {
  const response = await adminService.updateDirectoryArea(id, payload);
  if (!response.success) {
    throw new Error(response.message || "تعذر تحديث المنطقة");
  }
  revalidatePath("/admin/areas");
}

export async function deleteDirectoryAreaAction(id: number): Promise<void> {
  const response = await adminService.deleteDirectoryArea(id);
  if (!response.success) {
    throw new Error(response.message || "تعذر حذف المنطقة، قد تكون مستخدمة");
  }
  revalidatePath("/admin/areas");
}
