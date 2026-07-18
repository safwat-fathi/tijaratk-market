"use server";

import { adminService } from "@/services/api/admin.service";
import { redirect } from "next/navigation";
import { setCookieAction, deleteCookieAction } from "@/app/actions/cookie-store";
import { STORAGE_KEYS } from "@/constants";
import { DISPATCH_SESSION_PERMISSION_MESSAGE } from "@/constants/admin-managed-permissions";
import { revalidatePath } from "next/cache";
import { loginSchema } from "@/lib/validations/auth";
import { isNextRedirectError } from "@/lib/auth/navigation-errors";
import { hasActiveManagedPermission } from "@/lib/admin-managed-access";
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
  AdminManagedPermission,
  AdminProductSheetUploadSummary,
  DeleteTenantProductsSummary,
  UpdateAdminCatalogItemPayload,
} from "@/services/api/admin.service";
import { z } from "zod";

export type ActionState = {
  success?: boolean;
  message?: string;
  errors?: Record<string, string[] | undefined>;
  timestamp?: number;
};

export type ZoneMutationActionResult = {
  success: boolean;
  message: string;
  timestamp: number;
};

export type DirectoryStatusActionState = {
  success: boolean;
  message?: string;
};

export type DispatchSessionStartResult = {
  success: false;
  message: string;
};

export type ManagedProductCategoryMoveActionResult = {
  success: boolean;
  message: string;
};

const zoneMutationMessages: Record<string, string> = {
  ZONE_OPERATOR_NOT_READY:
    "مشغل المنطقة غير جاهز لاستقبال الطلبات. راجع حالة المشغل وإتاحة التوصيل.",
  ZONE_CATALOG_NOT_READY:
    "كتالوج المنطقة غير جاهز. نفّذ مزامنة المنتجات الأساسية أولاً.",
  ZONE_DELIVERY_FEES_NOT_READY:
    "يجب تحديد رسوم توصيل لكل منطقة فرعية نشطة قبل تفعيل الواجهة.",
  ZONE_NO_ELIGIBLE_ACTIVE_MERCHANT:
    "يلزم وجود متجر تنفيذ واحد على الأقل يكون نشطاً ومؤهلاً داخل المنطقة.",
  MERCHANT_INACTIVE: "المتجر غير نشط حالياً. فعّل المتجر أولاً.",
  MERCHANT_DELETED: "المتجر محذوف ولا يمكن إضافته إلى المنطقة.",
  MERCHANT_DELIVERY_DISABLED:
    "التوصيل متوقف في هذا المتجر. فعّل التوصيل أولاً.",
  MERCHANT_CATEGORY_MISMATCH:
    "تصنيف المتجر لا يطابق تصنيف واجهة المنطقة.",
  MERCHANT_IS_ZONE_OPERATOR:
    "مشغل منطقة داخلي لا يمكن استخدامه كمتجر تنفيذ.",
  MERCHANT_DELIVERY_AREA_MISSING:
    "المتجر لا يغطي أي منطقة فرعية نشطة داخل هذه الواجهة. أضف منطقة فرعية إلى مناطق توصيله أولاً.",
  MERCHANT_DELIVERY_AREA_INACTIVE:
    "كل تغطية المتجر للمناطق الفرعية داخل هذه الواجهة متوقفة. فعّل إحداها أولاً.",
  MERCHANT_NOT_FOUND: "تعذر العثور على المتجر المطلوب.",
};

