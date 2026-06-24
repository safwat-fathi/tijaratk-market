"use client";

import { useEffect } from "react";

export default function ErrorPage({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		// Log the error to an error reporting service
		console.error(error);
	}, [error]);

	return (
		<div className="min-h-[70vh] flex flex-col items-center justify-center p-4">
			<div className="w-full max-w-md text-center space-y-8">
				{/* Icon */}
				<div className="mx-auto w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-6">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						className="w-10 h-10 text-red-500"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<circle cx="12" cy="12" r="10"></circle>
						<line x1="12" y1="8" x2="12" y2="12"></line>
						<line x1="12" y1="16" x2="12.01" y2="16"></line>
					</svg>
				</div>

				{/* Content */}
				<div className="space-y-2">
					<h2 className="text-3xl font-bold tracking-tight text-gray-900">
						حدث خطأ ما!
					</h2>
					<p className="text-gray-500">
						نعتذر عن الإزعاج. حدث خطأ غير متوقع في هذه الصفحة.
					</p>
				</div>

				{/* Error Details (Collapsible/Optional) */}
				<div className="w-full bg-gray-50 rounded-lg p-4 text-start border border-gray-100 overflow-hidden">
					<div className="flex items-center gap-2 mb-2">
						<span className="w-2 h-2 rounded-full bg-red-400"></span>
						<span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
							تفاصيل الخطأ
						</span>
					</div>
					<p className="text-sm font-mono text-gray-700 break-words leading-relaxed">
						{error.message || "حدث خطأ غير معروف"}
					</p>
					{error.digest && (
						<p className="text-xs font-mono text-gray-400 mt-2 pt-2 border-t border-gray-200">
							معرف الخطأ: {error.digest}
						</p>
					)}
				</div>

				{/* Actions */}
				<div className="flex flex-col sm:flex-row gap-3 pt-4">
					<button
						onClick={() => reset()}
						className="flex-1 rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black transition-all active:scale-[0.98]"
					>
						حاول مرة أخرى
					</button>
					<button
						onClick={() => (window.location.href = "/")}
						className="flex-1 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 transition-all active:scale-[0.98]"
					>
						العودة للرئيسية
					</button>
				</div>
			</div>
		</div>
	);
}
