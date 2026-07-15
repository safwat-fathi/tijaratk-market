import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { adminService } from "@/services/api/admin.service";
import { hasActiveManagedPermission } from "@/lib/admin-managed-access";
import { CreateZoneStorefrontForm } from "./_components/CreateZoneStorefrontForm";
import { DispatchSessionForm } from "./_components/DispatchSessionForm";

export const dynamic = "force-dynamic";

export default async function AdminZonesPage() {
  const profileResponse = await adminService.getCurrentAdmin();
  const profile = profileResponse.data;

  if (profile?.role === "operations_admin") {
    const assignedResponse = await adminService.getAssignedTenants();
    const assignedZones = (assignedResponse.data ?? []).flatMap((tenant) => {
      const zone = tenant.operated_zone_storefront;
      return zone && hasActiveManagedPermission(tenant.access, "dispatches.read")
        ? [{ tenant, zone }]
        : [];
    });

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">واجهات المناطق المسندة</h1>
          <p className="mt-1 text-sm text-gray-500">ابدأ جلسة موثقة لفتح قائمة التوزيع الخاصة بالمنطقة.</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {assignedZones.map(({ tenant, zone }) => {
            return (
              <Card key={zone.id} className="p-5">
                <h2 className="font-bold text-gray-900">{zone.name}</h2>
                <p className="mt-1 text-sm text-gray-500">{zone.area.name_ar}</p>
                <DispatchSessionForm
                  zoneId={zone.id}
                  tenantId={tenant.id}
                  canStart={hasActiveManagedPermission(
                    tenant.access,
                    "dispatches.read",
                  )}
                  className="mt-4 space-y-3"
                  inputClassName="w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </Card>
            );
          })}
          {assignedZones.length === 0 ? (
            <Card className="p-8 text-center text-gray-500">لا توجد منطقة بصلاحية توزيع نشطة لهذا الحساب.</Card>
          ) : null}
        </div>
      </div>
    );
  }

  const [zonesResponse, areasResponse] = await Promise.all([
    adminService.getZones(),
    adminService.getDirectoryAreas(),
  ]);
  const zones = Array.isArray(zonesResponse.data) ? zonesResponse.data : [];
  const areas = Array.isArray(areasResponse.data) ? areasResponse.data : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">واجهات المناطق المركزية</h1>
        <p className="mt-1 text-sm text-gray-500">إنشاء واجهة بقطاع واحد وربط المتاجر المؤهلة للتنفيذ اليدوي.</p>
      </div>

      <Card className="p-5">
        <h2 className="text-lg font-bold text-gray-900">إنشاء منطقة</h2>
        <CreateZoneStorefrontForm areas={areas} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {zones.map((zone) => (
          <Card key={zone.id} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-bold text-gray-900">{zone.name}</h2>
                <p className="text-sm text-gray-500">{zone.area.name_ar} · {zone.operator_tenant.category === "pharmacy" ? "صيدلية" : "سوبر ماركت"}</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${zone.is_active ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-700"}`}>
                {zone.is_active ? "مفعلة" : "غير مفعلة"}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-md bg-gray-50 p-2"><strong className="block text-base">{zone.readiness.active_products}/{zone.readiness.essential_catalog_products}</strong>منتج</div>
              <div className="rounded-md bg-gray-50 p-2"><strong className="block text-base">{zone.readiness.active_eligible_merchants}</strong>متجر مؤهل</div>
              <div className="rounded-md bg-gray-50 p-2"><strong className="block text-base">{zone.readiness.catalog_in_sync ? "متطابق" : zone.readiness.catalog_ready ? "جاهز جزئياً" : "ناقص"}</strong>الكتالوج</div>
            </div>
            <Link href={`/admin/zones/${zone.id}`} className="mt-4 inline-flex text-sm font-semibold text-brand-primary hover:underline">إدارة المنطقة</Link>
          </Card>
        ))}
      </div>
    </div>
  );
}