const getZoneMutationMessage = (
  data: unknown,
  message: string | undefined,
  fallback: string,
) => {
  const code =
    data && typeof data === "object" && "code" in data
      ? String((data as { code?: unknown }).code ?? "")
      : "";
  if (code && zoneMutationMessages[code]) return zoneMutationMessages[code];

  const normalized = message?.trim();
  if (normalized === "Merchant is not eligible for this zone") {
    return "المتجر غير مؤهل لهذه المنطقة. راجع حالته وإتاحة التوصيل ومناطق التغطية.";
  }
  if (normalized === "At least one eligible active merchant is required") {
    return zoneMutationMessages.ZONE_NO_ELIGIBLE_ACTIVE_MERCHANT;
  }
  if (normalized === "Zone catalog is not ready") {
    return zoneMutationMessages.ZONE_CATALOG_NOT_READY;
  }
  if (normalized === "Every active child area requires a delivery fee") {
    return zoneMutationMessages.ZONE_DELIVERY_FEES_NOT_READY;
  }
  if (normalized === "Zone operator is not ready for ordering") {
    return zoneMutationMessages.ZONE_OPERATOR_NOT_READY;
  }
  return normalized || fallback;
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
  "dispatches.read",
  "dispatches.assign",
  "dispatches.cancel",
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
    "dispatches.read",
    "dispatches.assign",
    "dispatches.cancel",
  ],
};
managedPermissionPresets.store_manager = Array.from(
  new Set([
    ...managedPermissionPresets.catalog_operator,
    ...managedPermissionPresets.order_operator,
  ]),
);

const createZoneSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  area_id: z.coerce.number().int().positive(),
  category: z.enum(["grocery", "pharmacy"]),
  operations_phone: z.string().trim().min(8).max(32),
  delivery_fee: z.coerce.number().min(0).optional(),
});

const zoneCreateValidationMessages: Record<string, string> = {
  name: "اكتب اسمًا عامًا من حرفين على الأقل.",
  slug: "اكتب رابطًا بالإنجليزية باستخدام حروف صغيرة وأرقام وشرطات فقط.",
  area_id: "اختر المنطقة.",
  category: "اختر قطاعًا صحيحًا.",
  operations_phone: "اكتب رقم هاتف عمليات صحيحًا.",
  delivery_fee: "اكتب رسوم توصيل تساوي صفرًا أو أكثر.",
};

export type ZoneCreateActionState = ActionState & {
  conflictCode?: string;
};

const getZoneCreateConflictCode = (value: unknown): string | undefined => {
  if (!value || typeof value !== "object") return undefined;

  const errors = (value as Record<string, unknown>).errors;
  if (!errors || typeof errors !== "object") return undefined;

  const code = (errors as Record<string, unknown>).code;
  return typeof code === "string" ? code : undefined;
};

const getZoneCreateFieldErrors = (
  conflictCode: string | undefined,
  message: string,
): ActionState["errors"] => {
  if (conflictCode === "ZONE_AREA_CATEGORY_CONFLICT") {
    return { area_id: [message], category: [message] };
  }
  if (
    conflictCode === "ZONE_SLUG_CONFLICT" ||
    conflictCode === "ZONE_OPERATOR_SLUG_CONFLICT"
  ) {
    return { slug: [message] };
  }
  return undefined;
};

const getAdminSafeZoneCreateMessage = (message?: string): string => {
  const normalized = message?.trim();
  return normalized && /[\u0600-\u06FF]/.test(normalized)
    ? normalized
    : "تعذر إنشاء واجهة المنطقة. تحقق من البيانات وحاول مرة أخرى.";
};

export async function createZoneStorefrontAction(
  _previousState: ZoneCreateActionState,
  formData: FormData,
): Promise<ZoneCreateActionState> {
  void _previousState;
  const parsed = createZoneSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );
  if (!parsed.success) {
    const invalidFields = new Set(
      parsed.error.issues
        .map((issue) => issue.path[0])
        .filter((field): field is string => typeof field === "string"),
    );
    return {
      success: false,
      message: "يرجى مراجعة بيانات واجهة المنطقة.",
      errors: Object.fromEntries(
        Array.from(invalidFields, (field) => [
          field,
          [zoneCreateValidationMessages[field] ?? "راجع هذه القيمة."],
        ]),
      ),
      timestamp: Date.now(),
    };
  }

  const response = await adminService.createZone(parsed.data);
  if (!response.success) {
    const message = getAdminSafeZoneCreateMessage(response.message);
    const conflictCode = getZoneCreateConflictCode(response.data);
    return {
      success: false,
      message,
      conflictCode,
      errors: getZoneCreateFieldErrors(conflictCode, message),
      timestamp: Date.now(),
    };
  }
  if (!response.data?.id) {
    return {
      success: false,
      message: "تم إنشاء الواجهة دون إرجاع معرّف صالح. حدّث الصفحة وحاول مرة أخرى.",
      timestamp: Date.now(),
    };
  }

  revalidatePath("/admin/zones");
  redirect(`/admin/zones/${response.data.id}`);
}

