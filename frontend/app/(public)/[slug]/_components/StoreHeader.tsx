import { House } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { TENANT_CATEGORIES, type TenantCategory } from "@/constants";
import { AppHeader } from "@/components/layout/AppHeader";
import InstallPwaAction from "@/components/pwa/InstallPwaAction";
import CustomerStorefrontOnboarding from "@/components/storefront/CustomerStorefrontOnboarding";
import { CUSTOMER_PWA } from "@/lib/customer-pwa";
import type { Tenant } from "@/types/models/tenant";

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

type StoreHeaderProps = {
	tenant: Tenant;
	enableCustomerTour?: boolean;
	cartAction?: ReactNode;
};

export default function StoreHeader({
	tenant,
	enableCustomerTour = false,
	cartAction,
}: StoreHeaderProps) {
	const categoryMeta = resolveTenantCategoryMeta(tenant.category);

	return (
		<AppHeader
			title={tenant.name}
			subtitle={categoryMeta.labels.ar}
			innerClassName="flex flex-col items-start gap-3 px-4 py-3"
			titleActions={cartAction}
			navigation={
				<Link
					href="/"
					className="inline-flex min-h-11 touch-manipulation items-center gap-2 rounded-md border border-white/30 bg-white/10 px-3 py-2.5 text-sm font-bold text-white backdrop-blur transition-colors hover:bg-white/20 active:bg-white/25 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/30"
					aria-label="العودة إلى الصفحة الرئيسية"
				>
					<House className="h-5 w-5 shrink-0" aria-hidden="true" />
					<span>العودة للرئيسية</span>
				</Link>
			}
			actions={
				<>
					{enableCustomerTour ? <CustomerStorefrontOnboarding buttonText="مساعدة" /> : null}
					<InstallPwaAction
						appName={CUSTOMER_PWA.name}
						shareUrl={`/open/store/${encodeURIComponent(tenant.slug)}`}
						id="customer-storefront-pwa-install"
						buttonText="تثبيت التطبيق"
					/>
				</>
			}
			data-store-header={true}
			headerClassName="sticky top-0 z-40 rounded-b-xl border-b border-white/10 bg-brand-primary text-white shadow-soft backdrop-blur-md transition-[background-color,box-shadow] duration-200"
		/>
	);
}
