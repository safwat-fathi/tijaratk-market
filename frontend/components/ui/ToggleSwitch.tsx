"use client";

import { useState } from "react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type ToggleSwitchProps = {
	name: string;
	label: string;
	defaultChecked?: boolean;
	checked?: boolean;
	onChange?: (checked: boolean) => void;
	className?: string;
	labelClassName?: string;
	inputValue?: {
		checked: string;
		unchecked: string;
	};
} & Omit<
	ComponentProps<"button">,
	| "aria-checked"
	| "aria-label"
	| "children"
	| "defaultChecked"
	| "name"
	| "onChange"
	| "onClick"
	| "role"
	| "type"
	| "value"
>;

export function ToggleSwitch({
	name,
	label,
	defaultChecked = false,
	checked,
	onChange,
	className,
	labelClassName,
	inputValue = { checked: "true", unchecked: "false" },
	disabled,
	...buttonProps
}: ToggleSwitchProps) {
	const [internalChecked, setInternalChecked] = useState(defaultChecked);
	const isControlled = checked !== undefined;
	const isChecked = isControlled ? checked : internalChecked;

	const toggle = () => {
		if (disabled) return;

		const next = !isChecked;
		if (!isControlled) {
			setInternalChecked(next);
		}
		onChange?.(next);
	};

	return (
		<div className={cn("flex items-center gap-3", className)}>
			<button
				type="button"
				role="switch"
				aria-checked={isChecked}
				aria-label={label}
				disabled={disabled}
				onClick={toggle}
				className={cn(
					"relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#27AE60]/20 disabled:cursor-not-allowed disabled:opacity-60",
					isChecked ? "bg-[#27AE60]" : "bg-gray-200",
				)}
				{...buttonProps}
			>
				<span
					className="absolute top-[2px] h-5 w-5 rounded-full border border-gray-300 bg-white transition-all duration-200"
					style={{ left: isChecked ? "2px" : "22px" }}
				/>
			</button>

			<label
				onClick={toggle}
				className={cn(
					"text-sm font-medium text-gray-700 cursor-pointer select-none",
					disabled && "cursor-not-allowed opacity-60",
					labelClassName,
				)}
			>
				{label}
			</label>

			<input
				type="hidden"
				name={name}
				value={isChecked ? inputValue.checked : inputValue.unchecked}
				disabled={disabled}
			/>
		</div>
	);
}
