"use server";

import { adminService } from "@/services/api/admin.service";
import { redirect } from "next/navigation";
import { setCookieAction, deleteCookieAction } from "@/actions/cookie-actions";
import { STORAGE_KEYS } from "@/constants";
import { revalidatePath } from "next/cache";
import { loginSchema } from "@/lib/validations/auth";
import { isNextRedirectError } from "@/lib/auth/navigation-errors";
import { getManagedStoreFallbackPath } from "@/lib/admin-managed-access";
import { normalizeDeliveryConfiguration } from "@/lib/delivery-configuration";
import type {
  BulkEssentialStage,
  CatalogItemsResponse,
  Product,
  ProductOrderConfig,
  ProductOrderMode,
  ProductStatus,
  PublicProductCategory,
} from "@/types/models/product";
import type {
  AdminCatalogItem,
  AdminCatalogSource,
  AdminDirectoryArea,
  AdminDirectoryAreaPayload,
  AdminMissingDeliveryAreaRequest,
  AdminManagedPermission,
  AdminProductSheetUploadSummary,
  DeleteTenantProductsSummary,
  UpdateAdminCatalogItemPayload,
} from "@/services/api/admin.service";
import { z } from "zod";

const ADMIN_SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

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

export type AdminMerchantSearchSuggestion = {
  id: number;
  name: string;
  phone: string;
};

export async function searchAdminMerchantsAction(
  query: string,
): Promise<AdminMerchantSearchSuggestion[]> {
  const normalizedQuery = query.trim().slice(0, 100);
  if (!normalizedQuery) return [];

  try {
    const response = await adminService.getTenants({
      search: normalizedQuery,
      limit: 5,
    });
    if (!response.success || !response.data) return [];

    const tenants = Array.isArray(response.data)
      ? response.data
      : response.data.data;

    return tenants.slice(0, 5).map((tenant) => ({
      id: tenant.id,
      name: tenant.name,
      phone: tenant.phone,
    }));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    console.error("Admin merchant suggestion search failed:", error);
    return [];
  }
}

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
      await setCookieAction(STORAGE_KEYS.ADMIN_ACCESS_TOKEN, token, {
        maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
      });
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

export async function adminLogoutAction(_formData?: FormData) {
  void _formData;
  await adminService.logout();
  await Promise.all([
    deleteCookieAction(STORAGE_KEYS.ADMIN_ACCESS_TOKEN),
    deleteCookieAction(STORAGE_KEYS.ADMIN_MANAGEMENT_SESSION),
  ]);
  redirect("/admin/login");
}

const managementReasonSchema = z.string().trim().min(10).max(500);
const positiveIdSchema = z.number().int().positive();

const managedPermissionValues = [
  "products.read",
  "products.create",
  "products.update",
  "products.update_price",
  "products.update_availability",
  "products.archive",
  "orders.read",
  "orders.update_status",
  "orders.update_pricing",
  "orders.manage_replacements",
  "customers.read_limited",
  "activity_logs.read",
] as const;

const managedPermissionSchema = z.enum(managedPermissionValues);

const managedPermissionPresets: Record<string, AdminManagedPermission[]> = {
  catalog_operator: [
    "products.read",
    "products.create",
    "products.update",
    "products.update_price",
    "products.update_availability",
    "products.archive",
    "activity_logs.read",
  ],
  order_operator: [
    "orders.read",
    "orders.update_status",
    "orders.update_pricing",
    "orders.manage_replacements",
    "customers.read_limited",
    "products.read",
    "products.update_availability",
    "activity_logs.read",
  ],
};
managedPermissionPresets.store_manager = Array.from(
  new Set([
    ...managedPermissionPresets.catalog_operator,
    ...managedPermissionPresets.order_operator,
  ]),
);

