"use server";

import { z } from "zod";
import { productsService } from "@/services/api/products.service";
import { storefrontCartDraftsService } from "@/services/api/storefront-cart-drafts.service";
import type {
  SaveStorefrontCartDraftInput,
  StorefrontCartDraft,
} from "@/types/models/storefront-cart-draft";
import {
  clearStorefrontCartToken,
  getStorefrontCartToken,
  setStorefrontCartToken,
  verifyStorefrontCheckoutCsrf,
} from "@/lib/storefront-cart-cookie";
import { buildMetaRequestContextHeaders } from "@/lib/analytics/meta-request-context";
import { persistCreatedOrderTrackingArtifacts } from "@/actions/order-actions";
import { isValidEgyptianCustomerPhone } from "@/lib/utils/phone";
import { OrderSource, UnavailableItemAction } from "@/types/enums";

const cartSelectionSchema = z.object({
  product_id: z.number().int().positive(),
  selection_mode: z.enum(["quantity", "weight", "price"]),
  selection_quantity: z.number().positive().optional(),
  selection_grams: z.number().int().positive().optional(),
  selection_amount_egp: z.number().positive().optional(),
  unit_option_id: z.string().trim().max(64).optional(),
  item_note: z.string().trim().max(255).optional(),
});

const saveDraftSchema = z.object({
  items: z.array(cartSelectionSchema).max(100),
  free_text_payload: z.string().trim().max(2000).optional(),
  delivery_area_id: z.number().int().positive().optional(),
  unavailable_item_action: z.nativeEnum(UnavailableItemAction).optional(),
  order_source: z
    .enum([OrderSource.STOREFRONT, OrderSource.DIRECTORY])
    .optional(),
  source_metadata: z.record(z.string(), z.unknown()).optional(),
  prescription_unavailability_action: z.string().trim().max(64).optional(),
});

const deliverySlotSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  starts_at: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  ends_at: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
});

const checkoutSchema = z.object({
  customer_name: z.string().trim().min(2, "اكتب الاسم على الأقل حرفين"),
  customer_phone: z
    .string()
    .trim()
    .refine(isValidEgyptianCustomerPhone, "اكتب رقم هاتف صحيح"),
  delivery_address: z.string().trim().min(5, "اكتب عنوان توصيل واضح"),
  notes: z.string().trim().max(255).optional(),
  delivery_slot: z.string().optional(),
  card_on_delivery_requested: z.string().optional(),
  csrf_token: z.string().min(1),
  ga_client_id: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9._-]{1,128}$/)
    .or(z.literal(""))
    .optional(),
  ga_session_id: z
    .string()
    .trim()
    .regex(/^\d{1,20}$/)
    .or(z.literal(""))
    .optional(),
});

type CheckoutAnalyticsError = {
  error_field: "phone" | "name" | "address" | "delivery_area" | "cart" | "server";
  error_type:
    | "required"
    | "invalid_format"
    | "outside_delivery_area"
    | "empty_cart"
    | "product_unavailable"
    | "order_creation_failed"
    | "network_error";
  http_status?: number;
};

export type StorefrontCheckoutState = {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>;
  analytics_error?: CheckoutAnalyticsError;
  data?: {
    public_token: string;
    customer_access_code?: string;
    meta_purchase?: { event_id: string; value: number; currency: "EGP" };
    order_analytics: {
      order_id: number;
      value: number;
      delivery_fee: number;
      item_count: number;
    };
  };
};

const checkoutFieldMap = {
  customer_name: "name",
  customer_phone: "phone",
  delivery_address: "address",
  delivery_slot: "delivery_area",
} as const;

const resolveValidationAnalyticsError = (
  errors: Record<string, string[] | undefined>,
): CheckoutAnalyticsError => {
  const fieldName = Object.keys(errors).find((key) => errors[key]?.length);
  if (!fieldName) {
    return { error_field: "server", error_type: "order_creation_failed" };
  }

  const errorField =
    checkoutFieldMap[fieldName as keyof typeof checkoutFieldMap] ?? "server";
  return {
    error_field: errorField,
    error_type:
      errorField === "phone" || errorField === "delivery_area"
        ? "invalid_format"
        : "required",
  };
};

