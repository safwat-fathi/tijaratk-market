import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import {
  getManagedSessionRevokePath,
  getManagedStoreLandingPath,
  isManagedSessionFailure,
} from "@/lib/admin-managed-access";
import { adminService } from "@/services/api/admin.service";

export default async function ManagedStorePage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
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

  const landingPath = getManagedStoreLandingPath(session);
  if (landingPath) {
    redirect(landingPath);
  }

  return (
    <Card className="p-8 text-center">
      <h1 className="text-xl font-bold text-gray-900">
        لا توجد أقسام متاحة للإدارة
      </h1>
      <p className="mt-2 text-sm text-gray-600">
        صلاحيات هذه الجلسة لا تتضمن الوصول إلى المنتجات أو الطلبات أو سجل
        النشاط. اطلب من مسؤول المنصة تحديث صلاحياتك.
      </p>
    </Card>
  );
}
