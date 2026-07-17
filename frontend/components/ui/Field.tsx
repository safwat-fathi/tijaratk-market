"use client";

import { useState } from "react";
import type { ComponentProps, ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

type FieldProps = {
	label: string;
	htmlFor: string;
	error?: string;
	children: ReactNode;
	className?: string;
};

export const Field = ({
	label,
	htmlFor,
	error,
	children,
	className,
}: FieldProps) => (
	<div className={className}>
		<label htmlFor={htmlFor} className="block text-sm font-semibold text-(--brand-text)">
			{label}
		</label>
		<div className="mt-1.5">{children}</div>
		{error ? <FieldError>{error}</FieldError> : null}
	</div>
);

export const FieldError = ({ children }: { children: ReactNode }) => (
	<p className="mt-2 text-sm font-medium text-(--status-error)" role="alert">
		{children}
	</p>
);

type PasswordInputProps = Omit<ComponentProps<"input">, "type">;

export const PasswordInput = ({ className, dir, ...props }: PasswordInputProps) => {
	const [showPassword, setShowPassword] = useState(false);
	const isShowing = showPassword;
	const toggleType = showPassword ? "text" : "password";
	const resolvedDir = dir || "ltr";

	return (
		<div className="relative w-full" dir={resolvedDir}>
			<input
				type={toggleType}
				dir={resolvedDir}
				className={cn(
					"block min-h-11 w-full rounded-md border border-(--brand-border) bg-white ps-4 pe-12 py-3 text-base text-(--brand-text) shadow-sm transition-[background-color,border-color,box-shadow] duration-200 focus:border-(--brand-accent) focus:outline-none focus:ring-4 focus:ring-(--brand-accent)/15 disabled:cursor-not-allowed disabled:opacity-60",
					"text-left",
					className,
				)}
				{...props}
			/>
			<button
				type="button"
				onClick={() => setShowPassword((current) => !current)}
				className="absolute inset-y-0 end-0 flex items-center px-3.5 text-gray-400 hover:text-gray-600 focus:outline-none focus:text-gray-600"
				aria-label={isShowing ? "إخفاء كلمة المرور" : "عرض كلمة المرور"}
			>
				{isShowing ? (
					<EyeOff className="h-5 w-5" aria-hidden="true" />
				) : (
					<Eye className="h-5 w-5" aria-hidden="true" />
				)}
			</button>
		</div>
	);
};

export const Input = ({ className, type, dir, ...props }: ComponentProps<"input">) => {
	if (type === "password") {
		return <PasswordInput className={className} dir={dir} {...props} />;
	}

	const resolvedDir = dir || (type === "tel" ? "ltr" : undefined);
	const isLtr = resolvedDir === "ltr";

	return (
		<input
			type={type}
			dir={resolvedDir}
			className={cn(
				"block min-h-11 w-full rounded-md border border-(--brand-border) bg-white px-4 py-3 text-base text-(--brand-text) shadow-sm transition-[background-color,border-color,box-shadow] duration-200 focus:border-(--brand-accent) focus:outline-none focus:ring-4 focus:ring-(--brand-accent)/15 disabled:cursor-not-allowed disabled:opacity-60",
				isLtr && "text-left",
				className,
			)}
			{...props}
		/>
	);
};

export const Textarea = ({ className, ...props }: ComponentProps<"textarea">) => (
	<textarea
		className={cn(
			"block min-h-28 w-full rounded-md border border-(--brand-border) bg-white px-4 py-3 text-base leading-7 text-(--brand-text) shadow-sm transition-[background-color,border-color,box-shadow] duration-200 focus:border-(--brand-accent) focus:outline-none focus:ring-4 focus:ring-(--brand-accent)/15 disabled:cursor-not-allowed disabled:opacity-60",
			className,
		)}
		{...props}
	/>
);

export const Select = ({ className, ...props }: ComponentProps<"select">) => (
	<select
		className={cn(
			"block min-h-11 w-full rounded-md border border-(--brand-border) bg-white px-4 py-3 text-base text-(--brand-text) shadow-sm transition-[background-color,border-color,box-shadow] duration-200 focus:border-(--brand-accent) focus:outline-none focus:ring-4 focus:ring-(--brand-accent)/15 disabled:cursor-not-allowed disabled:opacity-60",
			className,
		)}
		{...props}
	/>
);
