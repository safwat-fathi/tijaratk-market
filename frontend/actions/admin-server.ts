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
    const token = (response.data as any)?.admin_access_token;
    
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

export async function togglePlanStatusAction(id: number, currentStatus: boolean): Promise<void> {
  const response = await adminService.togglePlanStatus(id, !currentStatus);
  if (response.success) {
    revalidatePath("/admin/plans");
  }
}
