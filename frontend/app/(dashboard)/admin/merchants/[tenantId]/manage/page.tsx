import { redirect } from "next/navigation";
import { adminService } from "@/services/api/admin.service";

export default async function ManagedStorePage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const response = await adminService.getCurrentManagementSession();
  const permissions = new Set(response.data?.permissions || []);
  if (permissions.has("products.read")) {
    redirect(`/admin/merchants/${tenantId}/manage/products`);
  }
  if (permissions.has("orders.read")) {
    redirect(`/admin/merchants/${tenantId}/manage/orders`);
  }
  redirect(`/admin/merchants/${tenantId}/manage/activity`);
}
