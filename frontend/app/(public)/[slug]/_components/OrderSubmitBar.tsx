import type { Ref } from "react";
import { formatCurrency } from "@/lib/utils/currency";
import { formatArabicQuantity } from "@/lib/utils/number";

type OrderSubmitBarProps = {
	totalItems: number;
	hasPricedItems: boolean;
	estimatedTotal: number;
	orderRequest: string;
	isPending: boolean;
	deliveryAvailable?: boolean;
	onSubmitClick?: () => void;
	triggerButtonRef?: Ref<HTMLButtonElement>;
};

export default function OrderSubmitBar({
	totalItems,
	hasPricedItems,
	estimatedTotal,
	orderRequest,
	isPending,
	deliveryAvailable = true,
	onSubmitClick,
	triggerButtonRef,
}: OrderSubmitBarProps) {
	if (!(totalItems > 0 || orderRequest.trim())) {
		return null;
	}

	const isDisabled = isPending || !deliveryAvailable || (totalItems === 0 && !orderRequest.trim());

	return (
		<>
			<div
				data-order-submit-bar
				className="fixed bottom-0 left-0 right-0 z-[40] border-t border-brand-border bg-white/90 px-4 pt-4 safe-bottom-padding shadow-float backdrop-blur-xl"
			>
				<div className="max-w-md mx-auto">
					<div className="mb-4 flex items-end justify-between px-2">
						<div className="text-sm font-medium text-muted-foreground">العناصر المختارة</div>
						<div className="flex items-baseline gap-1">
							{totalItems > 0 ? (
								<>
									<span className="text-2xl font-bold text-brand-text">
										{formatArabicQuantity(totalItems) || String(totalItems)}
									</span>
									<span className="text-sm font-semibold text-muted-foreground">عنصر</span>
									{hasPricedItems && (
										<span className="mr-2 text-sm font-bold text-brand-primary">
											{formatCurrency(estimatedTotal)}
										</span>
									)}
								</>
							) : (
								<span className="text-sm font-medium italic text-muted-foreground">
									السعر يتم تأكيده بعد الطلب
								</span>
							)}
						</div>
					</div>

					{!deliveryAvailable && (
						<p className="mb-3 rounded-md border border-status-error/20 bg-status-error/10 px-3 py-2 text-sm font-semibold text-status-error">
							التوصيل غير متاح حالياً ولا يمكن إرسال طلب جديد.
						</p>
					)}

					<button
						type="button"
						ref={triggerButtonRef}
						onClick={onSubmitClick}
						disabled={isDisabled}
						className="flex w-full items-center justify-center gap-3 rounded-lg bg-brand-primary py-4 text-lg font-bold text-white shadow-soft transition-[background-color,box-shadow,transform] duration-200 hover:bg-brand-primary-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/20"
					>
						{isPending ? (
							<>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="24"
									height="24"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
									className="animate-spin"
								>
									<path d="M21 12a9 9 0 1 1-6.219-8.56" />
								</svg>
								<span>جاري الإرسال…</span>
							</>
						) : (
							<>
								<span>تأكيد الطلب</span>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="20"
									height="20"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
								>
									<path d="m12 19-7-7 7-7" />
									<path d="M19 12H5" />
								</svg>
							</>
						)}
					</button>
				</div>
			</div>
			<div className="h-32"></div>
		</>
	);
}
