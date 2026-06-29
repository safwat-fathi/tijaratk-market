"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface ToastProps {
    message: string;
    type?: "success" | "error";
    onClose: () => void;
    duration?: number;
    position?: "top" | "bottom";
}

export default function Toast({
	message,
	type = "error",
	onClose,
	duration = 5000,
	position = "top",
}: ToastProps) {
	const [isClosing, setIsClosing] = useState(false);
	const [mounted, setMounted] = useState(false);

	const positionClass = position === "bottom" ? "bottom-24" : "top-4";
	const closeAnimationClass =
		position === "bottom" ? "translate-y-4 opacity-0" : "-translate-y-4 opacity-0";
	const visibilityClass = isClosing ? closeAnimationClass : "translate-y-0 opacity-100";
	const toneClass = "border-brand-text bg-brand-text text-white";

	useEffect(() => {
		setMounted(true);
	}, []);

	useEffect(() => {
		if (!isClosing) {
			return;
		}

		const closeTimer = setTimeout(onClose, 300);
		return () => clearTimeout(closeTimer);
	}, [isClosing, onClose]);

	useEffect(() => {
		const timer = setTimeout(() => {
			setIsClosing(true);
		}, duration);
		return () => clearTimeout(timer);
	}, [duration, onClose]);

	if (!mounted) return null;

	return createPortal(
		<div
			className={`fixed ${positionClass} left-1/2 z-[60] flex -translate-x-1/2 transform items-center gap-3 rounded-md border px-4 py-3 shadow-float transition-[opacity,transform] duration-200 ${visibilityClass} ${toneClass}`}
			aria-live="polite"
		>
			<div
				className="rounded-full bg-white/10 p-1"
			>
				{type === "error" ? (
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="18"
						height="18"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<circle cx="12" cy="12" r="10" />
						<line x1="12" y1="8" x2="12" y2="12" />
						<line x1="12" y1="16" x2="12.01" y2="16" />
					</svg>
				) : (
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="18"
						height="18"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
						<polyline points="22 4 12 14.01 9 11.01" />
					</svg>
				)}
			</div>
			<p className="font-medium text-sm">{message}</p>
			<button
				onClick={() => setIsClosing(true)}
				aria-label="إغلاق التنبيه"
				className="ml-2 text-white/70 hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/30 cursor-pointer"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
				>
					<line x1="18" y1="6" x2="6" y2="18" />
					<line x1="6" y1="6" x2="18" y2="18" />
				</svg>
			</button>
		</div>,
		document.body
	);
}
