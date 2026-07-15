import Link from "next/link";
import { notFound } from "next/navigation";
import {
  startManagedStoreSessionAction,
  updateZoneActivationAction,
  upsertManagedTenantAccessAction,
  upsertZoneMerchantAction,
} from "@/actions/admin-server";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  getAdminManagedPermissionLabel,
} from "@/constants/admin-managed-permissions";
import { adminService } from "@/services/api/admin.service";
import { hasActiveManagedPermission } from "@/lib/admin-managed-access";
import { DispatchSessionForm } from "../_components/DispatchSessionForm";
import { SyncEssentialCatalogButton } from "../_components/SyncEssentialCatalogButton";

export const dynamic = "force-dynamic";

type AdminZonePageProps = { params: Promise<{ zoneId: string }> };

export default async function AdminZonePage({ params }: AdminZonePageProps) {
  const zoneId = Number((await params).zoneId);
  if (!Number.isInteger(zoneId) || zoneId <= 0) notFound();
  const zoneResponse = await adminService.getZone(zoneId);
  if (!zoneResponse.success || !zoneResponse.data) notFound();
  const zone = zoneResponse.data;
  const [
    eligibleResponse,
    adminsResponse,
    accessesResponse,
    profileResponse,
  ] = await Promise.all([
    adminService.getEligibleZoneMerchants(zoneId),
    adminService.getAdminUsers(),
    adminService.getTenantAccesses(zone.operator_tenant.id),
    adminService.getCurrentAdmin(),
  ]);
  const eligible = eligibleResponse.data ?? [];
  const admins = adminsResponse.data ?? [];
  const accesses = accessesResponse.data ?? [];
  const currentAccess = accesses.find(
    (access) => access.admin_user_id === profileResponse.data?.id,
  );
  const canStartDispatch = hasActiveManagedPermission(
    currentAccess,
    "dispatches.read",
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href="/admin/zones" className="text-sm text-brand-primary hover:underline">الرجوع إلى المناطق</Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">{zone.name}</h1>
          <p className="text-sm text-gray-500">{zone.area.name_ar} · المشغل الداخلي #{zone.operator_tenant.id} · عمليات {zone.operations_phone}</p>
        </div>
        <Link href={`/market/${zone.slug}`} target="_blank" className="text-sm font-semibold text-brand-primary hover:underline">فتح الواجهة العامة</Link>
      </div>

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-bold text-gray-900">جاهزية الإطلاق</h2>
            <p className="text-sm text-gray-500">{zone.readiness.active_products} منتج · {zone.readiness.active_eligible_merchants} متجر مؤهل · المصدر {zone.readiness.catalog_source}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <SyncEssentialCatalogButton zoneId={zone.id} />
            <form action={updateZoneActivationAction.bind(null, zone.id, !zone.is_active)}>
              <Button type="submit" variant={zone.is_active ? "outline" : "primary"}>{zone.is_active ? "إيقاف الطلبات الجديدة" : "تفعيل المنطقة"}</Button>
            </form>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-lg font-bold text-gray-900">متاجر التنفيذ</h2>
        <form action={upsertZoneMerchantAction.bind(null, zone.id)} className="mt-4 grid gap-3 md:grid-cols-4">
          <select name="tenant_id" required className="rounded-md border border-gray-300 bg-white px-3 py-2 md:col-span-2">
            <option value="">اختر متجراً يغطي المنطقة</option>
            {eligible.map((merchant) => <option key={merchant.id} value={merchant.id}>{merchant.name}</option>)}
          </select>
          <input name="priority" type="number" defaultValue="0" className="rounded-md border border-gray-300 px-3 py-2" aria-label="الأولوية" />
          <input type="hidden" name="is_active" value="true" />
          <Button type="submit">حفظ العضوية</Button>
        </form>
        <div className="mt-4 space-y-2">
          {zone.merchants.map((membership) => (
            <div key={membership.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-gray-200 p-3 text-sm">
              <div><strong>{membership.tenant.name}</strong><p className="text-xs text-gray-500">أولوية {membership.priority} · {membership.is_active ? "نشط" : "متوقف"}</p></div>
              <form action={upsertZoneMerchantAction.bind(null, zone.id)}>
                <input type="hidden" name="tenant_id" value={membership.tenant_id} />
                <input type="hidden" name="priority" value={membership.priority} />
                <input type="hidden" name="is_active" value={String(!membership.is_active)} />
                <Button type="submit" size="sm" variant="outline">{membership.is_active ? "إيقاف" : "إعادة تفعيل"}</Button>
              </form>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-lg font-bold text-gray-900">وصول مسؤولي التوزيع</h2>
        <form action={upsertManagedTenantAccessAction.bind(null, zone.operator_tenant.id)} className="mt-4 grid gap-3 md:grid-cols-3">
          <select name="admin_user_id" required className="rounded-md border border-gray-300 bg-white px-3 py-2">
            <option value="">اختر المسؤول</option>
            {admins.filter((admin) => admin.is_active).map((admin) => <option key={admin.id} value={admin.id}>{admin.name}</option>)}
          </select>
          <select name="preset" defaultValue="order_operator" className="rounded-md border border-gray-300 bg-white px-3 py-2">
            <option value="order_operator">تشغيل الطلبات والتوزيع</option>
            <option value="store_manager">الكتالوج والطلبات والتوزيع</option>
          </select>
          <Button type="submit">منح صلاحيات الطلبات والتوزيع</Button>
        </form>
        <div className="mt-4 space-y-2 text-sm">
          {accesses
            .filter((access) => access.is_active)
            .map((access) => (
              <p key={access.id}>
                {access.admin_user?.name} · {access.permissions
                  .map(getAdminManagedPermissionLabel)
                  .join("، ")}
              </p>
            ))}
        </div>
      </Card>

      <Card className="border-amber-200 bg-amber-50 p-5">
        <h2 className="font-bold text-amber-950">بدء جلسة توزيع</h2>
        <DispatchSessionForm
          zoneId={zone.id}
          tenantId={zone.operator_tenant.id}
          canStart={canStartDispatch}
          className="mt-3 flex flex-col gap-3 sm:flex-row"
        />
        <form action={startManagedStoreSessionAction.bind(null, zone.operator_tenant.id)} className="mt-3 flex flex-col gap-3 border-t border-amber-200 pt-3 sm:flex-row">
          <input name="reason" required minLength={10} maxLength={500} className="flex-1 rounded-md border border-amber-300 px-3 py-2" placeholder="سبب إدارة الكتالوج المركزي" />
          <Button type="submit" variant="outline">إدارة كتالوج المشغل</Button>
        </form>
      </Card>
    </div>
  );
}
