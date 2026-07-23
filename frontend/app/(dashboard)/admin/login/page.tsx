'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, Input, PasswordInput } from '@/components/ui/Field';
import { Logo } from '@/components/ui/Logo';
import { adminLoginAction, ActionState } from '@/actions/admin-server';

const initialState: ActionState = {
  success: false,
  message: '',
  errors: undefined,
};

export default function AdminLogin() {
  const [state, action, isPending] = useActionState(adminLoginAction, initialState);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8" dir="rtl">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-sm border border-gray-100">
        <div className="flex flex-col items-center">
          <Logo variant="light" />
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            لوحة تحكم الإدارة
          </h2>
        </div>
        <form className="mt-8 space-y-6" action={action}>
          {state?.message && !state.success && (
            <div className="bg-red-50 text-red-500 p-3 rounded-md text-sm text-center">
              {state.message}
            </div>
          )}
          <div className="space-y-4">
            <Field label="رقم الهاتف" htmlFor="phone" error={state?.errors?.phone?.[0]}>
              <Input
                id="phone"
                name="phone"
                type="tel"
                required
                placeholder="010..."
                dir="ltr"
              />
            </Field>
            <Field label="كلمة المرور" htmlFor="password" error={state?.errors?.password?.[0]}>
              <PasswordInput
                id="password"
                name="password"
                required
              />
            </Field>
          </div>

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? 'جاري الدخول...' : 'تسجيل الدخول'}
          </Button>
        </form>
      </div>
    </div>
  );
}