export async function updateZoneActivationAction(
  zoneId: number,
  isActive: boolean,
): Promise<ZoneMutationActionResult> {
  const id = positiveIdSchema.parse(zoneId);
  const response = await adminService.updateZoneActivation(id, isActive);
  if (!response.success) {
    return {
      success: false,
      message: getZoneMutationMessage(
        response.data,
        response.message,
        "تعذر تحديث حالة المنطقة.",
      ),
      timestamp: Date.now(),
    };
  }
  revalidatePath("/admin/zones");
  revalidatePath("/admin/zones/" + id);
  revalidatePath("/");
  if (response.data?.slug) {
    revalidatePath("/market/" + response.data.slug);
  }
  return {
    success: true,
    message: isActive ? "تم تفعيل المنطقة بنجاح." : "تم إيقاف الطلبات الجديدة.",
    timestamp: Date.now(),
  };
}

const zoneDeliveryFeesSchema = z
  .array(
    z.object({
      area_id: z.number().int().positive(),
      delivery_fee: z.number().min(0),
    }),
  )
  .min(1)
  .superRefine((entries, context) => {
    if (new Set(entries.map((entry) => entry.area_id)).size !== entries.length) {
      context.addIssue({
        code: "custom",
        message: "لا يمكن تكرار منطقة التوصيل.",
      });
    }
  });

export async function updateZoneDeliveryFeesAction(
  zoneId: number,
  zoneSlug: string,
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  void _previousState;
  const id = positiveIdSchema.parse(zoneId);
  let rawPayload: unknown;
  try {
    rawPayload = JSON.parse(String(formData.get("delivery_areas") ?? ""));
  } catch {
    return {
      success: false,
      message: "تعذر قراءة رسوم مناطق التوصيل.",
      timestamp: Date.now(),
    };
  }
  const parsed = zoneDeliveryFeesSchema.safeParse(rawPayload);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message || "راجع رسوم مناطق التوصيل.",
      timestamp: Date.now(),
    };
  }

  const response = await adminService.updateZoneDeliveryFees(id, {
    delivery_areas: parsed.data,
  });
  if (!response.success) {
    return {
      success: false,
      message:
        response.message || "تعذر حفظ رسوم مناطق التوصيل. حاول مرة أخرى.",
      timestamp: Date.now(),
    };
  }

  revalidatePath("/admin/zones");
  revalidatePath(`/admin/zones/${id}`);
  revalidatePath("/");
  revalidatePath(`/market/${zoneSlug}`);
  return {
    success: true,
    message: "تم حفظ رسوم كل مناطق التوصيل.",
    timestamp: Date.now(),
  };
}

export type ZoneEssentialCatalogSyncActionResult = {
  success: boolean;
  message: string;
};

export async function syncZoneEssentialCatalogAction(
  zoneId: number,
): Promise<ZoneEssentialCatalogSyncActionResult> {
  const id = positiveIdSchema.parse(zoneId);
  const response = await adminService.syncZoneEssentialCatalog(id);
  if (!response.success || !response.data) {
    return {
      success: false,
      message: "تعذر مزامنة المنتجات الأساسية للمنطقة. حاول مرة أخرى.",
    };
  }

  revalidatePath("/admin/zones");
  revalidatePath(`/admin/zones/${id}`);
  revalidatePath("/");

  const result = response.data;
  return {
    success: true,
    message:
      `تمت المزامنة بنجاح: ${result.active_products}/${result.expected_products} منتج في ` +
      `${result.active_categories} قسم، مع إضافة ${result.created} ` +
      `وربط ${result.linked} وأرشفة ${result.archived}` +
      `${result.catalog_in_sync ? "." : "، وما زالت المزامنة غير مكتملة."}`,
  };
}

