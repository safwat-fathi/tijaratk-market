"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { tenantsService } from "@/services/api/tenants.service";

export type UpdateDeliverySettingsState = {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>;
};

const deliveryTimePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

const deliveryConfigurationSchema = z
  .object({
    delivery_available: z.boolean(),
    delivery_starts_at: z.string().nullable().optional(),
    delivery_ends_at: z.string().nullable().optional(),
    primary_area_id: z.coerce.number().int().min(1, "اختر المنطقة الأساسية"),
    delivery_areas: z.array(
      z.object({
        area_id: z.coerce.number().int().min(1),
        delivery_fee: z.coerce
          .number({ error: "أدخل قيمة رقمية صحيحة" })
          .min(0, "رسوم التوصيل لا يمكن أن تكون أقل من صفر"),
      }),
    ),
  })
  .superRefine((data, ctx) => {
    const areaIds = data.delivery_areas.map((area) => area.area_id);
    if (new Set(areaIds).size !== areaIds.length) {
      ctx.addIssue({
        code: "custom",
        message: "لا يمكن تكرار منطقة التوصيل",
        path: ["delivery_areas"],
      });
    }
    if (data.delivery_available && data.delivery_areas.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "اختر منطقة توصيل واحدة على الأقل",
        path: ["delivery_areas"],
      });
    }

    const start = data.delivery_starts_at || "";
    const end = data.delivery_ends_at || "";
    if (Boolean(start) !== Boolean(end)) {
      ctx.addIssue({
        code: "custom",
        message: "أدخل وقت البداية والنهاية للتوصيل",
        path: ["delivery_configuration"],
      });
    } else if (
      start &&
      end &&
      (!deliveryTimePattern.test(start) ||
        !deliveryTimePattern.test(end) ||
        end <= start)
    ) {
      ctx.addIssue({
        code: "custom",
        message: "تأكد أن وقت النهاية بعد وقت البداية",
        path: ["delivery_configuration"],
      });
    }
  });

const parseDeliveryConfiguration = (value: FormDataEntryValue | null) => {
  try {
    const parsed =
      typeof value === "string" ? (JSON.parse(value) as unknown) : value;
    return deliveryConfigurationSchema.safeParse(parsed);
  } catch {
    return deliveryConfigurationSchema.safeParse(null);
  }
};

export async function updateDeliverySettingsAction(
  _prevState: UpdateDeliverySettingsState,
  formData: FormData,
): Promise<UpdateDeliverySettingsState> {
  const validatedFields = parseDeliveryConfiguration(
    formData.get("delivery_configuration"),
  );

  if (!validatedFields.success) {
    return {
      success: false,
      message: "راجع بيانات التوصيل قبل الحفظ.",
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  const response = await tenantsService.updateMyDeliverySettings(
    validatedFields.data,
  );

  if (!response.success) {
    return {
      success: false,
      message: response.message || "تعذر حفظ إعدادات التوصيل. حاول مرة أخرى.",
    };
  }

  const tenantSlug = response.data?.slug;
  revalidatePath("/merchant");
  revalidatePath("/merchant/settings/delivery");
  revalidatePath("/");
  revalidatePath("/stores");
  revalidatePath("/stores/[areaSlug]/[categorySlug]", "page");
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
    delivery_available: deliveryAvailable,
    delivery_starts_at: tenantRes.data.delivery_starts_at || null,
    delivery_ends_at: tenantRes.data.delivery_ends_at || null,
    primary_area_id: tenantRes.data.directory_profile?.area_id || 0,
    delivery_areas:
      tenantRes.data.tenant_delivery_areas
        ?.filter(
          (area) =>
            area.is_active !== false && area.area?.is_active !== false,
        )
        .map((area) => ({
          area_id: area.area_id,
          delivery_fee: Number(area.delivery_fee),
        })) || [],
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
  revalidatePath("/");
  revalidatePath("/stores");
  revalidatePath("/stores/[areaSlug]/[categorySlug]", "page");
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
  card_on_delivery_available: z
    .enum(["true", "false", "on", "off"])
    .optional()
    .transform(value => value === "true" || value === "on"),
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
);

export async function updateStoreSettingsAction(
  _prevState: UpdateStoreSettingsState,
  formData: FormData,
): Promise<UpdateStoreSettingsState> {
  const validatedFields = updateStoreSettingsSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );
  const deliveryConfiguration = parseDeliveryConfiguration(
    formData.get("delivery_configuration"),
  );

  if (!validatedFields.success || !deliveryConfiguration.success) {
    return {
      success: false,
      message: "يرجى تصحيح الأخطاء قبل الحفظ.",
      errors: {
        ...(validatedFields.success
          ? {}
          : validatedFields.error.flatten().fieldErrors),
        ...(deliveryConfiguration.success
          ? {}
          : deliveryConfiguration.error.flatten().fieldErrors),
      },
    };
  }

  const {
    name,
    category,
    instapay_account_name,
    instapay_account_number,
    ewallet_account_name,
    ewallet_account_number,
    card_on_delivery_available,
  } = validatedFields.data;

  // 1. Update general settings
  const generalRes = await tenantsService.updateMyGeneralSettings({
    name,
    category,
    instapay_account_name,
    instapay_account_number,

    ewallet_account_name,
    ewallet_account_number,
    card_on_delivery_available,
  });

  if (!generalRes.success) {
    return {
      success: false,
      message: generalRes.message || "تعذر حفظ معلومات المتجر.",
    };
  }

  // 2. Update delivery settings
  const deliveryRes = await tenantsService.updateMyDeliverySettings(
    deliveryConfiguration.data,
  );

  if (!deliveryRes.success) {
    return {
      success: false,
      message: deliveryRes.message || "تعذر حفظ إعدادات التوصيل.",
    };
  }

  const tenantSlug = generalRes.data?.slug;
  revalidatePath("/merchant");
  revalidatePath("/merchant/settings");
  revalidatePath("/");
  revalidatePath("/stores");
  revalidatePath("/stores/[areaSlug]/[categorySlug]", "page");
  if (tenantSlug) {
    revalidatePath(`/${tenantSlug}`);
  }

  return {
    success: true,
    message: "تم حفظ التغييرات بنجاح.",
  };
}