export async function startManagedStoreSessionAction(
  tenantId: number,
  formData: FormData,
): Promise<void> {
  const normalizedTenantId = positiveIdSchema.parse(tenantId);
  const reason = managementReasonSchema.parse(formData.get("reason"));
  const response = await adminService.startManagementSession({
    tenant_id: normalizedTenantId,
    reason,
  });
  const token = response.data?.session_token;
  const session = response.data?.session;
  const expiresAt = session?.expires_at;
  if (!response.success || !token || !session || !expiresAt) {
    throw new Error(response.message || "تعذر بدء جلسة إدارة المتجر");
  }

  const maxAge = Math.max(
    1,
    Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000),
  );
  await setCookieAction(STORAGE_KEYS.ADMIN_MANAGEMENT_SESSION, token, {
    maxAge,
  });
  redirect(getManagedStoreFallbackPath(session));
}

export async function endManagedStoreSessionAction(
  tenantId: number,
): Promise<void> {
  positiveIdSchema.parse(tenantId);
  await adminService.endCurrentManagementSession();
  await deleteCookieAction(STORAGE_KEYS.ADMIN_MANAGEMENT_SESSION);
  redirect(`/admin/merchants/${tenantId}`);
}

export async function upsertManagedTenantAccessAction(
  tenantId: number,
  formData: FormData,
): Promise<void> {
  const normalizedTenantId = positiveIdSchema.parse(tenantId);
  const adminUserId = positiveIdSchema.parse(Number(formData.get("admin_user_id")));
  const customPermissions = formData
    .getAll("permissions")
    .map(String)
    .map((permission) => managedPermissionSchema.parse(permission));
  const preset = String(formData.get("preset") || "");
  const permissions = customPermissions.length > 0
    ? customPermissions
    : managedPermissionPresets[preset] || [];
  if (permissions.length === 0) {
    throw new Error("اختر مجموعة صلاحيات واحدة على الأقل");
  }
  const expiresAtValue = String(formData.get("expires_at") || "").trim();
  const expiresAt = expiresAtValue
    ? new Date(expiresAtValue).toISOString()
    : null;

  const response = await adminService.upsertTenantAccess(
    normalizedTenantId,
    adminUserId,
    { permissions, expires_at: expiresAt },
  );
  if (!response.success) {
    throw new Error(response.message || "تعذر حفظ صلاحيات إدارة المتجر");
  }
  revalidatePath(`/admin/merchants/${normalizedTenantId}`);
}

export async function revokeManagedTenantAccessAction(
  tenantId: number,
  adminUserId: number,
): Promise<void> {
  positiveIdSchema.parse(tenantId);
  positiveIdSchema.parse(adminUserId);
  const response = await adminService.revokeTenantAccess(tenantId, adminUserId);
  if (!response.success) {
    throw new Error(response.message || "تعذر إلغاء الصلاحية");
  }
  revalidatePath(`/admin/merchants/${tenantId}`);
}

export async function updateManagedOrderStatusAction(
  tenantId: number,
  orderId: number,
  formData: FormData,
): Promise<void> {
  const status = z.enum([
    "draft",
    "confirmed",
    "out_for_delivery",
    "completed",
    "cancelled",
  ]).parse(formData.get("status"));
  const cancellationReason = String(formData.get("cancellation_reason") || "").trim();
  const response = await adminService.updateManagedOrderStatus(tenantId, orderId, {
    status,
    cancellation_reason: cancellationReason || undefined,
  });
  if (!response.success) throw new Error(response.message || "تعذر تحديث حالة الطلب");
  revalidatePath(`/admin/merchants/${tenantId}/manage/orders`);
  revalidatePath(`/admin/merchants/${tenantId}/manage/orders/${orderId}`);
}

export async function updateManagedOrderTotalAction(
  tenantId: number,
  orderId: number,
  formData: FormData,
): Promise<void> {
  const total = z.coerce.number().min(0).parse(formData.get("total"));
  const response = await adminService.updateManagedOrderPricing(tenantId, orderId, total);
  if (!response.success) throw new Error(response.message || "تعذر تحديث إجمالي الطلب");
  revalidatePath(`/admin/merchants/${tenantId}/manage/orders/${orderId}`);
}

