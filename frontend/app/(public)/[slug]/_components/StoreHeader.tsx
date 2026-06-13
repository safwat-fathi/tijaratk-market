import { TENANT_CATEGORIES, type TenantCategory } from "@/constants";
import { Tenant } from "@/types/models/tenant";
import { AppHeader } from "@/components/layout/AppHeader";

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
		<AppHeader
			title={tenant.name}
			subtitle={categoryMeta.labels.ar}
			data-store-header={true}
			headerClassName="sticky top-0 z-40 rounded-b-xl border-b border-white/10 bg-brand-primary text-white shadow-soft backdrop-blur-md transition-[background-color,box-shadow] duration-200"
		/>
	);
}
