import { updateTenantAreasAction } from "@/actions/admin-server";
import { Button } from "@/components/ui/Button";
import type {
	AdminDirectoryArea,
	AdminTenant,
} from "@/services/api/admin.service";

type TenantAreaFormProps = {
	tenant: AdminTenant;
	areas: AdminDirectoryArea[];
};

const getAreaLabel = (area: AdminDirectoryArea) =>
	[area.name_ar, area.city, area.governorate].filter(Boolean).join(" - ");

export function TenantAreaForm({ tenant, areas }: TenantAreaFormProps) {
	const primaryAreaId = tenant.directory_profile?.area_id ?? "";
	const deliveryAreaIds = new Set(
		tenant.tenant_delivery_areas?.map((deliveryArea) => deliveryArea.area_id) ?? [],
	);
	const selectedDeliveryCount = deliveryAreaIds.size;

	return (
		<form
			action={updateTenantAreasAction.bind(null, tenant.id)}
			className="flex w-full flex-col gap-2 sm:min-w-64"
		>
			<label className="text-xs font-semibold text-gray-600" htmlFor={`tenant-${tenant.id}-area`}>
				المنطقة الأساسية
			</label>
			<select
				id={`tenant-${tenant.id}-area`}
				name="area_id"
				defaultValue={primaryAreaId}
				required
				className="block min-h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-900 focus:border-primary focus:outline-none focus:ring-primary"
			>
				<option value="" disabled>
					اختر المنطقة
				</option>
				{areas.map((area) => (
					<option key={area.id} value={area.id}>
						{getAreaLabel(area)}
					</option>
				))}
			</select>

			<details className="rounded-md border border-gray-200 bg-gray-50">
				<summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-gray-700">
					مناطق التوصيل ({selectedDeliveryCount})
				</summary>
				<div className="max-h-44 overflow-y-auto border-t border-gray-200 bg-white p-2">
					{areas.map((area) => (
						<label
							key={area.id}
							className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
						>
							<input
								type="checkbox"
								name="delivery_area_ids"
								value={area.id}
								defaultChecked={deliveryAreaIds.has(area.id)}
								className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
							/>
							<span>{getAreaLabel(area)}</span>
						</label>
					))}
				</div>
			</details>

			<Button type="submit" size="sm" variant="outline" className="self-start">
				حفظ المناطق
			</Button>
		</form>
	);
}
