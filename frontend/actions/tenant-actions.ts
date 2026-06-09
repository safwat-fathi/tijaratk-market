"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { tenantsService } from "@/services/api/tenants.service";

export type UpdateDeliverySettingsState = {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>;
};

const updateDeliverySettingsSchema = z.object({
  delivery_fee: z.coerce
    .number({ error: "أدخل قيمة رقمية صحيحة" })
    .min(0, "رسوم التوصيل لا يمكن أن تكون أقل من صفر"),
  delivery_available: z.enum(["true", "false"]).transform(value => value === "true"),
  delivery_starts_at: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "صيغة الوقت غير صحيحة")
    .optional()
    .or(z.literal(""))
    .transform(value => value || undefined),
  delivery_ends_at: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "صيغة الوقت غير صحيحة")
    .optional()
    .or(z.literal(""))
    .transform(value => value || undefined),
}).refine(
  (data) => {
    const hasStart = !!data.delivery_starts_at;
    const hasEnd = !!data.delivery_ends_at;
    return hasStart === hasEnd; // Either both or neither
  },
  {
    message: "أدخل وقت البداية والنهاية للتوصيل",
    path: ["delivery_ends_at"],
  }
).refine(
  (data) => {
    if (!data.delivery_starts_at || !data.delivery_ends_at) return true;
    return data.delivery_ends_at > data.delivery_starts_at;
  },
  {
    message: "وقت النهاية يجب أن يكون بعد وقت البداية",
    path: ["delivery_ends_at"],
  }
);

export async function updateDeliverySettingsAction(
  _prevState: UpdateDeliverySettingsState,
  formData: FormData,
): Promise<UpdateDeliverySettingsState> {
  const validatedFields = updateDeliverySettingsSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );

  if (!validatedFields.success) {
    return {
      success: false,
      message: "راجع بيانات التوصيل قبل الحفظ.",
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  const response = await tenantsService.updateMyDeliverySettings(validatedFields.data);

  if (!response.success) {
    return {
      success: false,
      message: response.message || "تعذر حفظ إعدادات التوصيل. حاول مرة أخرى.",
    };
  }

  const tenantSlug = response.data?.slug;
  revalidatePath("/merchant");
  revalidatePath("/merchant/settings/delivery");
  if (tenantSlug) {
    revalidatePath(`/${tenantSlug}`);
  }

  return {
    success: true,
    message: "تم حفظ إعدادات التوصيل بنجاح.",
  };
}

export type UpdateStoreSettingsState = {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>;
};

const updateStoreSettingsSchema = z.object({
  name: z.string().min(2, "الاسم يجب أن يكون أكثر من حرفين"),
  category: z.string().min(1, "يرجى اختيار النشاط"),
  delivery_fee: z.coerce
    .number({ error: "أدخل قيمة رقمية صحيحة" })
    .min(0, "رسوم التوصيل لا يمكن أن تكون أقل من صفر"),
  delivery_available: z.enum(["true", "false", "on", "off"]).optional().transform(value => value === "true" || value === "on"),
  delivery_starts_at: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "صيغة الوقت غير صحيحة")
    .optional()
    .or(z.literal(""))
    .transform(value => value || undefined),
  delivery_ends_at: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "صيغة الوقت غير صحيحة")
    .optional()
    .or(z.literal(""))
    .transform(value => value || undefined),
}).refine(
  (data) => {
    if (!data.delivery_available) return true;
    const hasStart = !!data.delivery_starts_at;
    const hasEnd = !!data.delivery_ends_at;
    return hasStart === hasEnd; // Either both or neither
  },
  {
    message: "أدخل وقت البداية والنهاية للتوصيل",
    path: ["delivery_ends_at"],
  }
).refine(
  (data) => {
    if (!data.delivery_starts_at || !data.delivery_ends_at) return true;
    return data.delivery_ends_at > data.delivery_starts_at;
  },
  {
    message: "وقت النهاية يجب أن يكون بعد وقت البداية",
    path: ["delivery_ends_at"],
  }
);

export async function updateStoreSettingsAction(
  _prevState: UpdateStoreSettingsState,
  formData: FormData,
): Promise<UpdateStoreSettingsState> {
  const data = Object.fromEntries(formData.entries());
  // If a checkbox is not checked, it might not be included in FormData, 
  // so we ensure delivery_available defaults to off if absent
  if (!data.delivery_available) {
    data.delivery_available = "off";
  }

  const validatedFields = updateStoreSettingsSchema.safeParse(data);

  if (!validatedFields.success) {
    return {
      success: false,
      message: "يرجى تصحيح الأخطاء قبل الحفظ.",
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  const { name, category, ...deliveryData } = validatedFields.data;

  // 1. Update general settings
  const generalRes = await tenantsService.updateMyGeneralSettings({
    name,
    category,
  });

  if (!generalRes.success) {
    return {
      success: false,
      message: generalRes.message || "تعذر حفظ معلومات المتجر.",
    };
  }

  // 2. Update delivery settings
  const deliveryRes = await tenantsService.updateMyDeliverySettings(deliveryData);

  if (!deliveryRes.success) {
    return {
      success: false,
      message: deliveryRes.message || "تعذر حفظ إعدادات التوصيل.",
    };
  }

  const tenantSlug = generalRes.data?.slug;
  revalidatePath("/merchant");
  revalidatePath("/merchant/settings");
  if (tenantSlug) {
    revalidatePath(`/${tenantSlug}`);
  }

  return {
    success: true,
    message: "تم حفظ التغييرات بنجاح.",
  };
}
