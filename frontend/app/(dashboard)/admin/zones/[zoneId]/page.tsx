import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import {
  startManagedStoreSessionAction,
  upsertManagedTenantAccessAction,
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
import { ZoneDeliveryFeesForm } from "./_components/ZoneDeliveryFeesForm";
import { ZoneOperatingHoursForm } from "./_components/ZoneOperatingHoursForm";
import {
  ZoneActivationControl,
  ZoneMerchantControls,
} from "./_components/ZoneAdminControls";
import { isZoneStorefrontEnabled } from "@/lib/zone-storefront-feature";

export const dynamic = "force-dynamic";

type AdminZonePageProps = { params: Promise<{ zoneId: string }> };

export default async function AdminZonePage({ params }: AdminZonePageProps) {
  if (!isZoneStorefrontEnabled()) notFound();

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
        <Link
          href={`/market/${zone.slug}`}
          target="_blank"
          className="inline-flex items-center justify-center gap-2 rounded-md border border-(--brand-border) bg-white px-5 py-3 text-sm font-semibold text-(--brand-text) transition-[background-color,border-color,color,box-shadow,transform] duration-200 hover:border-(--brand-accent) hover:bg-(--brand-soft)/60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-(--brand-accent)/20 active:scale-[0.98] sm:min-h-11"
        >
          <ExternalLink className="h-4 w-4" />
          <span>فتح الواجهة العامة للمنطقة</span>
        </Link>
      </div>

      <Card className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-bold text-gray-900">جاهزية الإطلاق</h2>
            <p className="text-sm text-gray-500">
              {zone.readiness.active_products}/
              {zone.readiness.essential_catalog_products} منتج ·{" "}
              {zone.readiness.active_eligible_merchants} متجر مؤهل ·{" "}
              {zone.readiness.configured_delivery_areas}/
              {zone.readiness.required_delivery_areas} منطقة برسوم ·{" "}
              {zone.readiness.catalog_in_sync
                ? "الكتالوج متطابق"
                : "الكتالوج قيد المزامنة"}{" "}
              · المصدر {zone.readiness.catalog_source}
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <div className="flex flex-wrap gap-2">
              <SyncEssentialCatalogButton zoneId={zone.id} />
              <ZoneActivationControl
                zoneId={zone.id}
                isActive={zone.is_active}
                blockers={zone.readiness.activation_blockers}
              />
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-lg font-bold text-gray-900">ساعات تشغيل المنطقة</h2>
        <p className="mt-1 text-sm text-gray-500">
          الطلبات فورية أثناء التشغيل، وخارجها يختار العميل موعداً مجدولاً لمدة ساعة.
        </p>
        <ZoneOperatingHoursForm
          zoneId={zone.id}
          zoneSlug={zone.slug}
          startsAt={zone.operator_tenant.delivery_starts_at}
          endsAt={zone.operator_tenant.delivery_ends_at}
        />
      </Card>

      <Card className="p-5">
        <h2 className="text-lg font-bold text-gray-900">رسوم مناطق التوصيل</h2>
        <p className="mt-1 text-sm text-gray-500">
          كل منطقة فرعية نشطة لها رسم مستقل، ويجب تحديد رسوم جميع المناطق قبل
          إتاحة الواجهة للعامة.
        </p>
        <ZoneDeliveryFeesForm
          zoneId={zone.id}
          zoneSlug={zone.slug}
          deliveryAreas={zone.delivery_areas}
        />
      </Card>

      <Card className="p-5">
        <h2 className="text-lg font-bold text-gray-900">متاجر التنفيذ</h2>
        <p className="mt-1 text-sm text-gray-500">
          متوقف تعني أن عضوية المتجر في هذه المنطقة غير مفعلة، ولا تعني
          بالضرورة أن المتجر نفسه متوقف.
        </p>
        <ZoneMerchantControls
          zoneId={zone.id}
          eligibleMerchants={eligible}
          memberships={zone.merchants}
        />
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
