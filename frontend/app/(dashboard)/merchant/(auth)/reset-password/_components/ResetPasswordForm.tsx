"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import {
	requestPasswordResetAction,
	verifyPasswordResetAction,
	type ActionState,
} from "@/actions/auth-server";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input, PasswordInput } from "@/components/ui/Field";
import { Logo } from "@/components/ui/Logo";

const initialState: ActionState = {
	success: false,
	message: "",
	errors: undefined,
};

const resolveSubmitLabel = ({
	shouldShowCodeStep,
	isRequestPending,
	isVerifyPending,
}: {
	shouldShowCodeStep: boolean;
	isRequestPending: boolean;
	isVerifyPending: boolean;
}) => {
	if (shouldShowCodeStep) {
		return isVerifyPending ? "جاري تغيير كلمة المرور…" : "تغيير كلمة المرور";
	}

	return isRequestPending ? "جاري إرسال الرمز…" : "إرسال رمز التحقق";
};

export default function ResetPasswordForm() {
	const [phone, setPhone] = useState("");
	const [hasRequestedCode, setHasRequestedCode] = useState(false);
	const [resendCooldown, setResendCooldown] = useState(0);
	const [requestState, requestAction, isRequestPending] = useActionState(
		requestPasswordResetAction,
		initialState,
	);
	const [verifyState, verifyAction, isVerifyPending] = useActionState(
		verifyPasswordResetAction,
		initialState,
	);
	const shouldShowCodeStep = hasRequestedCode;

	const activeState = shouldShowCodeStep ? verifyState : requestState;
	const submitLabel = resolveSubmitLabel({
		shouldShowCodeStep,
		isRequestPending,
		isVerifyPending,
	});

	useEffect(() => {
		if (!requestState.success || !requestState.timestamp) return;

		setHasRequestedCode(true);
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
	}, [requestState.success, requestState.timestamp]);

	return (
		<Card className="w-full max-w-md px-6 py-8 sm:px-10">
			<div className="mb-6 flex flex-col items-center text-center">
				<Logo variant="icon" width={72} height={72} className="mb-4 rounded-xl" />
				<h2 className="text-3xl font-bold tracking-tight text-brand-text">
					إعادة تعيين كلمة المرور
				</h2>
				<p className="mt-2 text-sm text-muted-foreground">
					سنرسل رمز تحقق في رسالة نصية (SMS) لرقم حساب التاجر.
				</p>
			</div>

			{verifyState.success ? (
				<div className="space-y-4">
					<div className="rounded-md border border-status-success/20 bg-status-success/10 p-4 text-sm font-medium text-status-success">
						{verifyState.message}
					</div>
					<Link
						href="/merchant/login"
						className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-transparent bg-brand-primary px-5 py-3 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-brand-primary-hover"
					>
						تسجيل الدخول
					</Link>
				</div>
			) : (
				<form
					action={shouldShowCodeStep ? verifyAction : requestAction}
					className="space-y-6"
				>
					<Field
						label="رقم الهاتف"
						htmlFor="phone"
						error={activeState?.errors?.phone?.[0]}
					>
						<Input
							id="phone"
							name="phone"
							type="tel"
							inputMode="tel"
							autoComplete="tel"
							required
							value={phone}
							onChange={(event) => setPhone(event.target.value)}
							readOnly={shouldShowCodeStep}
						/>
					</Field>

					{shouldShowCodeStep && (
						<>
							<p className="rounded-md border border-brand-border bg-brand-soft/40 p-3 text-sm text-muted-foreground">
								إذا كان الرقم مسجلاً، فسيصل إليه رمز مكوّن من 6 أرقام.
							</p>
							{requestState.success === false && requestState.message ? (
								<p
									className="rounded-md border border-status-error/20 bg-status-error/10 p-3 text-sm text-status-error"
									role="alert"
								>
									{requestState.message}
								</p>
							) : null}
							<Field
								label="رمز التحقق"
								htmlFor="otp"
								error={verifyState?.errors?.otp?.[0]}
							>
								<Input
									id="otp"
									name="otp"
									type="text"
									inputMode="numeric"
									autoComplete="one-time-code"
									maxLength={6}
									required
								/>
							</Field>

							<Field
								label="كلمة المرور الجديدة"
								htmlFor="password"
								error={verifyState?.errors?.password?.[0]}
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
								error={verifyState?.errors?.confirmPassword?.[0]}
							>
								<PasswordInput
									id="confirmPassword"
									name="confirmPassword"
									autoComplete="new-password"
									required
								/>
							</Field>
						</>
					)}

					{activeState?.message && (
						<div
							className={`rounded-md border p-4 text-sm font-medium ${
								activeState.success
									? "border-status-success/20 bg-status-success/10 text-status-success"
									: "border-status-error/20 bg-status-error/10 text-status-error"
							}`}
						>
							{activeState.message}
						</div>
					)}

					<Button
						type="submit"
						disabled={isRequestPending || isVerifyPending}
						className="w-full"
					>
						{submitLabel}
					</Button>

					{shouldShowCodeStep ? (
						<Button
							type="submit"
							variant="ghost"
							formAction={requestAction}
							formNoValidate
							disabled={
								isRequestPending ||
								isVerifyPending ||
								resendCooldown > 0
							}
							className="w-full"
						>
							{isRequestPending
								? "جاري إعادة الإرسال…"
								: resendCooldown > 0
									? `إعادة الإرسال بعد ${resendCooldown} ثانية`
									: "إعادة إرسال الرمز"}
						</Button>
					) : null}
				</form>
			)}

			<div className="mt-6 text-center text-sm">
				<Link
					href="/merchant/login"
					className="font-medium text-brand-primary hover:text-brand-primary-hover"
				>
					العودة لتسجيل الدخول
				</Link>
			</div>
		</Card>
	);
}
