"use client";

import { useEffect } from "react";

/**
 * Detects when a virtual keyboard is likely open by listening to focus events
 * on input elements. Adds a `keyboard-open` class to the body.
 */
export default function KeyboardStateDetector() {
	useEffect(() => {
		const handleFocusIn = (e: FocusEvent) => {
			const target = e.target as HTMLElement;
			if (
				target.tagName === "INPUT" ||
				target.tagName === "TEXTAREA" ||
				target.tagName === "SELECT" ||
				target.isContentEditable
			) {
				// We exclude certain input types that usually don't open the keyboard
				const inputType = (target as HTMLInputElement).type;
				const noKeyboardTypes = ["radio", "checkbox", "button", "submit", "image", "reset", "file", "color"];
				
				if (!noKeyboardTypes.includes(inputType)) {
					// Only apply this on touch devices (mobile/tablets) where a virtual keyboard actually opens
					const isTouchDevice = window.matchMedia("(pointer: coarse)").matches || ('ontouchstart' in window);
					if (isTouchDevice) {
						document.body.classList.add("keyboard-open");
					}
				}
			}
		};

		const handleFocusOut = () => {
			document.body.classList.remove("keyboard-open");
		};

		window.addEventListener("focusin", handleFocusIn);
		window.addEventListener("focusout", handleFocusOut);

		return () => {
			window.removeEventListener("focusin", handleFocusIn);
			window.removeEventListener("focusout", handleFocusOut);
			document.body.classList.remove("keyboard-open");
		};
	}, []);

	return null;
}
