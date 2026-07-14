import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { STORAGE_KEYS } from "@/constants";
import { adminService } from "@/services/api/admin.service";
import { AdminShell } from "./_components/AdminShell";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  if (!cookieStore.get(STORAGE_KEYS.ADMIN_ACCESS_TOKEN)?.value) {
    return <div className="min-h-screen bg-gray-50">{children}</div>;
  }

  const response = await adminService.getCurrentAdmin();
  if (!response.success || !response.data) {
    redirect("/admin/login");
  }

  return (
    <AdminShell adminName={response.data.name} role={response.data.role}>
      {children}
    </AdminShell>
  );
}
