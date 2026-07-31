"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isNextRedirectError } from "@/lib/auth/navigation-errors";
import { adminService } from "@/services/api/admin.service";
import type {
  ProductImportActionResult,
  ProductImportPreview,
  ProductImportSummary,
} from "@/types/models/product-import";

type ManagedProductActionResult = {
  success: boolean;
  message: string;
};

type ManagedProductBulkUpdatePayload = {
  ids: number[];
  is_available?: boolean;
  status?: "active" | "archived";
  category?: string;
};

const positiveIdSchema = z.number().int().positive();
const productNameSchema = z.string().trim().min(1).max(120);
const productPriceSchema = z.coerce.number().positive();

const INVALID_PRODUCT_NAME_MESSAGE = "اسم المنتج مطلوب (حتى 120 حرفًا)";
const INVALID_PRODUCT_PRICE_MESSAGE = "أدخل سعرًا صحيحًا أكبر من صفر";

/**
 * Converts a thrown action error into an error result. Next redirects (issued
 * when the management session expires) must keep propagating.
 */
const toFailureResult = (
  error: unknown,
  fallback: string,
): ManagedProductActionResult => {
  if (isNextRedirectError(error)) {
    throw error;
  }

  console.error(fallback, error);
  return { success: false, message: fallback };
};

const parseNullableString = (value: FormDataEntryValue | null) => {
  if (typeof value !== "string") {
    return null;
  }

  return value.trim() || null;
};

const PRODUCT_IMAGE_SIZE_MESSAGE = "حجم الصورة كبير. الحد الأقصى 15 ميجابايت.";
const PRODUCT_IMAGE_FORMAT_MESSAGE =
  "صيغة الصورة غير مدعومة. استخدم JPG أو PNG أو WEBP أو HEIC أو HEIF.";
const PRODUCT_IMAGE_TIMEOUT_MESSAGE =
  "استغرق رفع/معالجة الصورة وقتًا أطول من المتوقع. حاول مرة أخرى.";

/** Maps backend upload failures to the Arabic copy used across product screens. */
const localizeProductImageError = (
  message: string | undefined,
  fallback: string,
): string => {
  const normalized = message?.trim();
  if (!normalized) return fallback;

  if (
    /(unsupported image format|unsupported codec|صيغة الصورة غير مدعومة)/i.test(
      normalized,
    )
  ) {
    return PRODUCT_IMAGE_FORMAT_MESSAGE;
  }

  if (
    /(limit_file_size|payload too large|entity too large|file too large|حجم الصورة|exceed.*(?:size|limit))/i.test(
      normalized,
    )
  ) {
    return PRODUCT_IMAGE_SIZE_MESSAGE;
  }

  if (
    /(timeout|timed out|aborterror|operation was aborted|signal is aborted)/i.test(
      normalized,
    )
  ) {
    return PRODUCT_IMAGE_TIMEOUT_MESSAGE;
  }

  return normalized;
};

/** Returns the selected product image only when the picker produced a real file. */
const readImageFile = (formData: FormData): File | null => {
  const file = formData.get("file");
  return file instanceof File && file.size > 0 ? file : null;
};

const isImageCleared = (formData: FormData): boolean =>
  formData.get("clear_image") === "true";

/** Builds the multipart body accepted by the managed product create endpoint. */
const buildManagedProductFormData = ({
  name,
  currentPrice,
  category,
  isAvailable,
  imageFile,
}: {
  name: string;
  currentPrice?: number;
  category?: string;
  isAvailable: boolean;
  imageFile: File;
}): FormData => {
  const payload = new FormData();
  payload.set("name", name);
  if (typeof currentPrice === "number") {
    payload.set("current_price", String(currentPrice));
  }
  if (category) {
    payload.set("category", category);
  }
  payload.set("is_available", String(isAvailable));
  payload.set("file", imageFile);
  return payload;
};

const revalidateManagedProductPaths = async (tenantId: number) => {
  revalidatePath(`/admin/merchants/${tenantId}/manage/products`);
  const context = await adminService.getManagedMerchantContext(tenantId);
  if (context.success && context.data?.tenant.slug) {
    revalidatePath(`/${context.data.tenant.slug}`);
  }
};

const localizeProductImportError = (
  message: string | undefined,
  fallback: string,
): string => {
  const normalized = message?.trim();
  if (!normalized) return fallback;
  if (/[\u0600-\u06ff]/.test(normalized)) return normalized;

  const lowerMessage = normalized.toLowerCase();
  if (
    lowerMessage.includes("file too large") ||
    lowerMessage.includes("payload too large")
  ) {
    return "حجم الملف أكبر من الحد الأقصى 5 ميجابايت";
  }
  if (
    lowerMessage.includes("unsupported file format") ||
    lowerMessage.includes("only csv and xlsx")
  ) {
    return "الصيغة غير مدعومة. استخدم ملف CSV أو XLSX";
  }
  if (lowerMessage.includes("property file should not exist")) {
    return "تعذر معالجة الملف المرفوع. حدّث الخادم ثم أعد المحاولة";
  }
  if (lowerMessage.includes("cannot post")) {
    return "خدمة استيراد المنتجات غير متاحة على الخادم الحالي";
  }
  if (
    lowerMessage.includes("forbidden") ||
    lowerMessage.includes("permission")
  ) {
    return "ليس لديك الصلاحيات المطلوبة لاستيراد المنتجات";
  }

  return fallback;
};

