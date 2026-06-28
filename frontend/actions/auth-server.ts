"use server";

import { authService } from "@/services/api/auth.service";
import {
  loginSchema,
  registerSchema,
  requestPasswordResetSchema,
  verifyPasswordResetSchema,
  updatePasswordSchema,
} from "@/lib/validations/auth";
import { redirect } from "next/navigation";
import { setCookieAction, deleteCookieAction } from "@/app/actions/cookie-store";
import { STORAGE_KEYS } from "@/constants";

// We need a way to set cookies in Server Actions.
// The existing `authService.login` (Step 140) ALREADY calls `setCookieAction`.
// So we just need to call `authService.login`.

export type ActionState = {
  success?: boolean;
  message?: string;
  errors?: Record<string, string[] | undefined>;
  timestamp?: number; // Force re-render on similar errors
};

export async function loginAction(prevState: ActionState, formData: FormData): Promise<ActionState> {
  const rawData = Object.fromEntries(formData.entries());
  
  // Validate Fields
  const validated = loginSchema.safeParse(rawData);
  if (!validated.success) {
    return {
      success: false,
      message: "Please fix the errors below.",
      errors: validated.error.flatten().fieldErrors,
      timestamp: Date.now(),
    };
  }

  try {
    // Determine mapping: form 'password' -> API 'pass'
    const payload = {
      phone: validated.data.phone,
      pass: validated.data.password,
    };

    const response = await authService.login(payload);

    if (response.success && response.data?.access_token) {
      await setCookieAction(STORAGE_KEYS.ACCESS_TOKEN, response.data.access_token);
      if (response.data.user) {
				await setCookieAction(
					STORAGE_KEYS.USER,
					JSON.stringify(response.data.user),
				);
			}
      // Redirect to merchant dashboard
    } else {
      return {
        success: false,
        message: response.message || "Invalid credentials",
        timestamp: Date.now(),
      };
    }
  } catch (error) {
    console.error("Login action failed:", error);
    return {
      success: false,
      message: "An unexpected error occurred.",
      timestamp: Date.now(),
    };
  }
  
  // Redirect needs to be outside try/catch to avoid catching NEXT_REDIRECT error
  redirect("/merchant");
}

export async function registerAction(prevState: ActionState, formData: FormData): Promise<ActionState> {
  const rawData = Object.fromEntries(formData.entries());
  
  const validated = registerSchema.safeParse(rawData);
  if (!validated.success) {
    return {
      success: false,
      message: "Please fix the errors below.",
      errors: validated.error.flatten().fieldErrors,
      timestamp: Date.now(),
    };
  }

  try {
    const payload = {
			name: validated.data.name,
			storeName: validated.data.storeName,
			phone: validated.data.phone,
			category: validated.data.category,
			password: validated.data.password,
			confirm_password: validated.data.confirmPassword,
		};

    const response = await authService.signup(payload);

    if (response.success) {
       // Signup usually doesn't login automatically unless specified.
       // We might want to login usually, or redirect to Login.
       // Assuming redirect to login for now.
    } else {
        return {
            success: false,
            message: response.message || "Registration failed",
            timestamp: Date.now(),
        };
    }

  } catch (error) {
     console.error("Register action failed:", error);
     return {
      success: false,
      message: "An unexpected error occurred.",
      timestamp: Date.now(),
    };
  }

   redirect("/merchant/login");
}

export async function logoutAction() {
  await deleteCookieAction(STORAGE_KEYS.ACCESS_TOKEN);
  await deleteCookieAction(STORAGE_KEYS.USER);
  await authService.logout();
  redirect("/merchant/login");
}

export async function requestPasswordResetAction(
  prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const rawData = Object.fromEntries(formData.entries());
  const validated = requestPasswordResetSchema.safeParse(rawData);

  if (!validated.success) {
    return {
      success: false,
      message: "Please fix the errors below.",
      errors: validated.error.flatten().fieldErrors,
      timestamp: Date.now(),
    };
  }

  try {
    const response = await authService.requestPasswordReset({
      phone: validated.data.phone,
    });

    if (!response.success) {
      return {
        success: false,
        message: response.message || "Could not send reset code.",
        timestamp: Date.now(),
      };
    }

    return {
      success: true,
      message: "تم إرسال رمز إعادة التعيين في رسالة نصية (SMS)",
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error("Request password reset action failed:", error);
    return {
      success: false,
      message: "An unexpected error occurred.",
      timestamp: Date.now(),
    };
  }
}

export async function verifyPasswordResetAction(
  prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const rawData = Object.fromEntries(formData.entries());
  const validated = verifyPasswordResetSchema.safeParse(rawData);

  if (!validated.success) {
    return {
      success: false,
      message: "Please fix the errors below.",
      errors: validated.error.flatten().fieldErrors,
      timestamp: Date.now(),
    };
  }

  try {
    const response = await authService.verifyPasswordReset({
      phone: validated.data.phone,
      otp: validated.data.otp,
      password: validated.data.password,
      confirm_password: validated.data.confirmPassword,
    });

    if (!response.success) {
      return {
        success: false,
        message: response.message || "Could not reset password.",
        timestamp: Date.now(),
      };
    }

    return {
      success: true,
      message: "تم تغيير كلمة المرور بنجاح. يمكنك تسجيل الدخول الآن.",
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error("Verify password reset action failed:", error);
    return {
      success: false,
      message: "An unexpected error occurred.",
      timestamp: Date.now(),
    };
  }
}

export async function updatePasswordAction(
  prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const rawData = Object.fromEntries(formData.entries());
  const validated = updatePasswordSchema.safeParse(rawData);

  if (!validated.success) {
    return {
      success: false,
      message: "Please fix the errors below.",
      errors: validated.error.flatten().fieldErrors,
      timestamp: Date.now(),
    };
  }

  try {
    const response = await authService.updatePassword({
      currentPassword: validated.data.currentPassword,
      newPassword: validated.data.newPassword,
    });

    if (!response.success) {
      return {
        success: false,
        message: response.message || "Could not update password.",
        timestamp: Date.now(),
      };
    }

    return {
      success: true,
      message: "تم تحديث كلمة المرور بنجاح",
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error("Update password action failed:", error);
    return {
      success: false,
      message: "حدث خطأ غير متوقع",
      timestamp: Date.now(),
    };
  }
}
