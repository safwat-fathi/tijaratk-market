"use server";

import { adminService } from "@/services/api/admin.service";
import { redirect } from "next/navigation";
import { setCookieAction, deleteCookieAction } from "@/app/actions/cookie-store";
import { STORAGE_KEYS } from "@/constants";
import { revalidatePath } from "next/cache";
import { loginSchema } from "@/lib/validations/auth";

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

export async function adminBulkAddEssentialItemsAction(tenantId: number, categories: string[]) {
	const response = await adminService.adminBulkAddEssentialItems(tenantId, categories);
	if (!response.success) {
		return {
			success: false,
			message: response.message || "تعذر إضافة التشكيلة الأساسية",
		};
	}

	revalidatePath("/admin/merchants");
	return {
		success: true,
		data: response.data,
	};
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