/** Prices a deferred delivery zone on a managed tenant's order. */
export async function setManagedOrderDeliveryFeeAction(
  tenantId: number,
  orderId: number,
  formData: FormData,
): Promise<void> {
  const deliveryFee = z.coerce
    .number()
    .min(0)
    .parse(formData.get("delivery_fee"));
  const response = await adminService.setManagedOrderDeliveryFee(
    tenantId,
    orderId,
    deliveryFee,
  );
  if (!response.success)
    throw new Error(response.message || "تعذر تحديد رسوم التوصيل");
  revalidatePath(`/admin/merchants/${tenantId}/manage/orders/${orderId}`);
}

export async function updateManagedOrderItemAction(
  tenantId: number,
  orderId: number,
  itemId: number,
  action: "price" | "out-of-stock" | "replacement" | "replacement-reset",
  formData?: FormData,
): Promise<void> {
  let payload: Record<string, unknown> = {};
  if (action === "price") {
    payload = {
      total_price: z.coerce.number().positive().parse(formData?.get("total_price")),
    };
  } else if (action === "replacement") {
    payload = {
      replaced_by_product_id: positiveIdSchema.parse(
        Number(formData?.get("replaced_by_product_id")),
      ),
    };
  }
  const response = await adminService.updateManagedOrderItem(
    tenantId,
    itemId,
    action,
    payload,
  );
  if (!response.success) throw new Error(response.message || "تعذر تحديث منتج الطلب");
  revalidatePath(`/admin/merchants/${tenantId}/manage/orders`);
  revalidatePath(`/admin/merchants/${tenantId}/manage/orders/${orderId}`);
}

export async function toggleTenantStatusAction(
  id: number,
  currentStatus: string,
): Promise<void> {
  const newStatus = currentStatus === "active" ? "suspended" : "active";
  const response = await adminService.updateTenantStatus(id, newStatus);
  if (response.success) {
    revalidatePath("/admin");
    revalidatePath("/admin/merchants");
  }
}

export async function decideTenantApplicationAction(
  id: number,
  decision: "active" | "rejected",
): Promise<void> {
  const response = await adminService.updateTenantStatus(id, decision);
  if (response.success) {
    revalidatePath("/admin");
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
const ADMIN_DELIVERY_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

const parseDirectoryStatus = (value: FormDataEntryValue | null) => {
  if (typeof value !== "string" || !DIRECTORY_STATUSES.has(value)) {
    return undefined;
  }

  return value as "draft" | "listed" | "hidden" | "suspended";
};

export type AdminDeliveryConfigurationState = {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>;
};

const adminDeliveryConfigurationSchema = z
  .object({
    delivery_available: z.boolean(),
    delivery_starts_at: z.string().nullable().optional(),
    delivery_ends_at: z.string().nullable().optional(),
    main_area_ids: z.array(z.coerce.number().int().positive()).min(1),
    delivery_areas: z.array(
      z.object({
        area_id: z.coerce.number().int().positive(),
        delivery_fee: z.coerce.number().min(0),
        fee_mode: z.enum(["fixed", "on_order"]).default("fixed"),
        min_delivery_fee: z.coerce.number().min(0).nullable().optional(),
        max_delivery_fee: z.coerce.number().min(0).nullable().optional(),
      }),
    ),
  })
  .superRefine((data, ctx) => {
    const invertedRange = data.delivery_areas.some(
      (area) =>
        area.fee_mode === "on_order" &&
        area.min_delivery_fee != null &&
        area.max_delivery_fee != null &&
        area.min_delivery_fee > area.max_delivery_fee,
    );
    if (invertedRange) {
      ctx.addIssue({
        code: "custom",
        path: ["delivery_areas"],
        message: "أقل رسوم توصيل يجب أن تكون أقل من أو تساوي أعلى رسوم",
      });
    }
    if (data.delivery_available && data.delivery_areas.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["delivery_areas"],
        message: "اختر منطقة توصيل واحدة على الأقل",
      });
    }
    const areaIds = data.delivery_areas.map((area) => area.area_id);
    if (new Set(areaIds).size !== areaIds.length) {
      ctx.addIssue({
        code: "custom",
        path: ["delivery_areas"],
        message: "لا يمكن تكرار منطقة التوصيل",
      });
    }
    const overlaps = areaIds.filter((id) => data.main_area_ids.includes(id));
    if (overlaps.length > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["delivery_areas"],
        message: "المناطق الأساسية لا يمكن إضافتها ضمن مناطق التوصيل",
      });
    }
    const start = data.delivery_starts_at || "";
    const end = data.delivery_ends_at || "";
    if (Boolean(start) !== Boolean(end)) {
      ctx.addIssue({
        code: "custom",
        path: ["delivery_configuration"],
        message: "أدخل وقت البداية والنهاية للتوصيل",
      });
    } else if (
      start &&
      end &&
      (!ADMIN_DELIVERY_TIME_PATTERN.test(start) ||
        !ADMIN_DELIVERY_TIME_PATTERN.test(end))
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["delivery_configuration"],
        message: "تأكد من كتابة الوقت بصيغة صحيحة",
      });
    } else if (start && end) {
      const [startHours, startMinutes] = start.split(":").map(Number);
      const [endHours, endMinutes] = end.split(":").map(Number);
      const startMins = startHours * 60 + startMinutes;
      let endMins = endHours * 60 + endMinutes;
      if (endMins <= startMins) {
        endMins += 24 * 60;
      }
      if (endMins - startMins < 60) {
        ctx.addIssue({
          code: "custom",
          path: ["delivery_configuration"],
          message: "يجب أن تكون مدة التشغيل ساعة على الأقل",
        });
      }
    }
  });

