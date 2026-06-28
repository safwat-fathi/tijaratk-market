"use client";

import { useActionState } from "react";
import { updatePasswordAction } from "@/actions/auth-server";
import { Lock } from "lucide-react";

export default function UpdatePasswordForm() {
  const [state, formAction, isPending] = useActionState(
    updatePasswordAction,
    {
      success: false,
      message: "",
      errors: undefined,
    },
  );

  return (
    <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-gray-100 flex flex-col h-full mt-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-blue-50 text-blue-600 p-2.5 rounded-xl">
          <Lock className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">تغيير كلمة المرور</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            قم بتحديث كلمة المرور الخاصة بحسابك
          </p>
        </div>
      </div>

      <form action={formAction} className="space-y-6">
        {state.message && (
          <div
            className={`rounded-md border p-4 text-sm font-medium ${
              state.success
                ? "border-green-200 bg-green-50 text-green-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {state.message}
          </div>
        )}

        <div className="space-y-2">
          <label
            htmlFor="currentPassword"
            className="block text-sm font-medium text-gray-700"
          >
            كلمة المرور الحالية
          </label>
          <input
            type="password"
            id="currentPassword"
            name="currentPassword"
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
            disabled={isPending}
            required
          />
          {state.errors?.currentPassword && (
            <p className="text-sm text-red-500 mt-1">
              {state.errors.currentPassword[0]}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label
            htmlFor="newPassword"
            className="block text-sm font-medium text-gray-700"
          >
            كلمة المرور الجديدة
          </label>
          <input
            type="password"
            id="newPassword"
            name="newPassword"
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
            disabled={isPending}
            required
            minLength={6}
          />
          {state.errors?.newPassword && (
            <p className="text-sm text-red-500 mt-1">
              {state.errors.newPassword[0]}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label
            htmlFor="confirmPassword"
            className="block text-sm font-medium text-gray-700"
          >
            تأكيد كلمة المرور الجديدة
          </label>
          <input
            type="password"
            id="confirmPassword"
            name="confirmPassword"
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
            disabled={isPending}
            required
            minLength={6}
          />
          {state.errors?.confirmPassword && (
            <p className="text-sm text-red-500 mt-1">
              {state.errors.confirmPassword[0]}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full py-3 px-4 bg-brand-primary text-white font-medium rounded-xl hover:bg-brand-primary/90 focus:outline-none focus:ring-4 focus:ring-brand-primary/20 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isPending ? (
            <>
              <svg
                className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              جاري التحديث...
            </>
          ) : (
            "تحديث كلمة المرور"
          )}
        </button>
      </form>
    </div>
  );
}
