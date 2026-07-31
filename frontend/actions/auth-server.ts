"use server";

import { authService } from "@/services/api/auth.service";
import {
  loginSchema,
  registerSchema,
  requestPasswordResetSchema,
  verifyPasswordResetSchema,
  updatePasswordSchema,
  requestPhoneChangeSchema,
  verifyPhoneChangeSchema,
} from "@/lib/validations/auth";
import { redirect } from "next/navigation";
import {
  deleteCookieAction,
  setCookieAction,
} from "@/actions/cookie-actions";
import { getCookie } from "@/lib/server/cookies";
import { STORAGE_KEYS } from "@/constants";

const MERCHANT_SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

// We need a way to set cookies in Server Actions.
// The existing `authService.login` (Step 140) ALREADY calls `setCookieAction`.
// So we just need to call `authService.login`.

export type ActionState = {
  success?: boolean;
  message?: string;
  errors?: Record<string, string[] | undefined>;
  timestamp?: number; // Force re-render on similar errors
  code?: string;
  maskedPhone?: string;
};

export async function loginAction(
  prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
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
      await setCookieAction(
        STORAGE_KEYS.ACCESS_TOKEN,
        response.data.access_token,
        { maxAge: MERCHANT_SESSION_MAX_AGE_SECONDS },
      );
      if (response.data.user) {
				await setCookieAction(
					STORAGE_KEYS.USER,
					JSON.stringify(response.data.user),
					{ maxAge: MERCHANT_SESSION_MAX_AGE_SECONDS },
				);
			}
      // Redirect to merchant dashboard
    } else {
      const errorCode =
        response.data &&
        typeof response.data === "object" &&
        "code" in response.data
          ? String(response.data.code)
          : undefined;
      return {
        success: false,
        code: errorCode,
        message: response.message || "رقم الهاتف أو كلمة المرور غير صحيحة.",
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

export async function registerAction(
  prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
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
			address: validated.data.address,
			password: validated.data.password,
			confirm_password: validated.data.confirmPassword,
		};

    const response = await authService.signup(payload);

    if (response.success) {
      return {
        success: true,
        code: "MERCHANT_APPLICATION_RECEIVED",
        message: "تم استلام طلب انضمام متجرك.",
        timestamp: Date.now(),
      };
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

}

export async function logoutAction(_formData?: FormData) {
  void _formData;
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
      message:
        "إذا كان الرقم مسجلاً، فسيصل إليه رمز إعادة التعيين في رسالة نصية.",
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
  } catch (error) {
    console.error("Update password action failed:", error);
    return {
      success: false,
      message: "حدث خطأ غير متوقع",
      timestamp: Date.now(),
    };
  }

  await clearMerchantCredentialCookies();
  redirect("/merchant/login?credentialChanged=password");
}

export async function requestPhoneChangeAction(
  prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const validated = requestPhoneChangeSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );
  if (!validated.success) {
    return {
      success: false,
      message: "راجع البيانات المطلوبة.",
      errors: validated.error.flatten().fieldErrors,
      timestamp: Date.now(),
    };
  }

  try {
    const response = await authService.requestPhoneChange(validated.data);
    if (!response.success || !response.data) {
      return {
        success: false,
        message:
          response.status === 409
            ? "رقم الهاتف مستخدم بالفعل."
            : response.status === 403
              ? "تغيير رقم المتجر متاح لصاحب الحساب فقط."
              : response.status === 400
                ? "تأكد من كلمة المرور وأن الرقم الجديد مختلف."
                : "تعذر إرسال رمز التحقق الآن.",
        timestamp: Date.now(),
      };
    }

    await setPhoneChangeChallengeCookie(
      response.data.challengeToken,
      response.data.expiresInSeconds,
    );
    return {
      success: true,
      message: "تم إرسال رمز تحقق إلى الرقم الجديد.",
      maskedPhone: response.data.maskedPhone,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error("Request phone change action failed:", error);
    return {
      success: false,
      message: "حدث خطأ غير متوقع.",
      timestamp: Date.now(),
    };
  }
}

export async function resendPhoneChangeAction(
  prevState: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  void _formData;
  const challengeToken = await getCookie(
    STORAGE_KEYS.PHONE_CHANGE_CHALLENGE,
  );
  if (!challengeToken) {
    return {
      success: false,
      message: "انتهت جلسة تغيير الرقم. ابدأ من جديد.",
      timestamp: Date.now(),
    };
  }

  try {
    const response = await authService.resendPhoneChange({ challengeToken });
    if (!response.success || !response.data) {
      return {
        success: false,
        message:
          response.status === 409
            ? "رقم الهاتف أصبح مستخدماً بالفعل."
            : response.status === 400
              ? "انتهت جلسة تغيير الرقم. ابدأ من جديد."
              : "تعذر إعادة إرسال الرمز الآن.",
        timestamp: Date.now(),
      };
    }

    await setPhoneChangeChallengeCookie(
      response.data.challengeToken,
      response.data.expiresInSeconds,
    );
    return {
      success: true,
      message: "تم إرسال رمز جديد.",
      maskedPhone: response.data.maskedPhone,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error("Resend phone change action failed:", error);
    return {
      success: false,
      message: "حدث خطأ غير متوقع.",
      timestamp: Date.now(),
    };
  }
}

export async function verifyPhoneChangeAction(
  prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const validated = verifyPhoneChangeSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );
  if (!validated.success) {
    return {
      success: false,
      message: "راجع رمز التحقق.",
      errors: validated.error.flatten().fieldErrors,
      timestamp: Date.now(),
    };
  }

  const challengeToken = await getCookie(
    STORAGE_KEYS.PHONE_CHANGE_CHALLENGE,
  );
  if (!challengeToken) {
    return {
      success: false,
      message: "انتهت جلسة تغيير الرقم. ابدأ من جديد.",
      timestamp: Date.now(),
    };
  }

  try {
    const response = await authService.verifyPhoneChange({
      challengeToken,
      otp: validated.data.otp,
    });
    if (!response.success) {
      return {
        success: false,
        message:
          response.status === 409
            ? "رقم الهاتف أصبح مستخدماً بالفعل."
            : "رمز التحقق غير صحيح أو منتهي.",
        timestamp: Date.now(),
      };
    }
  } catch (error) {
    console.error("Verify phone change action failed:", error);
    return {
      success: false,
      message: "حدث خطأ غير متوقع.",
      timestamp: Date.now(),
    };
  }

  await clearMerchantCredentialCookies();
  redirect("/merchant/login?credentialChanged=phone");
}

export async function cancelPhoneChangeAction() {
  await deleteCookieAction(STORAGE_KEYS.PHONE_CHANGE_CHALLENGE);
  redirect("/merchant/settings/security");
}

async function setPhoneChangeChallengeCookie(
  challengeToken: string,
  maxAge: number,
) {
  await setCookieAction(
    STORAGE_KEYS.PHONE_CHANGE_CHALLENGE,
    challengeToken,
    {
      maxAge,
      sameSite: "strict",
    },
  );
}

async function clearMerchantCredentialCookies() {
  await deleteCookieAction(STORAGE_KEYS.ACCESS_TOKEN);
  await deleteCookieAction(STORAGE_KEYS.USER);
  await deleteCookieAction(STORAGE_KEYS.PHONE_CHANGE_CHALLENGE);
}
