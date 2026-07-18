import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { STORAGE_KEYS } from "@/constants";
import { adminService } from "@/services/api/admin.service";
import { AdminShell } from "./_components/AdminShell";
import type { Metadata } from "next";
import { merchantPushNotificationsService } from "@/services/api/push-notifications.service";

export const metadata: Metadata = {
  title: "لوحة تحكم الإدارة",
  description: "لوحة تحكم الإدارة لمنصة تجارتك",
  manifest: "/pwa/admin/manifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "تجارتك للإدارة",
  },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  if (!cookieStore.get(STORAGE_KEYS.ADMIN_ACCESS_TOKEN)?.value) {
    return <div className="min-h-screen bg-gray-50">{children}</div>;
  }

  const [response, pushConfigResponse] = await Promise.all([
    adminService.getCurrentAdmin(),
    merchantPushNotificationsService.getConfig(),
  ]);
  if (!response.success || !response.data) {
    redirect("/admin/login");
  }

  return (
    <AdminShell
      adminName={response.data.name}
      role={response.data.role}
      pushConfig={
        pushConfigResponse.success && pushConfigResponse.data
          ? pushConfigResponse.data
          : { enabled: false }
      }
    >
      {children}
    </AdminShell>
  );
}
