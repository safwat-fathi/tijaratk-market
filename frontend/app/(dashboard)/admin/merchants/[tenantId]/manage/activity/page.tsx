import { redirect } from "next/navigation";
import { ActivityTimeline } from "@/components/activity/ActivityTimeline";
import {
  getManagedSessionRevokePath,
  getManagedStoreFallbackPath,
  hasManagedSectionAccess,
  isManagedPermissionFailure,
  isManagedSessionFailure,
} from "@/lib/admin-managed-access";
import { adminService } from "@/services/api/admin.service";

export const dynamic = "force-dynamic";

export default async function ManagedActivityPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId: tenantIdValue } = await params;
  const tenantId = Number(tenantIdValue);
  const sessionResponse = await adminService.getCurrentManagementSession();
  if (!sessionResponse.success) {
    if (isManagedSessionFailure(sessionResponse)) {
      redirect(getManagedSessionRevokePath(tenantId));
    }
    throw new Error(
      sessionResponse.message || "تعذر التحقق من جلسة إدارة المتجر",
    );
  }
  const session = sessionResponse.data;
  if (!session || session.tenant_id !== tenantId) {
    redirect(getManagedSessionRevokePath(tenantId));
  }
  if (!hasManagedSectionAccess(session.permissions, "activity")) {
    redirect(getManagedStoreFallbackPath(session));
  }

  const response = await adminService.getManagedActivityLogs(tenantId, { limit: 50 });
  if (!response.success) {
    if (isManagedSessionFailure(response)) {
      redirect(getManagedSessionRevokePath(tenantId));
    }
    if (isManagedPermissionFailure(response)) {
      redirect(`/admin/merchants/${tenantId}/manage`);
    }
    throw new Error(response.message || "تعذر تحميل سجل نشاط المتجر");
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">سجل نشاط المتجر</h1>
        <p className="text-sm text-gray-500">يعرض هوية المسؤول أو المستخدم الذي نفذ كل إجراء.</p>
      </div>
      <ActivityTimeline items={response.data?.items || []} />
    </div>
  );
}