const publicDraft = (
  draft: ({ token: string } & StorefrontCartDraft) | undefined,
): StorefrontCartDraft | null => {
  if (!draft) return null;
  const { token: _token, ...safeDraft } = draft;
  return safeDraft;
};

/** Resolves the current cart for server pages. */
export async function getStorefrontCartDraftAction(tenantSlug: string) {
  const token = await getStorefrontCartToken();
  if (!token) return null;
  const response = await storefrontCartDraftsService.getDraft(tenantSlug, token);
  return response.success ? publicDraft(response.data) : null;
}

/** Persists the full cart snapshot and refreshes its opaque cookie. */
export async function saveStorefrontCartDraftAction(
  tenantSlug: string,
  input: SaveStorefrontCartDraftInput,
): Promise<{ success: boolean; message?: string; data?: StorefrontCartDraft | null }> {
  const parsed = saveDraftSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "بيانات السلة غير صالحة" };
  }
  const token = await getStorefrontCartToken();
  const response = await storefrontCartDraftsService.saveDraft(
    tenantSlug,
    parsed.data,
    token,
  );
  if (!response.success || !response.data) {
    return { success: false, message: response.message || "تعذر حفظ السلة" };
  }
  await setStorefrontCartToken(tenantSlug, response.data.token);
  return { success: true, data: publicDraft(response.data) };
}

/** Uploads a prescription already selected on the cart screen. */
export async function uploadStorefrontPrescriptionAction(
  tenantSlug: string,
  formData: FormData,
) {
  let token = await getStorefrontCartToken();
  if (!token) {
    const created = await storefrontCartDraftsService.saveDraft(tenantSlug, {
      items: [],
    });
    if (!created.success || !created.data) {
      return { success: false, message: created.message || "تعذر تجهيز السلة" };
    }
    token = created.data.token;
    await setStorefrontCartToken(tenantSlug, token);
  }
  const upload = formData.get("prescription_file");
  if (!(upload instanceof File) || upload.size === 0) {
    return { success: false, message: "اختر ملف الروشتة أولاً" };
  }
  const payload = new FormData();
  payload.set("prescription_file", upload);
  const response = await storefrontCartDraftsService.attachPrescription(
    tenantSlug,
    payload,
    token,
  );
  if (response.success) await setStorefrontCartToken(tenantSlug, token);
  return response.success
    ? { success: true, data: publicDraft(response.data) }
    : { success: false, message: response.message || "تعذر رفع الروشتة" };
}

/** Removes a draft prescription before checkout. */
export async function removeStorefrontPrescriptionAction(tenantSlug: string) {
  const token = await getStorefrontCartToken();
  if (!token) return { success: true, data: null };
  const response = await storefrontCartDraftsService.removePrescription(
    tenantSlug,
    token,
  );
  if (response.success) await setStorefrontCartToken(tenantSlug, token);
  return response.success
    ? { success: true, data: publicDraft(response.data) }
    : { success: false, message: response.message || "تعذر حذف الروشتة" };
}

/** Fetches a public catalog page through a server action for search and Load More. */
export async function loadStorefrontProductsAction(
  tenantSlug: string,
  input: { search?: string; category?: string; page: number },
) {
  const response = await productsService.getPublicProducts(tenantSlug, {
    search: input.search?.trim() || undefined,
    category: input.category?.trim() || undefined,
    page: Math.max(1, input.page),
    limit: 20,
  });
  return response.success && response.data
    ? { success: true, data: response.data }
    : { success: false, message: response.message || "تعذر تحميل المنتجات" };
}

/** Clears a completed merchant cart after the verified success page mounts. */
export async function clearCompletedStorefrontCartAction(
  tenantSlug: string,
): Promise<void> {
  const normalizedSlug = z.string().trim().min(1).max(120).parse(tenantSlug);
  await clearStorefrontCartToken(normalizedSlug);
}

