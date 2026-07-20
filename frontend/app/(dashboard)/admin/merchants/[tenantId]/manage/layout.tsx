import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { endManagedStoreSessionAction } from "@/actions/admin-server";
import { Button } from "@/components/ui/Button";
import {
  getManagedSessionRevokePath,
  hasManagedSectionAccess,
  isManagedSessionFailure,
} from "@/lib/admin-managed-access";
import { adminService } from "@/services/api/admin.service";

type LayoutProps = {
  children: ReactNode;
  params: Promise<{ tenantId: string }>;
};

export default async function ManagedStoreLayout({ children, params }: LayoutProps) {
  const { tenantId: tenantIdValue } = await params;
  const tenantId = Number(tenantIdValue);
  const response = await adminService.getCurrentManagementSession();
  if (!response.success) {
    if (isManagedSessionFailure(response)) {
      redirect(getManagedSessionRevokePath(tenantId));
    }
    throw new Error(response.message || "تعذر التحقق من جلسة إدارة المتجر");
  }
  const session = response.data;

  if (!session || session.tenant_id !== tenantId) {
    redirect(getManagedSessionRevokePath(tenantId));
  }

  const isZoneOperator = Boolean(
    session.tenant.operated_zone_storefront &&
      hasManagedSectionAccess(session.permissions, "dispatches"),
  );
  const links = [
    hasManagedSectionAccess(session.permissions, "products")
      ? { href: `/admin/merchants/${tenantId}/manage/products`, label: "المنتجات" }
      : null,
    hasManagedSectionAccess(session.permissions, "orders") && !isZoneOperator
      ? { href: `/admin/merchants/${tenantId}/manage/orders`, label: "الطلبات" }
      : null,
    hasManagedSectionAccess(session.permissions, "dispatches") &&
    session.tenant.operated_zone_storefront
      ? {
          href: `/admin/zones/${session.tenant.operated_zone_storefront.id}/dispatches`,
          label: "توزيع طلبات المنطقة",
        }
      : null,
    hasManagedSectionAccess(session.permissions, "activity")
      ? { href: `/admin/merchants/${tenantId}/manage/activity`, label: "سجل النشاط" }
      : null,
  ].filter((link): link is { href: string; label: string } => Boolean(link));

  return (
    <div key={session.id} className="space-y-5">
      <div className="sticky top-16 z-30 rounded-lg border border-amber-300 bg-amber-50 p-4 shadow-sm lg:top-0">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="font-bold text-amber-950">
              أنت تدير {session.tenant.name} بصفتك مسؤولاً في تجارتك
            </p>
            <p className="mt-1 text-sm text-amber-900">كل الإجراءات مسجلة · السبب: {session.reason}</p>
            <p className="mt-1 text-xs text-amber-800">
              تنتهي الجلسة بحد أقصى {new Date(session.expires_at).toLocaleString("ar-EG")}
            </p>
          </div>
          <form action={endManagedStoreSessionAction.bind(null, tenantId)}>
            <Button type="submit" variant="outline">إنهاء إدارة المتجر</Button>
          </form>
        </div>
        <nav className="mt-3 flex flex-wrap gap-2 border-t border-amber-200 pt-3" aria-label="أقسام إدارة المتجر">
          {links.map((link) => (
            <a key={link.href} href={link.href} className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-amber-950 hover:bg-amber-100">
              {link.label}
            </a>
          ))}
        </nav>
      </div>
      {children}
    </div>
  );
}
