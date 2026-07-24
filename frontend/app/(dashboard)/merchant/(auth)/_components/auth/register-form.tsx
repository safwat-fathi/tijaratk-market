"use client";

import { useActionState } from "react";
import Link from "next/link";
import { registerAction } from "@/actions/auth-server";
import { TENANT_CATEGORIES, TENANT_CATEGORY_VALUES } from "@/constants";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  Field,
  Input,
  PasswordInput,
  Select,
  Textarea,
} from "@/components/ui/Field";
import { Logo } from "@/components/ui/Logo";

const initialState = {
  success: false,
  message: "",
  errors: undefined,
};

const CATEGORY_OPTIONS = TENANT_CATEGORY_VALUES.map((value) => {
  const label =
    Object.values(TENANT_CATEGORIES).find((item) => item.value === value)
      ?.labels.ar || value;

  return { value, label };
});

export default function RegisterForm() {
  const [state, action, isPending] = useActionState(
    registerAction,
    initialState,
  );

  if (state.success) {
    return (
      <Card className="w-full max-w-md px-6 py-8 text-center sm:px-10">
        <Logo
          variant="icon"
          width={72}
          height={72}
          className="mx-auto mb-5 rounded-xl"
        />
        <div
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-status-success/10 text-2xl text-status-success"
          aria-hidden="true"
        >
          ✓
        </div>
        <h2 className="mt-4 text-2xl font-bold text-brand-text">
          تم استلام طلب انضمام متجرك
        </h2>
        <p className="mt-3 leading-7 text-muted-foreground">
          سيراجع فريق تجارتك بياناتك ويتواصل معك لاستكمال التحقق وطلب
          المستندات القانونية الخاصة بالنشاط.
        </p>
        <div className="mt-5 rounded-xl border border-brand-border bg-brand-soft/30 p-4 text-sm leading-7 text-brand-text">
          لن تتمكن من تسجيل الدخول قبل أن يتواصل معك الفريق ويتم اعتماد الطلب.
        </div>
        <Link
          href="/"
          className="mt-6 inline-flex font-bold text-brand-primary hover:text-brand-primary-hover"
        >
          العودة إلى الرئيسية
        </Link>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md px-6 py-8 sm:px-10">
      <div className="mb-6 flex flex-col items-center text-center">
        <Logo
          variant="icon"
          width={72}
          height={72}
          className="mb-4 rounded-xl"
        />
        <h2 className="text-3xl font-bold tracking-tight text-brand-text">
          طلب انضمام متجر
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          أدخل بياناتك وسنتواصل معك بعد مراجعة الطلب
        </p>
      </div>

      <form action={action} className="space-y-6">
        <Field
          label="اسم المتجر"
          htmlFor="storeName"
          error={state?.errors?.storeName?.[0]}
        >
          <Input
            id="storeName"
            name="storeName"
            type="text"
            autoComplete="organization"
            required
          />
        </Field>

        <Field
          label="نشاط المتجر"
          htmlFor="category"
          error={state?.errors?.category?.[0]}
        >
          <Select
            id="category"
            name="category"
            defaultValue={TENANT_CATEGORIES.OTHER.value}
          >
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="عنوان المتجر بالتفصيل"
          htmlFor="address"
          error={state?.errors?.address?.[0]}
        >
          <Textarea
            id="address"
            name="address"
            autoComplete="street-address"
            placeholder="اسم الشارع، رقم العقار، المنطقة، وعلامة مميزة"
            required
            minLength={5}
            maxLength={500}
          />
        </Field>

        <Field label="اسم صاحب المتجر" htmlFor="name" error={state?.errors?.name?.[0]}>
          <Input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            required
          />
        </Field>

        <Field
          label="رقم الهاتف"
          htmlFor="phone"
          error={state?.errors?.phone?.[0]}
        >
          <Input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
          />
        </Field>

        <Field
          label="كلمة المرور"
          htmlFor="password"
          error={state?.errors?.password?.[0]}
        >
          <PasswordInput
            id="password"
            name="password"
            autoComplete="new-password"
            required
          />
        </Field>

        <Field
          label="تأكيد كلمة المرور"
          htmlFor="confirmPassword"
          error={state?.errors?.confirmPassword?.[0]}
        >
          <PasswordInput
            id="confirmPassword"
            name="confirmPassword"
            autoComplete="new-password"
            required
          />
        </Field>

        <div className="rounded-lg border border-brand-border bg-brand-soft/30 p-3 text-xs text-muted-foreground dark:bg-brand-soft/5">
          <div className="flex items-start gap-2.5">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mt-0.5 shrink-0 text-brand-primary/70"
            >
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <p className="leading-relaxed">
              <strong className="text-brand-text">قبل الإرسال:</strong> الطلب
              يخضع لمراجعة الإدارة، وسيتواصل معك الفريق لطلب المستندات
              القانونية وإثباتات النشاط. لن يتاح تسجيل الدخول إلا بعد
              الاعتماد.
              <span className="mt-2 block">
                المنصة غير مسؤولة عن أي منتج تالف أو منتهي الصلاحية أو غير
                صالح للاستخدام الآدمي.
              </span>
            </p>
          </div>
        </div>

        {state?.message && !state.success && (
          <div className="rounded-md border border-status-error/20 bg-status-error/10 p-4">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-status-error">
                  {state.message}
                </h3>
              </div>
            </div>
          </div>
        )}

        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? "جاري إرسال الطلب…" : "إرسال طلب الانضمام"}
        </Button>
      </form>

      <div className="mt-6">
        <div className="relative">
          <div className="relative flex justify-center text-sm">
            <span className="bg-white px-2 text-muted-foreground">
              تم اعتماد حسابك بالفعل؟{" "}
              <Link
                href="/merchant/login"
                className="font-medium text-brand-primary hover:text-brand-primary-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/20"
              >
                تسجيل الدخول
              </Link>
            </span>
          </div>
        </div>
      </div>

      <div className="mt-6 border-t border-brand-border/60 pt-6">
        <div className="flex flex-col items-center gap-3">
          <span className="text-xs font-medium text-muted-foreground">
            تواجه مشكلة في إنشاء الحساب؟ تواصل معنا
          </span>
          <div className="flex w-full items-center gap-3">
            <a
              href="https://wa.me/201037007345"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#27AE60]/30 bg-[#E8F5ED] px-4 py-2.5 text-sm font-semibold text-[#0F5A3D] transition-colors hover:bg-[#D1EBDC] dark:bg-[#27AE60]/10 dark:text-[#27AE60] dark:border-[#27AE60]/20 dark:hover:bg-[#27AE60]/20"
            >
              <svg
                className="h-5 w-5 fill-current shrink-0"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              واتساب
            </a>
            <a
              href="https://www.facebook.com/profile.php?id=61589320905109"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#1877F2]/30 bg-[#E8F3FF] px-4 py-2.5 text-sm font-semibold text-[#1877F2] transition-colors hover:bg-[#D4E9FF] dark:bg-[#1877F2]/10 dark:text-[#4F95FF] dark:border-[#1877F2]/20 dark:hover:bg-[#1877F2]/20"
            >
              <svg
                className="h-5 w-5 fill-none stroke-current shrink-0"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
              </svg>
              فيسبوك
            </a>
          </div>
        </div>
      </div>
    </Card>
  );
}