export async function updateTenantAreasAction(
  tenantId: number,
  _previousState: AdminDeliveryConfigurationState,
  formData: FormData,
): Promise<AdminDeliveryConfigurationState> {
  let input: unknown = null;
  try {
    input = JSON.parse(String(formData.get("delivery_configuration") || ""));
  } catch {
    input = null;
  }
  const parsed = adminDeliveryConfigurationSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message: "راجع مناطق ورسوم التوصيل.",
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const response = await adminService.updateTenantDeliveryConfiguration(
    tenantId,
    normalizeDeliveryConfiguration(parsed.data),
  );
  if (!response.success) {
    return {
      success: false,
      message: response.message || "تعذر تحديث مناطق ورسوم التوصيل",
    };
  }

  revalidatePath("/admin/merchants");
  revalidatePath("/");
  revalidatePath("/stores");
  revalidatePath("/stores/[areaSlug]/[categorySlug]", "page");
  if (response.data?.slug) {
    revalidatePath(`/${response.data.slug}`);
  }
  return {
    success: true,
    message: "تم حفظ مناطق ورسوم التوصيل.",
  };
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
        allEssentialItems: true;
      }
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
        : "allEssentialItems" in payload
          ? { all_essential_items: payload.allEssentialItems }
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
  status: ProductStatus = "active",
): Promise<{
  success: boolean;
  data?: AdminProductOnboardingData;
  message?: string;
}> {
  try {
    const [products, productCategories, catalogItems, catalogCategories] =
      await Promise.all([
        adminService.getTenantProducts(tenantId, { status }),
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
        status?: ProductStatus;
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
      status: searchOptions.status,
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

export async function adminDeleteTenantProductsAction(tenantId: number): Promise<{
  success: boolean;
  data?: DeleteTenantProductsSummary;
  message?: string;
}> {
  try {
    if (!Number.isInteger(tenantId) || tenantId <= 0) {
      return {
        success: false,
        message: "معرف التاجر غير صالح",
      };
    }

    const response = await adminService.deleteTenantProducts(tenantId);

    if (!response.success) {
      return {
        success: false,
        message: response.message || "تعذر حذف منتجات التاجر",
      };
    }

    revalidatePath("/admin/merchants");
    return {
      success: true,
      data: response.data,
      message: "تم تنفيذ عملية الحذف",
    };
  } catch (error) {
    console.error("Admin delete tenant products failed:", error);
    return {
      success: false,
      message: "تعذر حذف منتجات التاجر",
    };
  }
}

const ADMIN_CATALOG_ITEMS_PATH = "/admin/catalog-items";
const ADMIN_CATEGORIES_PATH = "/admin/categories";
const ADMIN_CATALOG_SOURCES = new Set(["talabat_csv", "chefaa_csv"]);

export type AdminCatalogItemMutationResult =
  | { success: true; data?: AdminCatalogItem }
  | { success: false; message: string };

const normalizeAdminCatalogItemErrorMessage = (
  message: string | undefined,
  fallback: string,
) => {
  const normalized = message?.trim();
  if (!normalized) return fallback;

  if (
    /(category is not active|category is not supported|category name is required|name and category are required)/i.test(
      normalized,
    )
  ) {
    return "التصنيف المختار غير متاح لهذا الكتالوج. اختر تصنيفًا من القائمة.";
  }

  if (/image url is not allowed/i.test(normalized)) {
    return "رابط الصورة غير مسموح لهذا الكتالوج. ارفع صورة أو استخدم رابطًا معتمدًا.";
  }

  if (/essential.*inactive|inactive.*essential/i.test(normalized)) {
    return "لا يمكن جعل العنصر أساسيًا وغير نشط في الوقت نفسه.";
  }

  return normalized;
};

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
): Promise<AdminCatalogItemMutationResult> {
  const source = parseAdminCatalogSource(formData.get("source"));
  const name = parseNullableString(formData.get("name"));
  const category = parseNullableString(formData.get("category"));
  if (!source || !name || !category) {
    return { success: false, message: "المصدر واسم المنتج والتصنيف مطلوبة" };
  }

  try {
    const response = await adminService.createAdminCatalogItem(
      buildAdminCatalogItemFormData(formData, true),
    );

    if (!response.success) {
      return {
        success: false,
        message: normalizeAdminCatalogItemErrorMessage(
          response.message,
          "تعذر إضافة عنصر الكتالوج",
        ),
      };
    }

    revalidatePath(ADMIN_CATALOG_ITEMS_PATH);
    return { success: true, data: response.data };
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    console.error("Admin create catalog item failed:", error);
    return { success: false, message: "تعذر إضافة عنصر الكتالوج" };
  }
}

export async function adminUpdateCatalogItemAction(
  catalogItemId: number,
  formData: FormData,
): Promise<AdminCatalogItemMutationResult> {
  const name = parseNullableString(formData.get("name"));
  const category = parseNullableString(formData.get("category"));
  if (!name || !category) {
    return { success: false, message: "اسم المنتج والتصنيف مطلوبان" };
  }

  try {
    const response = await adminService.updateAdminCatalogItem(
      catalogItemId,
      buildAdminCatalogItemFormData(formData, false),
    );

    if (!response.success) {
      return {
        success: false,
        message: normalizeAdminCatalogItemErrorMessage(
          response.message,
          "تعذر تحديث عنصر الكتالوج",
        ),
      };
    }

    revalidatePath(ADMIN_CATALOG_ITEMS_PATH);
    return { success: true, data: response.data };
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    console.error("Admin update catalog item failed:", error);
    return { success: false, message: "تعذر تحديث عنصر الكتالوج" };
  }
}

export async function adminUpdateCatalogItemPayloadAction(
  catalogItemId: number,
  payload: Exclude<UpdateAdminCatalogItemPayload, FormData>,
): Promise<AdminCatalogItemMutationResult> {
  const name = payload.name?.trim();
  const category = payload.category?.trim();
  if (!name || !category) {
    return { success: false, message: "اسم المنتج والتصنيف مطلوبان" };
  }

  try {
    const response = await adminService.updateAdminCatalogItem(catalogItemId, {
      ...payload,
      name,
      category,
    });

    if (!response.success) {
      return {
        success: false,
        message: normalizeAdminCatalogItemErrorMessage(
          response.message,
          "تعذر تحديث عنصر الكتالوج",
        ),
      };
    }

    revalidatePath(ADMIN_CATALOG_ITEMS_PATH);
    return { success: true, data: response.data };
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    console.error("Admin update catalog item failed:", error);
    return { success: false, message: "تعذر تحديث عنصر الكتالوج" };
  }
}

export async function adminDeleteCatalogItemAction(
  catalogItemId: number,
): Promise<AdminCatalogItemMutationResult> {
  try {
    const response = await adminService.deleteAdminCatalogItem(catalogItemId);
    if (!response.success) {
      return {
        success: false,
        message: normalizeAdminCatalogItemErrorMessage(
          response.message,
          "تعذر تعطيل عنصر الكتالوج",
        ),
      };
    }

    revalidatePath(ADMIN_CATALOG_ITEMS_PATH);
    return { success: true };
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    console.error("Admin disable catalog item failed:", error);
    return { success: false, message: "تعذر تعطيل عنصر الكتالوج" };
  }
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
        message: normalizeAdminCatalogItemErrorMessage(
          response.message,
          "تعذر تحديث عناصر الكتالوج المحددة",
        ),
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

  const response = await adminService.createAdminCatalogCategory(formData);

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

  const response = await adminService.updateAdminCatalogCategory(
    categoryId,
    formData,
  );

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

export async function adminMoveCatalogCategoryProductsAction(
  sourceValue: AdminCatalogSource,
  fromCategoryValue: string,
  formData: FormData,
): Promise<void> {
  const source = ADMIN_CATALOG_SOURCES.has(sourceValue) ? sourceValue : null;
  const fromCategory = parseNullableString(fromCategoryValue);
  const toCategory = parseNullableString(formData.get("to_category"));

  if (!source || !fromCategory || !toCategory) {
    throw new Error("اختر تصنيف المصدر والتصنيف الهدف");
  }

  const response = await adminService.moveAdminCatalogCategoryProducts({
    source,
    from_category: fromCategory,
    to_category: toCategory,
  });

  if (!response.success) {
    throw new Error(response.message || "تعذر نقل عناصر التصنيف");
  }

  revalidatePath(ADMIN_CATEGORIES_PATH);
  revalidatePath(ADMIN_CATALOG_ITEMS_PATH);
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

  const catalogType = formData.get("catalogType");
  if (catalogType) {
    cleanFormData.set("catalogType", String(catalogType));
  }

  const images = formData.getAll("images");
  for (const image of images) {
    if (image instanceof File && image.size > 0) {
      cleanFormData.append("images", image);
    }
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

const directoryAreaMutationMessages: Record<string, string> = {
  AREA_PARENT_NOT_FOUND:
    "تعذر العثور على المنطقة الرئيسية المحددة. اختر منطقة رئيسية أخرى.",
  AREA_PARENT_MUST_BE_MAIN:
    "المنطقة المحددة تابعة لمنطقة أخرى. اختر منطقة رئيسية مباشرة.",
  AREA_PARENT_SELF_REFERENCE:
    "لا يمكن أن تكون المنطقة هي المنطقة الرئيسية لنفسها.",
  AREA_HAS_CHILDREN:
    "هذه المنطقة مرتبطة بمناطق فرعية. انقلها أو حوّلها إلى مناطق رئيسية أولاً.",
  AREA_HAS_ZONE_STOREFRONT:
    "لا يمكن حذف المنطقة لأنها مرتبطة بواجهة منطقة مركزية. احذف الواجهة أو انقلها أولاً.",
  AREA_HAS_MISSING_DELIVERY_AREA_REQUESTS:
    "لا يمكن حذف المنطقة لوجود طلبات مناطق توصيل مرتبطة بها. عالج الطلبات أولاً.",
};

const getDirectoryAreaMutationMessage = (
  data: unknown,
  message: string | undefined,
  fallback: string,
) => {
  const dataRecord =
    data && typeof data === "object"
      ? (data as Record<string, unknown>)
      : undefined;
  const errorDetails =
    dataRecord?.errors && typeof dataRecord.errors === "object"
      ? (dataRecord.errors as Record<string, unknown>)
      : dataRecord;
  const code =
    errorDetails && "code" in errorDetails
      ? String(errorDetails.code ?? "")
      : "";

  return directoryAreaMutationMessages[code] ?? message ?? fallback;
};

export async function createDirectoryAreaAction(
  payload: AdminDirectoryAreaPayload,
): Promise<AdminDirectoryArea> {
  const response = await adminService.createDirectoryArea(payload);
  if (!response.success || !response.data) {
    throw new Error(
      getDirectoryAreaMutationMessage(
        response.data,
        response.message,
        "تعذر إضافة المنطقة",
      ),
    );
  }
  revalidatePath("/admin/areas");
  return response.data;
}

export async function updateDirectoryAreaAction(
  id: number,
  payload: AdminDirectoryAreaPayload,
): Promise<AdminDirectoryArea> {
  const response = await adminService.updateDirectoryArea(id, payload);
  if (!response.success || !response.data) {
    throw new Error(
      getDirectoryAreaMutationMessage(
        response.data,
        response.message,
        "تعذر تحديث المنطقة",
      ),
    );
  }
  revalidatePath("/admin/areas");
  return response.data;
}

export async function deleteDirectoryAreaAction(id: number): Promise<void> {
  const response = await adminService.deleteDirectoryArea(id);
  if (!response.success) {
    throw new Error(
      getDirectoryAreaMutationMessage(
        response.data,
        response.message,
        "تعذر حذف المنطقة، قد تكون مستخدمة",
      ),
    );
  }
  revalidatePath("/admin/areas");
  revalidatePath("/");
  revalidatePath("/stores");
  revalidatePath("/stores/[areaSlug]/[categorySlug]", "page");
}

export async function resolveMissingDeliveryAreaRequestAction(
  id: number,
  resolvedAreaId: number,
): Promise<AdminMissingDeliveryAreaRequest> {
  const response = await adminService.resolveMissingDeliveryAreaRequest(id, resolvedAreaId);
  if (!response.success || !response.data) {
    throw new Error(response.message || "تعذر حل طلب المنطقة.");
  }
  revalidatePath("/admin/missing-delivery-area-requests");
  revalidatePath("/admin/areas");
  return response.data;
}

export type UpdateTenantCategoryResult = {
  success: boolean;
  message?: string;
  requiresForceCleanup?: boolean;
  productCount?: number;
};

/**
 * Category changes are triggered from a client form, so they go through an
 * action instead of the admin service to keep `HttpService` off the browser.
 */
export async function updateTenantCategoryAction(
  tenantId: number,
  category: string,
  forceCleanup = false,
): Promise<UpdateTenantCategoryResult> {
  const id = positiveIdSchema.parse(tenantId);
  const parsedCategory = z.string().trim().min(1).max(50).safeParse(category);
  if (!parsedCategory.success) {
    return { success: false, message: "اختر نشاطاً صحيحاً للمتجر." };
  }

  const response = await adminService.updateTenantCategory(
    id,
    parsedCategory.data,
    forceCleanup,
  );

  if (response.success) {
    revalidatePath(`/admin/merchants/${id}`);
    revalidatePath("/admin/merchants");
    return { success: true };
  }

  const data = response.data as
    | { requires_force_cleanup?: boolean; product_count?: number }
    | undefined;

  return {
    success: false,
    message: response.message || "تعذر تحديث نشاط المتجر.",
    requiresForceCleanup: Boolean(data?.requires_force_cleanup),
    productCount: data?.product_count,
  };
}
