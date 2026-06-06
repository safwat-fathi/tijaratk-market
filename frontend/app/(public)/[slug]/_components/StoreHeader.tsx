import { TENANT_CATEGORIES, type TenantCategory } from "@/constants";
import { Tenant } from "@/types/models/tenant";
import Link from "next/link";
import SafeImage from "@/components/ui/SafeImage";

type TenantCategoryMeta =
	(typeof TENANT_CATEGORIES)[keyof typeof TENANT_CATEGORIES];

export const resolveTenantCategoryMeta = (
	category: TenantCategory | null | undefined,
): TenantCategoryMeta => {
	switch (category) {
		case TENANT_CATEGORIES.GROCERY.value:
			return TENANT_CATEGORIES.GROCERY;
		case TENANT_CATEGORIES.GREENGROCER.value:
			return TENANT_CATEGORIES.GREENGROCER;
		case TENANT_CATEGORIES.BUTCHER.value:
			return TENANT_CATEGORIES.BUTCHER;
		case TENANT_CATEGORIES.BAKERY.value:
			return TENANT_CATEGORIES.BAKERY;
		case TENANT_CATEGORIES.PHARMACY.value:
			return TENANT_CATEGORIES.PHARMACY;
		default:
			return TENANT_CATEGORIES.OTHER;
	}
};

export default function StoreHeader({ tenant }: { tenant: Tenant }) {
	const categoryMeta = resolveTenantCategoryMeta(tenant.category);

	return (
		<div
			data-store-header
			className="sticky top-0 z-40 rounded-b-xl border-b border-white/10 bg-brand-primary text-white shadow-soft backdrop-blur-md transition-[background-color,box-shadow] duration-200"
		>
			<div className="px-4 py-3 flex items-center justify-between">
				{/* Left: Branding */}
				<div className="flex items-center gap-3">
					<div className="shrink-0 rounded-md border border-white/10 bg-white/20 p-1 shadow-inner backdrop-blur-sm">
						<SafeImage
							src="/tijaratk-logo-suite/app-icon-light.png"
							alt={tenant.name}
							width={40}
							height={40}
							className="rounded-lg object-contain"
							sizes="40px"
							loading="lazy"
							fallback={<div className="h-10 w-10 rounded-lg bg-white/20" />}
						/>
					</div>
					<div className="flex flex-col min-w-0">
						<h1 className="text-lg font-bold tracking-tight leading-tight line-clamp-1">
							{tenant.name}
						</h1>
						<p className="text-xs text-white/80">{categoryMeta.labels.ar}</p>
					</div>
				</div>

				{/* Right: Actions */}
				<Link
					href="/track-orders"
					className="flex min-h-11 items-center justify-center rounded-md border border-white/30 bg-white/10 p-2.5 text-white backdrop-blur transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/30"
					aria-label="تتبع طلباتي"
				>
					تتبع طلباتي
				</Link>
			</div>
		</div>
	);
}
