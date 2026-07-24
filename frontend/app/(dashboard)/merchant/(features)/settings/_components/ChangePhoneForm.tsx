"use client";

import { useActionState, useEffect, useState } from "react";
import { Phone, RefreshCw, ShieldCheck } from "lucide-react";
import {
  cancelPhoneChangeAction,
  requestPhoneChangeAction,
  resendPhoneChangeAction,
  verifyPhoneChangeAction,
  type ActionState,
} from "@/actions/auth-server";
import { Button } from "@/components/ui/Button";
import { Field, Input, PasswordInput } from "@/components/ui/Field";

const initialState: ActionState = {
  success: false,
  message: "",
  errors: undefined,
};

type ChangePhoneFormProps = {
  currentPhone: string;
};

export default function ChangePhoneForm({
  currentPhone,
}: ChangePhoneFormProps) {
  const [resendCooldown, setResendCooldown] = useState(0);
  const [requestState, requestAction, isRequestPending] = useActionState(
    requestPhoneChangeAction,
    initialState,
  );
  const [verifyState, verifyAction, isVerifyPending] = useActionState(
    verifyPhoneChangeAction,
    initialState,
  );
  const [resendState, resendAction, isResendPending] = useActionState(
    resendPhoneChangeAction,
    initialState,
  );
  const isVerificationStep = requestState.success === true;
  const cooldownTimestamp = resendState.success
    ? resendState.timestamp
    : requestState.timestamp;

  useEffect(() => {
    if (!isVerificationStep || !cooldownTimestamp) return;

    setResendCooldown(30);
    const interval = window.setInterval(() => {
      setResendCooldown((current) => {
        if (current <= 1) {
          window.clearInterval(interval);
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [cooldownTimestamp, isVerificationStep]);

  return (
    <section className="mt-6 flex flex-col rounded-2xl border border-gray-100 bg-white p-6 shadow-sm md:p-8">
      <div className="mb-6 flex items-center gap-3">
        <span className="rounded-xl bg-emerald-50 p-2.5 text-emerald-700">
          <Phone className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-xl font-bold text-gray-900">تغيير رقم الهاتف</h2>
          <p className="mt-0.5 text-sm text-gray-500" dir="ltr">
            {currentPhone}
          </p>
        </div>
      </div>

      {!isVerificationStep ? (
        <form action={requestAction} className="space-y-6">
          <Field
            label="رقم الهاتف الجديد"
            htmlFor="newPhone"
            error={requestState.errors?.newPhone?.[0]}
          >
            <Input
              id="newPhone"
              name="newPhone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              disabled={isRequestPending}
              required
            />
          </Field>

          <Field
            label="كلمة المرور الحالية"
            htmlFor="phoneChangeCurrentPassword"
            error={requestState.errors?.currentPassword?.[0]}
          >
            <PasswordInput
              id="phoneChangeCurrentPassword"
              name="currentPassword"
              autoComplete="current-password"
              disabled={isRequestPending}
              required
            />
          </Field>

          <ActionMessage state={requestState} />

          <Button
            type="submit"
            disabled={isRequestPending}
            className="w-full"
          >
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            {isRequestPending ? "جاري إرسال الرمز…" : "تحقق من الرقم الجديد"}
          </Button>
        </form>
      ) : (
        <div className="space-y-5">
          <p className="rounded-md border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-800">
            تم إرسال الرمز إلى{" "}
            <span dir="ltr">
              {resendState.maskedPhone || requestState.maskedPhone}
            </span>
          </p>

          <form action={verifyAction} className="space-y-5">
            <Field
              label="رمز التحقق"
              htmlFor="phoneChangeOtp"
              error={verifyState.errors?.otp?.[0]}
            >
              <Input
                id="phoneChangeOtp"
                name="otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                disabled={isVerifyPending}
                required
              />
            </Field>

            <ActionMessage state={verifyState} />

            <Button
              type="submit"
              disabled={isVerifyPending}
              className="w-full"
            >
              {isVerifyPending ? "جاري تغيير الرقم…" : "تأكيد تغيير الرقم"}
            </Button>
          </form>

          <ActionMessage state={resendState} />

          <div className="grid gap-3 sm:grid-cols-2">
            <form action={resendAction}>
              <Button
                type="submit"
                variant="outline"
                disabled={isResendPending || resendCooldown > 0}
                className="w-full"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                {isResendPending
                  ? "جاري الإرسال…"
                  : resendCooldown > 0
                    ? `إعادة الإرسال بعد ${resendCooldown} ث`
                    : "إعادة إرسال الرمز"}
              </Button>
            </form>
            <form action={cancelPhoneChangeAction}>
              <Button type="submit" variant="ghost" className="w-full">
                إلغاء
              </Button>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

const ActionMessage = ({ state }: { state: ActionState }) => {
  if (!state.message || state.success) return null;

  return (
    <p
      className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800"
      role="alert"
    >
      {state.message}
    </p>
  );
};
