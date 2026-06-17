"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { tenantsService } from "@/services/api/tenants.service";
import { merchantDirectoryService } from "@/services/api/stores-directory.service";

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

export async function toggleStoreAvailabilityAction(
  deliveryAvailable: boolean
): Promise<{ success: boolean; message?: string }> {
  const tenantRes = await tenantsService.getMyTenant();
  if (!tenantRes.success || !tenantRes.data) {
    return { success: false, message: "تعذر تحديث حالة المتجر." };
  }

  const response = await tenantsService.updateMyDeliverySettings({
    delivery_fee: Number(tenantRes.data.delivery_fee) || 0,
    delivery_starts_at: tenantRes.data.delivery_starts_at || undefined,
    delivery_ends_at: tenantRes.data.delivery_ends_at || undefined,
    delivery_available: deliveryAvailable,
  });

  if (!response.success) {
    return {
      success: false,
      message: response.message || "تعذر تحديث حالة المتجر.",
    };
  }

  const tenantSlug = response.data?.slug;
  revalidatePath("/merchant");
  revalidatePath("/merchant/settings");
  if (tenantSlug) {
    revalidatePath(`/${tenantSlug}`);
  }

  return { success: true };
}

export type UpdateStoreSettingsState = {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>;
};

const updateStoreSettingsSchema = z.object({
  name: z.string().min(2, "الاسم يجب أن يكون أكثر من حرفين"),
  category: z.string().min(1, "يرجى اختيار النشاط"),
  instapay_account_name: z
    .string()
    .max(120, "اسم حساب إنستاباي طويل جداً")
    .optional()
    .or(z.literal(""))
    .transform(value => value?.trim() || undefined),
  instapay_account_number: z
    .string()
    .max(120, "رقم أو حساب إنستاباي طويل جداً")
    .optional()
    .or(z.literal(""))
    .transform(value => value?.trim() || undefined),
  ewallet_account_name: z
    .string()
    .max(120, "اسم المحفظة طويل جداً")
    .optional()
    .or(z.literal(""))
    .transform(value => value?.trim() || undefined),

  ewallet_account_number: z
    .string()
    .max(120, "رقم المحفظة طويل جداً")
    .optional()
    .or(z.literal(""))
    .transform(value => value?.trim() || undefined),
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
  area_id: z.preprocess(
    value =>
      value === "" || value === undefined || value === null
        ? undefined
        : value,
    z.coerce.number().int().min(1).optional(),
  ),
  delivery_area_ids: z.array(z.coerce.number()).optional(),
}).refine(
  data => Boolean(data.instapay_account_name) === Boolean(data.instapay_account_number),
  {
    message: "أدخل اسم ورقم حساب إنستاباي معاً",
    path: ["instapay_account_number"],
  },
).refine(
  data =>
    !data.ewallet_account_name && !data.ewallet_account_number
      ? true
      : Boolean(data.ewallet_account_name) &&
        Boolean(data.ewallet_account_number),
  {
    message: "أدخل الاسم ورقم المحفظة معاً",
    path: ["ewallet_account_number"],
  },
).refine(
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
  const data: Record<string, unknown> = Object.fromEntries(formData.entries());
  
  // Extract all delivery_area_ids since formData.entries() only gets the last value for multiple inputs
  data.delivery_area_ids = formData.getAll("delivery_area_ids");

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

  const {
    name,
    category,
    instapay_account_name,
    instapay_account_number,
    ewallet_account_name,
    ewallet_account_number,
    area_id,
    delivery_area_ids,
    ...deliveryData
  } = validatedFields.data;

  const deliveryAreaValidation = await validateDeliveryAreasInsideMainArea(
    area_id,
    delivery_area_ids ?? [],
  );

  if (!deliveryAreaValidation.success) {
    return {
      success: false,
      message: "يرجى تصحيح الأخطاء قبل الحفظ.",
      errors: {
        delivery_area_ids: [
          deliveryAreaValidation.message ||
            "مناطق التوصيل يجب أن تكون داخل المنطقة الأساسية.",
        ],
      },
    };
  }

  // 1. Update general settings
  const generalRes = await tenantsService.updateMyGeneralSettings({
    name,
    category,
    instapay_account_name,
    instapay_account_number,

    ewallet_account_name,
    ewallet_account_number,
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

  // 3. Update directory profile
  const profileRes = await merchantDirectoryService.updateProfile({
    area_id: area_id ?? undefined,
    delivery_area_ids: delivery_area_ids,
  });

  if (!profileRes.success) {
    return {
      success: false,
      message: profileRes.message || "تعذر حفظ إعدادات المناطق.",
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

async function validateDeliveryAreasInsideMainArea(
  areaId: number | undefined,
  deliveryAreaIds: number[],
) {
  const uniqueDeliveryAreaIds = Array.from(new Set(deliveryAreaIds));

  if (uniqueDeliveryAreaIds.length === 0) {
    return { success: true };
  }

  if (!areaId) {
    return {
      success: false,
      message: "اختر المنطقة الأساسية أولاً.",
    };
  }

  const areasResponse = await merchantDirectoryService.getActiveAreas();

  if (!areasResponse.success || !areasResponse.data) {
    return {
      success: false,
      message: "تعذر التحقق من مناطق التوصيل. حاول مرة أخرى.",
    };
  }

  const allowedAreaIds = new Set(
    areasResponse.data
      .filter(area => area.id === areaId || area.parent_area_id === areaId)
      .map(area => area.id),
  );
  const allDeliveryAreasAllowed = uniqueDeliveryAreaIds.every(areaId =>
    allowedAreaIds.has(areaId),
  );

  return allDeliveryAreasAllowed
    ? { success: true }
    : {
        success: false,
        message: "مناطق التوصيل يجب أن تكون داخل المنطقة الأساسية.",
      };
}
