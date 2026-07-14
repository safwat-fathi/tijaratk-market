import { z } from "zod";
import { TENANT_CATEGORIES, TENANT_CATEGORY_VALUES } from "@/constants";

export const loginSchema = z.object({
  phone: z.string().min(10, "Phone number must be at least 10 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const registerSchema = z.object({
  storeName: z.string().min(3, "Store name must be at least 3 characters"),
  name: z.string().min(3, "Name must be at least 3 characters"),
  phone: z.string().min(10, "Phone number must be at least 10 characters"),
  category: z
    .enum(TENANT_CATEGORY_VALUES)
    .optional()
    .default(TENANT_CATEGORIES.OTHER.value),
  address: z
    .string({ error: "عنوان المتجر بالتفصيل مطلوب" })
    .trim()
    .min(5, "عنوان المتجر يجب أن يكون 5 أحرف على الأقل")
    .max(500, "عنوان المتجر يجب ألا يتجاوز 500 حرف"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(6, "Password must be at least 6 characters"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export const requestPasswordResetSchema = z.object({
  phone: z.string().min(10, "Phone number must be at least 10 characters"),
});

export const verifyPasswordResetSchema = z.object({
  phone: z.string().min(10, "Phone number must be at least 10 characters"),
  otp: z.string().regex(/^\d{6}$/, "OTP must be 6 digits"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(6, "Password must be at least 6 characters"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type RequestPasswordResetInput = z.infer<typeof requestPasswordResetSchema>;
export type VerifyPasswordResetInput = z.infer<typeof verifyPasswordResetSchema>;

export const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1, "كلمة المرور الحالية مطلوبة"),
  newPassword: z.string().min(6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل"),
  confirmPassword: z.string().min(6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "كلمات المرور غير متطابقة",
  path: ["confirmPassword"],
});

export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;
