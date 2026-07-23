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

type ManagedProductCategoryMoveActionResult = {
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

const parseNullableString = (value: FormDataEntryValue | null) => {
  if (typeof value !== "string") {
    return null;
  }

  return value.trim() || null;
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
  if (!response.success) {
    throw new Error(response.message || "تعذر إضافة المنتج");
  }
  await revalidateManagedProductPaths(tenantId);
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
): Promise<void> {
  positiveIdSchema.parse(tenantId);
  positiveIdSchema.parse(catalogItemId);
  const response = await adminService.addManagedProductFromCatalog(
    tenantId,
    catalogItemId,
  );
  if (!response.success) {
    throw new Error(response.message || "تعذر إضافة منتج الكتالوج");
  }
  await revalidateManagedProductPaths(tenantId);
}

export async function updateManagedProductPriceAction(
  tenantId: number,
  productId: number,
  formData: FormData,
): Promise<void> {
  const currentPrice = z.coerce
    .number()
    .positive()
    .parse(formData.get("current_price"));
  const response = await adminService.updateManagedProduct(
    tenantId,
    productId,
    "price",
    { current_price: currentPrice },
  );
  if (!response.success) {
    throw new Error(response.message || "تعذر تحديث السعر");
  }
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
  if (!response.success) {
    throw new Error(response.message || "تعذر تحديث بيانات المنتج");
  }
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
  if (!response.success) {
    throw new Error(response.message || "تعذر تحديث الإتاحة");
  }
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
  if (!response.success) {
    throw new Error(response.message || "تعذر تحديث حالة المنتج");
  }
  await revalidateManagedProductPaths(tenantId);
}

export async function bulkUpdateManagedProductsAction(
  tenantId: number,
  payload: ManagedProductBulkUpdatePayload,
): Promise<{ success: boolean; message?: string }> {
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
    return { success: true };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "حدث خطأ غير متوقع",
    };
  }
}
