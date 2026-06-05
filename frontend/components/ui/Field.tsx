"use client";

import { useState } from "react";
import type { ComponentProps, ReactNode } from "react";
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

export const Input = ({ className, type, dir, ...props }: ComponentProps<"input">) => {
	const [showPassword, setShowPassword] = useState(false);

	if (type === "password") {
		const isShowing = showPassword;
		const toggleType = showPassword ? "text" : "password";
		const resolvedDir = dir || "ltr";

		return (
			<div className="relative w-full" dir={resolvedDir}>
				<input
					type={toggleType}
					dir={resolvedDir}
					className={cn(
						"block min-h-11 w-full rounded-md border border-(--brand-border) bg-white ps-4 pe-12 py-3 text-base text-(--brand-text) shadow-sm transition-[background-color,border-color,box-shadow] duration-200 placeholder:text-muted-foreground focus:border-(--brand-accent) focus:outline-none focus:ring-4 focus:ring-(--brand-accent)/15 disabled:cursor-not-allowed disabled:opacity-60",
						"text-left",
						className,
					)}
					{...props}
				/>
				<button
					type="button"
					onClick={() => setShowPassword(!showPassword)}
					className="absolute inset-y-0 end-0 flex items-center px-3.5 text-gray-400 hover:text-gray-600 focus:outline-none focus:text-gray-600"
					aria-label={isShowing ? "إخفاء كلمة المرور" : "عرض كلمة المرور"}
				>
					{isShowing ? (
						<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
							<path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.815 7.815L21 21m-3.076-3.076l-3.65-3.65m0 0a3 3 0 11-4.243-4.243m4.242 4.242L9.88 9.88" />
						</svg>
					) : (
						<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
							<path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.644C3.483 8.343 8.003 5.25 12 5.25c3.997 0 8.517 3.093 9.964 6.429a1.012 1.012 0 010 .644C20.517 15.657 16.003 18.75 12 18.75c-3.997 0-8.517-3.093-9.964-6.429z" />
							<path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
						</svg>
					)}
				</button>
			</div>
		);
	}

	const resolvedDir = dir || (type === "tel" ? "ltr" : undefined);
	const isLtr = resolvedDir === "ltr";

	return (
		<input
			type={type}
			dir={resolvedDir}
			className={cn(
				"block min-h-11 w-full rounded-md border border-(--brand-border) bg-white px-4 py-3 text-base text-(--brand-text) shadow-sm transition-[background-color,border-color,box-shadow] duration-200 placeholder:text-muted-foreground focus:border-(--brand-accent) focus:outline-none focus:ring-4 focus:ring-(--brand-accent)/15 disabled:cursor-not-allowed disabled:opacity-60",
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
			"block min-h-28 w-full rounded-md border border-(--brand-border) bg-white px-4 py-3 text-base leading-7 text-(--brand-text) shadow-sm transition-[background-color,border-color,box-shadow] duration-200 placeholder:text-muted-foreground focus:border-(--brand-accent) focus:outline-none focus:ring-4 focus:ring-(--brand-accent)/15 disabled:cursor-not-allowed disabled:opacity-60",
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