export async function upsertZoneMerchantAction(
  zoneId: number,
  formData: FormData,
): Promise<ZoneMutationActionResult> {
  const id = positiveIdSchema.parse(zoneId);
  const payload = z.object({
    tenant_id: z.coerce.number().int().positive(),
    priority: z.coerce.number().int().default(0),
    is_active: z.enum(["true", "false"]).transform((value) => value === "true"),
  }).parse(Object.fromEntries(formData.entries()));
  const response = await adminService.upsertZoneMerchant(id, payload);
  if (!response.success) {
    return {
      success: false,
      message: getZoneMutationMessage(
        response.data,
        response.message,
        "تعذر تحديث عضوية المتجر.",
      ),
      timestamp: Date.now(),
    };
  }
  revalidatePath("/admin/zones");
  revalidatePath("/admin/zones/" + id);
  revalidatePath("/");
  if (response.data?.slug) {
    revalidatePath("/market/" + response.data.slug);
  }
  return {
    success: true,
    message: payload.is_active
      ? "تم تفعيل عضوية المتجر في المنطقة."
      : "تم إيقاف عضوية المتجر في المنطقة.",
    timestamp: Date.now(),
  };
}

export async function startZoneDispatchSessionAction(
  zoneId: number,
  tenantId: number,
  formData: FormData,
): Promise<DispatchSessionStartResult> {
  const normalizedZoneId = positiveIdSchema.parse(zoneId);
  const normalizedTenantId = positiveIdSchema.parse(tenantId);
  const reason = managementReasonSchema.parse(formData.get("reason"));
  const contextResponse = await adminService.getManagedMerchantContext(
    normalizedTenantId,
  );

  if (!contextResponse.success) {
    return {
      success: false,
      message: contextResponse.message || "تعذر التحقق من صلاحية التوزيع",
    };
  }

  if (
    !hasActiveManagedPermission(
      contextResponse.data?.current_admin_access,
      "dispatches.read",
    )
  ) {
    return {
      success: false,
      message: DISPATCH_SESSION_PERMISSION_MESSAGE,
    };
  }

  const response = await adminService.startManagementSession({
    tenant_id: normalizedTenantId,
    reason,
  });

  if (!response.success) {
    const responseData = response.data as unknown;
    const errors =
      typeof responseData === "object" && responseData !== null
        ? (responseData as Record<string, unknown>).errors
        : null;
    const errorCode =
      typeof errors === "object" && errors !== null
        ? (errors as Record<string, unknown>).code
        : null;

    return {
      success: false,
      message:
        errorCode === "ADMIN_TENANT_ACCESS_REQUIRED"
          ? DISPATCH_SESSION_PERMISSION_MESSAGE
          : response.message || "تعذر بدء جلسة إدارة التوزيع",
    };
  }

  const token = response.data?.session_token;
  const expiresAt = response.data?.session?.expires_at;
  if (!token || !expiresAt) {
    return {
      success: false,
      message: "تعذر بدء جلسة إدارة التوزيع",
    };
  }
  await setCookieAction(STORAGE_KEYS.ADMIN_MANAGEMENT_SESSION, token, {
    maxAge: Math.max(1, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)),
  });
  redirect(`/admin/zones/${normalizedZoneId}/dispatches`);
}

export async function assignZoneDispatchAction(
  zoneId: number,
  tenantId: number,
  dispatchId: number,
  formData: FormData,
): Promise<void> {
  const payload = z.object({
    target_tenant_id: z.coerce.number().int().positive(),
    expected_version: z.coerce.number().int().min(0),
    internal_notes: z.string().trim().max(500).optional(),
  }).parse(Object.fromEntries(formData.entries()));
  const response = await adminService.assignManagedZoneDispatch(
    positiveIdSchema.parse(tenantId),
    positiveIdSchema.parse(dispatchId),
    payload,
  );
  if (!response.success) throw new Error(response.message || "تعذر إسناد الطلب");
  const normalizedZoneId = positiveIdSchema.parse(zoneId);
  revalidatePath(`/admin/zones/${normalizedZoneId}/dispatches`);
  revalidatePath(
    `/admin/zones/${normalizedZoneId}/dispatches/${positiveIdSchema.parse(dispatchId)}`,
  );
}

