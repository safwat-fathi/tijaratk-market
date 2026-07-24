import { notFound } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  revokeManagedTenantAccessAction,
  upsertManagedTenantAccessAction,
} from "@/actions/admin-server";
import {
  ADMIN_MANAGED_PERMISSION_OPTIONS,
  getAdminManagedPermissionLabel,
} from "@/constants/admin-managed-permissions";
import { adminService } from "@/services/api/admin.service";
import { ManageStoreDialog } from "./_components/ManageStoreDialog";
import { TenantCategoryForm } from "../_components/TenantCategoryForm";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ tenantId: string }>;
};

export default async function AdminMerchantDetailsPage({ params }: PageProps) {
  const { tenantId: tenantIdValue } = await params;
  const tenantId = Number(tenantIdValue);
  if (!Number.isInteger(tenantId) || tenantId <= 0) notFound();

  const [profileResponse, contextResponse] = await Promise.all([
    adminService.getCurrentAdmin(),
    adminService.getManagedMerchantContext(tenantId),
  ]);
  if (!profileResponse.data || !contextResponse.data) notFound();

  const profile = profileResponse.data;
  const context = contextResponse.data;
  const platformData = profile.role === "platform_admin"
    ? await Promise.all([
        adminService.getAdminUsers(),
        adminService.getTenantAccesses(tenantId),
        adminService.getTenantManagementSessions(tenantId),
      ])
    : null;
  const adminUsers = platformData?.[0].data || [];
  const accesses = platformData?.[1].data || [];
  const sessions = platformData?.[2].data || [];
  const canStart = Boolean(
    context.managed_stores_enabled &&
      context.current_admin_access?.is_active &&
      !context.current_admin_access.revoked_at &&
      (!context.current_admin_access.expires_at ||
        new Date(context.current_admin_access.expires_at) > new Date()),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <a href="/admin/merchants" className="text-sm text-brand-primary hover:underline">
            الرجوع إلى التجار
          </a>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">{context.tenant.name}</h1>
          <p className="text-sm text-gray-500">
            {context.tenant.category} · {context.tenant.phone} · {context.tenant.status}
          </p>
        </div>
        <a
          href={`/${context.tenant.slug}`}
          target="_blank"
          rel="noreferrer"
          className="text-sm font-semibold text-brand-primary hover:underline"
        >
          فتح واجهة المتجر
        </a>
      </div>

      <Card className="border-amber-200 bg-amber-50 p-5">
        <h2 className="font-bold text-amber-950">بدء إدارة المتجر</h2>
        <p className="mt-1 text-sm text-amber-900">
          ستظل مسجلاً بهويتك الإدارية، وستُسجل كل التعديلات في سجل النشاط.
        </p>
        <ManageStoreDialog
          tenantId={tenantId}
          storeName={context.tenant.name}
          canStart={canStart}
          disabledMessage={
            !context.managed_stores_enabled
              ? "ميزة إدارة المتاجر غير مفعلة في البيئة الحالية."
              : "لا توجد صلاحية نشطة لحسابك على هذا المتجر."
          }
        />
      </Card>

      <TenantCategoryForm
        tenantId={tenantId}
        currentCategory={context.tenant.category ?? "other"}
      />

      {profile.role === "platform_admin" ? (
        <Card className="space-y-5 p-5">
          <div>
            <h2 className="text-lg font-bold text-gray-900">صلاحيات فريق العمليات</h2>
            <p className="text-sm text-gray-500">استخدم قالباً جاهزاً أو حدد صلاحيات مخصصة.</p>
          </div>
          <form action={upsertManagedTenantAccessAction.bind(null, tenantId)} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <label className="space-y-1 text-sm font-semibold text-gray-700">
                المسؤول
                <select name="admin_user_id" required className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2">
                  <option value="">اختر المسؤول</option>
                  {adminUsers.filter((admin) => admin.is_active).map((admin) => (
                    <option key={admin.id} value={admin.id}>{admin.name} — {admin.phone}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm font-semibold text-gray-700">
                القالب الافتراضي
                <select name="preset" defaultValue="store_manager" className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2">
                  <option value="catalog_operator">مسؤول الكتالوج</option>
                  <option value="order_operator">مسؤول الطلبات</option>
                  <option value="store_manager">مدير المتجر</option>
                </select>
              </label>
              <label className="space-y-1 text-sm font-semibold text-gray-700">
                انتهاء الصلاحية (اختياري)
                <input type="datetime-local" name="expires_at" className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
              </label>
            </div>
            <fieldset>
              <legend className="text-sm font-semibold text-gray-700">تخصيص الصلاحيات (يلغي القالب عند الاختيار)</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {ADMIN_MANAGED_PERMISSION_OPTIONS.map((permission) => (
                  <label key={permission.value} className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                    <input type="checkbox" name="permissions" value={permission.value} />
                    {permission.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <Button type="submit">حفظ الصلاحيات</Button>
          </form>

          <div className="space-y-2">
            {accesses.map((access) => (
              <div key={access.id} className="flex flex-col gap-3 rounded-md border border-gray-200 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{access.admin_user?.name}</p>
                  <p className="text-xs text-gray-500">
                    {access.permissions
                      .map(getAdminManagedPermissionLabel)
                      .join(" · ")}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {access.is_active ? "نشطة" : "ملغاة"}
                    {access.expires_at ? ` · تنتهي ${new Date(access.expires_at).toLocaleString("ar-EG")}` : ""}
                  </p>
                </div>
                {access.is_active ? (
                  <form action={revokeManagedTenantAccessAction.bind(null, tenantId, access.admin_user_id)}>
                    <Button type="submit" variant="outline" size="sm">إلغاء الصلاحية</Button>
                  </form>
                ) : null}
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {profile.role === "platform_admin" ? (
        <Card className="p-5">
          <h2 className="text-lg font-bold text-gray-900">أحدث جلسات الإدارة</h2>
          <div className="mt-4 space-y-2">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="rounded-md border border-gray-200 p-3 text-sm"
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <strong>
                    {session.admin_user.name} ·{" "}
                    {session.admin_user.role === "platform_admin"
                      ? "مسؤول المنصة"
                      : "مسؤول العمليات"}
                  </strong>
                  <span className="text-gray-500">
                    {new Date(session.started_at).toLocaleString("ar-EG")}
                  </span>
                </div>
                <p className="mt-1 text-gray-700">{session.reason}</p>
                <p className="mt-1 text-xs text-gray-500">
                  {session.ended_at
                    ? `انتهت: ${session.end_reason || "غير محدد"}`
                    : "جلسة نشطة"}
                </p>
              </div>
            ))}
            {sessions.length === 0 ? (
              <p className="text-sm text-gray-500">لا توجد جلسات سابقة.</p>
            ) : null}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