export async function createManagedProductAction(
  tenantId: number,
  formData: FormData,
): Promise<ManagedProductActionResult> {
  const parsedName = productNameSchema.safeParse(formData.get("name"));
  if (!parsedName.success) {
    return { success: false, message: INVALID_PRODUCT_NAME_MESSAGE };
  }

  const priceValue = String(formData.get("current_price") || "").trim();
  const parsedPrice = priceValue
    ? productPriceSchema.safeParse(priceValue)
    : null;
  if (parsedPrice && !parsedPrice.success) {
    return { success: false, message: INVALID_PRODUCT_PRICE_MESSAGE };
  }

  try {
    positiveIdSchema.parse(tenantId);
    const name = parsedName.data;
    const currentPrice = parsedPrice?.data;
    const category = String(formData.get("category") || "").trim() || undefined;
    const imageFile = readImageFile(formData);

    const response = await adminService.createManagedProduct(
      tenantId,
      imageFile
        ? buildManagedProductFormData({
            name,
            currentPrice,
            category,
            isAvailable: true,
            imageFile,
          })
        : {
            name,
            current_price: currentPrice,
            category,
            is_available: true,
          },
    );
    if (!response.success) {
      return {
        success: false,
        message: localizeProductImageError(
          response.message,
          "تعذر إضافة المنتج",
        ),
      };
    }

    await revalidateManagedProductPaths(tenantId);
    return { success: true, message: "تم إضافة المنتج" };
  } catch (error) {
    return toFailureResult(error, "تعذر إضافة المنتج");
  }
}

export async function previewManagedProductImportAction(
  tenantId: number,
  formData: FormData,
): Promise<ProductImportActionResult<ProductImportPreview>> {
  try {
    positiveIdSchema.parse(tenantId);
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { success: false, message: "اختر ملف CSV أو XLSX أولًا" };
    }

    const payload = new FormData();
    payload.set("file", file);
    const response = await adminService.previewManagedProductImport(
      tenantId,
      payload,
    );
    if (!response.success || !response.data) {
      return {
        success: false,
        message: localizeProductImportError(
          response.message,
          "تعذر قراءة ملف المنتجات",
        ),
      };
    }

    return { success: true, data: response.data };
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    console.error("Managed product import preview failed:", error);
    return {
      success: false,
      message: "تعذر قراءة ملف المنتجات",
    };
  }
}

export async function importManagedProductSpreadsheetAction(
  tenantId: number,
  formData: FormData,
): Promise<ProductImportActionResult<ProductImportSummary>> {
  try {
    positiveIdSchema.parse(tenantId);
    const file = formData.get("file");
    const mapping = formData.get("mapping");
    if (!(file instanceof File) || file.size === 0) {
      return { success: false, message: "ملف المنتجات مطلوب" };
    }
    if (typeof mapping !== "string" || !mapping.trim()) {
      return { success: false, message: "تعيين الأعمدة مطلوب" };
    }

    const payload = new FormData();
    payload.set("file", file);
    payload.set("mapping", mapping);
    const response = await adminService.importManagedProductSpreadsheet(
      tenantId,
      payload,
    );
    if (!response.success || !response.data) {
      return {
        success: false,
        message: localizeProductImportError(
          response.message,
          "تعذر استيراد المنتجات",
        ),
      };
    }

    await revalidateManagedProductPaths(tenantId);
    return { success: true, data: response.data };
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    console.error("Managed product spreadsheet import failed:", error);
    return {
      success: false,
      message: "تعذر استيراد المنتجات",
    };
  }
}

export async function addManagedCatalogProductAction(
  tenantId: number,
  catalogItemId: number,
): Promise<ManagedProductActionResult> {
  try {
    positiveIdSchema.parse(tenantId);
    positiveIdSchema.parse(catalogItemId);
    const response = await adminService.addManagedProductFromCatalog(
      tenantId,
      catalogItemId,
    );
    if (!response.success) {
      return {
        success: false,
        message: response.message || "تعذر إضافة منتج الكتالوج",
      };
    }

    await revalidateManagedProductPaths(tenantId);
    return { success: true, message: "تم إضافة المنتج من الكتالوج" };
  } catch (error) {
    return toFailureResult(error, "تعذر إضافة منتج الكتالوج");
  }
}

export async function updateManagedProductPriceAction(
  tenantId: number,
  productId: number,
  formData: FormData,
): Promise<ManagedProductActionResult> {
  const parsedPrice = productPriceSchema.safeParse(
    formData.get("current_price"),
  );
  if (!parsedPrice.success) {
    return { success: false, message: INVALID_PRODUCT_PRICE_MESSAGE };
  }

  try {
    const response = await adminService.updateManagedProduct(
      tenantId,
      productId,
      "price",
      { current_price: parsedPrice.data },
    );
    if (!response.success) {
      return {
        success: false,
        message: response.message || "تعذر تحديث السعر",
      };
    }

    await revalidateManagedProductPaths(tenantId);
    return { success: true, message: "تم تحديث السعر" };
  } catch (error) {
    return toFailureResult(error, "تعذر تحديث السعر");
  }
}

