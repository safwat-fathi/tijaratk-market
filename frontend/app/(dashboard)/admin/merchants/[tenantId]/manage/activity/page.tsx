import { redirect } from "next/navigation";
import { ActivityTimeline } from "@/components/activity/ActivityTimeline";
import { adminService } from "@/services/api/admin.service";

export const dynamic = "force-dynamic";

export default async function ManagedActivityPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId: tenantIdValue } = await params;
  const tenantId = Number(tenantIdValue);
  const response = await adminService.getManagedActivityLogs(tenantId, { limit: 50 });
  if (!response.success) {
    redirect(`/api/auth/admin/managed-session/revoke?redirect=${encodeURIComponent(`/admin/merchants/${tenantId}`)}`);
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
