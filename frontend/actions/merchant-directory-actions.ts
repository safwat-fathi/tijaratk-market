"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { merchantDirectoryService } from "@/services/api/stores-directory.service";
import type {
  DirectoryArea,
  MissingDeliveryAreaRequest,
  TenantDirectoryProfile,
} from "@/types/models/tenant";

/**
 * Server actions for the merchant directory profile. These exist so that
 * onboarding and settings client components never import an API service
 * directly — a client import of `HttpService` would pull the cookie helpers
 * into the browser bundle.
 */

export type DirectoryActionResult<T> = {
  success: boolean;
  message?: string;
  data?: T;
};

const areaIdSchema = z.coerce.number().int().positive();

const missingAreaRequestSchema = z.object({
  main_area_id: areaIdSchema,
  requested_area_name: z.string().trim().min(2).max(120),
  note: z.string().trim().max(500).optional(),
});

export async function getActiveDirectoryAreasAction(): Promise<
  DirectoryActionResult<DirectoryArea[]>
> {
  const response = await merchantDirectoryService.getActiveAreas();
  if (!response.success || !response.data) {
    return {
      success: false,
      message: response.message || "تعذر تحميل المناطق. حاول مرة أخرى.",
    };
  }

  return { success: true, data: response.data };
}

export async function getDirectoryProfileAction(): Promise<
  DirectoryActionResult<TenantDirectoryProfile>
> {
  const response = await merchantDirectoryService.getProfile();
  if (!response.success || !response.data) {
    return {
      success: false,
      message: response.message || "تعذر تحميل بيانات المتجر.",
    };
  }

  return { success: true, data: response.data };
}

export async function updateDirectoryProfileAction(
  areaId: number,
): Promise<DirectoryActionResult<TenantDirectoryProfile>> {
  const parsed = areaIdSchema.safeParse(areaId);
  if (!parsed.success) {
    return { success: false, message: "اختر منطقة صحيحة." };
  }

  const response = await merchantDirectoryService.updateProfile({
    area_id: parsed.data,
  });
  if (!response.success || !response.data) {
    return {
      success: false,
      message: response.message || "تعذر حفظ منطقة المتجر. حاول مرة أخرى.",
    };
  }

  revalidatePath("/merchant");
  revalidatePath("/merchant/settings");

  return { success: true, data: response.data };
}

export async function getMissingDeliveryAreaRequestAction(
  mainAreaId: number,
): Promise<DirectoryActionResult<MissingDeliveryAreaRequest | null>> {
  const parsed = areaIdSchema.safeParse(mainAreaId);
  if (!parsed.success) {
    return { success: false, message: "اختر منطقة صحيحة." };
  }

  const response = await merchantDirectoryService.getMissingDeliveryAreaRequest(
    parsed.data,
  );
  if (!response.success) {
    return {
      success: false,
      message: response.message || "تعذر تحميل حالة طلب المنطقة.",
    };
  }

  return { success: true, data: response.data ?? null };
}

export async function createMissingDeliveryAreaRequestAction(
  input: z.input<typeof missingAreaRequestSchema>,
): Promise<DirectoryActionResult<MissingDeliveryAreaRequest>> {
  const parsed = missingAreaRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "راجع اسم المنطقة المطلوبة." };
  }

  const response = await merchantDirectoryService.createMissingDeliveryAreaRequest(
    parsed.data,
  );
  if (!response.success || !response.data) {
    return {
      success: false,
      message: response.message || "تعذر إرسال طلب إضافة المنطقة.",
    };
  }

  return { success: true, data: response.data };
}