export async function updateManagedProductDetailsAction(
  tenantId: number,
  productId: number,
  formData: FormData,
): Promise<ManagedProductActionResult> {
  const parsedName = productNameSchema.safeParse(formData.get("name"));
  if (!parsedName.success) {
    return { success: false, message: INVALID_PRODUCT_NAME_MESSAGE };
  }

  try {
    const name = parsedName.data;
    const category = parseNullableString(formData.get("category"));
    const imageFile = readImageFile(formData);
    const clearImage = isImageCleared(formData);

    let payload: FormData | Record<string, unknown>;
    if (imageFile || clearImage) {
      const multipartPayload = new FormData();
      multipartPayload.set("name", name);
      if (category) {
        multipartPayload.set("category", category);
      }
      // A file always wins over the clear checkbox: that combination is a replace.
      if (imageFile) {
        multipartPayload.set("file", imageFile);
      } else {
        multipartPayload.set("image_url", "");
      }
      payload = multipartPayload;
    } else {
      payload = { name, ...(category ? { category } : {}) };
    }

    const response = await adminService.updateManagedProduct(
      tenantId,
      productId,
      "details",
      payload,
    );
    if (!response.success) {
      return {
        success: false,
        message: localizeProductImageError(
          response.message,
          "تعذر تحديث بيانات المنتج",
        ),
      };
    }

    await revalidateManagedProductPaths(tenantId);
    return { success: true, message: "تم حفظ البيانات الأساسية" };
  } catch (error) {
    return toFailureResult(error, "تعذر تحديث بيانات المنتج");
  }
}

export async function moveManagedProductCategoryAction(
  tenantId: number,
  productId: number,
  categoryValue: string,
): Promise<ManagedProductActionResult> {
  try {
    const normalizedTenantId = positiveIdSchema.parse(tenantId);
    const normalizedProductId = positiveIdSchema.parse(productId);
    const category = z.string().trim().min(1).max(64).parse(categoryValue);
    const [categoriesResponse, productResponse] = await Promise.all([
      adminService.getManagedProductCategories(normalizedTenantId),
      adminService.getManagedProduct(normalizedTenantId, normalizedProductId),
    ]);

    if (
      !categoriesResponse.success ||
      !productResponse.success ||
      !productResponse.data
    ) {
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

    await revalidateManagedProductPaths(normalizedTenantId);
    return { success: true, message: "تم نقل المنتج إلى التصنيف المحدد" };
  } catch (error) {
    return toFailureResult(
      error,
      "تعذر نقل المنتج إلى التصنيف المحدد. حاول مرة أخرى.",
    );
  }
}

export async function updateManagedProductAvailabilityAction(
  tenantId: number,
  productId: number,
  isAvailable: boolean,
): Promise<ManagedProductActionResult> {
  try {
    const response = await adminService.updateManagedProduct(
      tenantId,
      productId,
      "availability",
      { is_available: isAvailable },
    );
    if (!response.success) {
      return {
        success: false,
        message: response.message || "تعذر تحديث الإتاحة",
      };
    }

    await revalidateManagedProductPaths(tenantId);
    return {
      success: true,
      message: isAvailable ? "تم إتاحة المنتج" : "تم إخفاء المنتج",
    };
  } catch (error) {
    return toFailureResult(error, "تعذر تحديث الإتاحة");
  }
}

export async function updateManagedProductStatusAction(
  tenantId: number,
  productId: number,
  status: "active" | "archived",
): Promise<ManagedProductActionResult> {
  try {
    const response = await adminService.updateManagedProduct(
      tenantId,
      productId,
      "status",
      { status },
    );
    if (!response.success) {
      return {
        success: false,
        message: response.message || "تعذر تحديث حالة المنتج",
      };
    }

    await revalidateManagedProductPaths(tenantId);
    return {
      success: true,
      message: status === "archived" ? "تم أرشفة المنتج" : "تم استعادة المنتج",
    };
  } catch (error) {
    return toFailureResult(error, "تعذر تحديث حالة المنتج");
  }
}

export async function bulkUpdateManagedProductsAction(
  tenantId: number,
  payload: ManagedProductBulkUpdatePayload,
): Promise<ManagedProductActionResult> {
  try {
    const response = await adminService.bulkUpdateManagedProducts(
      tenantId,
      payload,
    );
    if (!response.success) {
      return {
        success: false,
        message: response.message || "تعذر تنفيذ الإجراء المجمع",
      };
    }
    await revalidateManagedProductPaths(tenantId);
    return { success: true, message: "تم تنفيذ الإجراء على المنتجات المحددة" };
  } catch (error) {
    return toFailureResult(error, "تعذر تنفيذ الإجراء المجمع");
  }
}