export async function cancelZoneDispatchAction(
  zoneId: number,
  tenantId: number,
  dispatchId: number,
  formData: FormData,
): Promise<void> {
  const payload = z.object({
    expected_version: z.coerce.number().int().min(0),
    reason: z.string().trim().min(3).max(500),
  }).parse(Object.fromEntries(formData.entries()));
  const response = await adminService.cancelManagedZoneDispatch(
    positiveIdSchema.parse(tenantId),
    positiveIdSchema.parse(dispatchId),
    payload,
  );
  if (!response.success) throw new Error(response.message || "تعذر إلغاء الطلب");
  const normalizedZoneId = positiveIdSchema.parse(zoneId);
  revalidatePath(`/admin/zones/${normalizedZoneId}/dispatches`);
  revalidatePath(
    `/admin/zones/${normalizedZoneId}/dispatches/${positiveIdSchema.parse(dispatchId)}`,
  );
}

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
  const expiresAt = response.data?.session.expires_at;
  if (!response.success || !token || !expiresAt) {
    throw new Error(response.message || "تعذر بدء جلسة إدارة المتجر");
  }

  const maxAge = Math.max(
    1,
    Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000),
  );
  await setCookieAction(STORAGE_KEYS.ADMIN_MANAGEMENT_SESSION, token, {
    maxAge,
  });
  redirect(`/admin/merchants/${normalizedTenantId}/manage/products`);
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

async function revalidateManagedProductPaths(tenantId: number) {
  revalidatePath(`/admin/merchants/${tenantId}/manage/products`);
  const context = await adminService.getManagedMerchantContext(tenantId);
  if (context.success && context.data?.tenant.slug) {
    revalidatePath(`/${context.data.tenant.slug}`);
  }
}

export async function createManagedProductAction(
  tenantId: number,
  formData: FormData,
): Promise<void> {
  positiveIdSchema.parse(tenantId);
  const name = z.string().trim().min(1).max(120).parse(formData.get("name"));
  const priceValue = String(formData.get("current_price") || "").trim();
  const currentPrice = priceValue ? Number(priceValue) : undefined;
  const category = String(formData.get("category") || "").trim() || undefined;
  const response = await adminService.createManagedProduct(tenantId, {
    name,
    current_price: currentPrice,
    category,
    is_available: true,
  });
  if (!response.success) throw new Error(response.message || "تعذر إضافة المنتج");
  await revalidateManagedProductPaths(tenantId);
}

export async function addManagedCatalogProductAction(
  tenantId: number,
  catalogItemId: number,
): Promise<void> {
  positiveIdSchema.parse(tenantId);
  positiveIdSchema.parse(catalogItemId);
  const response = await adminService.addManagedProductFromCatalog(
    tenantId,
    catalogItemId,
  );
  if (!response.success) throw new Error(response.message || "تعذر إضافة منتج الكتالوج");
  await revalidateManagedProductPaths(tenantId);
}

export async function updateManagedProductPriceAction(
  tenantId: number,
  productId: number,
  formData: FormData,
): Promise<void> {
  const currentPrice = z.coerce.number().positive().parse(formData.get("current_price"));
  const response = await adminService.updateManagedProduct(
    tenantId,
    productId,
    "price",
    { current_price: currentPrice },
  );
  if (!response.success) throw new Error(response.message || "تعذر تحديث السعر");
  await revalidateManagedProductPaths(tenantId);
}

export async function updateManagedProductDetailsAction(
  tenantId: number,
  productId: number,
  formData: FormData,
): Promise<void> {
  const name = z.string().trim().min(1).max(120).parse(formData.get("name"));
  const category = parseNullableString(formData.get("category"));
  const response = await adminService.updateManagedProduct(
    tenantId,
    productId,
    "details",
    { name, ...(category ? { category } : {}) },
  );
  if (!response.success) throw new Error(response.message || "تعذر تحديث بيانات المنتج");
  await revalidateManagedProductPaths(tenantId);
}