/** Validates PII and converts the claimed cart to an order. */
export async function checkoutStorefrontCartAction(
  tenantSlug: string,
  _previous: StorefrontCheckoutState,
  formData: FormData,
): Promise<StorefrontCheckoutState> {
  const parsed = checkoutSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    return {
      success: false,
      message: "راجع بيانات التوصيل",
      errors,
      analytics_error: resolveValidationAnalyticsError(errors),
    };
  }
  const token = await getStorefrontCartToken();
  if (!token || !verifyStorefrontCheckoutCsrf(token, parsed.data.csrf_token)) {
    return {
      success: false,
      message: "انتهت جلسة السلة. ارجع للسلة وحاول مرة أخرى.",
      analytics_error: { error_field: "cart", error_type: "empty_cart" },
    };
  }
  let deliverySlot:
    | { date: string; starts_at: string; ends_at: string }
    | undefined;
  if (parsed.data.delivery_slot) {
    try {
      const parsedSlot = deliverySlotSchema.safeParse(
        JSON.parse(parsed.data.delivery_slot),
      );
      if (!parsedSlot.success) {
        return {
          success: false,
          message: "ميعاد التوصيل غير صالح",
          analytics_error: {
            error_field: "delivery_area",
            error_type: "invalid_format",
          },
        };
      }
      deliverySlot = parsedSlot.data;
    } catch {
      return {
        success: false,
        message: "ميعاد التوصيل غير صالح",
        analytics_error: {
          error_field: "delivery_area",
          error_type: "invalid_format",
        },
      };
    }
  }
  const response = await storefrontCartDraftsService.checkout(
    tenantSlug,
    {
      customer: {
        name: parsed.data.customer_name,
        phone: parsed.data.customer_phone,
        address: parsed.data.delivery_address,
      },
      delivery_address: parsed.data.delivery_address,
      notes: parsed.data.notes || undefined,
      delivery_slot: deliverySlot,
      card_on_delivery_requested:
        parsed.data.card_on_delivery_requested === "on" ||
        parsed.data.card_on_delivery_requested === "true",
      ...(parsed.data.ga_client_id
        ? { ga_client_id: parsed.data.ga_client_id }
        : {}),
      ...(parsed.data.ga_session_id
        ? { ga_session_id: parsed.data.ga_session_id }
        : {}),
    },
    token,
    await buildMetaRequestContextHeaders(),
  );
  if (!response.success || !response.data?.public_token) {
    return {
      success: false,
      message: response.message || "تعذر تأكيد الطلب. حاول مرة أخرى.",
      errors: response.errors as Record<string, string[]> | undefined,
      analytics_error: {
        error_field: "server",
        error_type:
          response.status === 404 || response.status === 410
            ? "empty_cart"
            : response.status === 422
              ? "product_unavailable"
              : response.status
                ? "order_creation_failed"
                : "network_error",
        ...(response.status ? { http_status: response.status } : {}),
      },
    };
  }
  await persistCreatedOrderTrackingArtifacts({
    tenantSlug,
    responseData: response.data,
    customerData: {
      customer_name: parsed.data.customer_name,
      customer_phone: parsed.data.customer_phone,
      delivery_address: parsed.data.delivery_address,
      notes: parsed.data.notes,
    },
  });
  return {
    success: true,
    message: "تم إنشاء الطلب بنجاح",
    data: {
      public_token: response.data.public_token,
      ...(response.data.customer_access_code
        ? { customer_access_code: response.data.customer_access_code }
        : {}),
      ...(response.data.meta_purchase
        ? { meta_purchase: response.data.meta_purchase }
        : {}),
      order_analytics: {
        order_id: response.data.id,
        value: Number(response.data.total ?? 0),
        delivery_fee: Number(response.data.delivery_fee ?? 0),
        item_count: response.data.items.length,
      },
    },
  };
}