export async function moveManagedProductCategoryAction(
  tenantId: number,
  productId: number,
  categoryValue: string,
): Promise<ManagedProductCategoryMoveActionResult> {
  try {
    const normalizedTenantId = positiveIdSchema.parse(tenantId);
    const normalizedProductId = positiveIdSchema.parse(productId);
    const category = z.string().trim().min(1).max(64).parse(categoryValue);
    const [categoriesResponse, productResponse] = await Promise.all([
      adminService.getManagedProductCategories(normalizedTenantId),
      adminService.getManagedProduct(normalizedTenantId, normalizedProductId),
    ]);

    if (!categoriesResponse.success || !productResponse.success || !productResponse.data) {
      return {
        success: false,
        message: "تعذر التحقق من المنتج أو التصنيف المحدد",
      };
    }

    if (!categoriesResponse.data?.includes(category)) {
      return {
        success: false,
        message: "التصنيف الهدف غير متاح لهذا المتجر",
      };
    }

    if (productResponse.data.category === category) {
      return {
        success: false,
        message: "المنتج موجود بالفعل في هذا التصنيف",
      };
    }

    const response = await adminService.updateManagedProduct(
      normalizedTenantId,
      normalizedProductId,
      "details",
      { category },
    );

    if (!response.success) {
      return {
        success: false,
        message: response.message || "تعذر نقل المنتج إلى التصنيف المحدد",
      };
    }

    await revalidateManagedProductPaths(tenantId);
    return { success: true, message: "تم نقل المنتج إلى التصنيف المحدد" };
  } catch (error) {
    console.error("Move managed product category failed:", error);
    return {
      success: false,
      message: "تعذر نقل المنتج إلى التصنيف المحدد. حاول مرة أخرى.",
    };
  }
}

export async function updateManagedProductAvailabilityAction(
  tenantId: number,
  productId: number,
  isAvailable: boolean,
): Promise<void> {
  const response = await adminService.updateManagedProduct(
    tenantId,
    productId,
    "availability",
    { is_available: isAvailable },
  );
  if (!response.success) throw new Error(response.message || "تعذر تحديث الإتاحة");
  await revalidateManagedProductPaths(tenantId);
}

export async function updateManagedProductStatusAction(
  tenantId: number,
  productId: number,
  status: "active" | "archived",
): Promise<void> {
  const response = await adminService.updateManagedProduct(
    tenantId,
    productId,
    "status",
    { status },
  );
  if (!response.success) throw new Error(response.message || "تعذر تحديث حالة المنتج");
  await revalidateManagedProductPaths(tenantId);
}

export async function bulkUpdateManagedProductsAction(
  tenantId: number,
  payload: { ids: number[]; is_available?: boolean; status?: "active" | "archived"; category?: string },
): Promise<{ success: boolean; message?: string }> {
  try {
    const response = await adminService.bulkUpdateManagedProducts(tenantId, payload as any);
    if (!response.success) {
      return { success: false, message: response.message || "تعذر تنفيذ الإجراء المجمع" };
    }
    await revalidateManagedProductPaths(tenantId);
    return { success: true };
  } catch (err: any) {
    return { success: false, message: err.message || "حدث خطأ غير متوقع" };
  }
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
    primary_area_id: z.coerce.number().int().positive(),
    delivery_areas: z.array(
      z.object({
        area_id: z.coerce.number().int().positive(),
        delivery_fee: z.coerce.number().min(0),
      }),
    ),
  })
  .superRefine((data, ctx) => {
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
    if (areaIds.includes(data.primary_area_id)) {
      ctx.addIssue({
        code: "custom",
        path: ["delivery_areas"],
        message: "المنطقة الأساسية لا يمكن إضافتها ضمن مناطق التوصيل",
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
        !ADMIN_DELIVERY_TIME_PATTERN.test(end) ||
        end <= start)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["delivery_configuration"],
        message: "تأكد أن وقت النهاية بعد وقت البداية",
      });
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
}
