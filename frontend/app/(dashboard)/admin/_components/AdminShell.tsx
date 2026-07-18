"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { adminLogoutAction } from "@/actions/admin-server";
import {
  DashboardSidebar,
  type NavItem,
} from "@/components/layout/DashboardSidebar";
import type { AdminRole } from "@/services/api/admin.service";
import { DashboardPwaControls } from "@/components/pwa/DashboardPwaControls";
import type { PushNotificationsConfig } from "@/types/services/push-notifications";

type AdminShellProps = {
  adminName: string;
  role: AdminRole;
  children: ReactNode;
  pushConfig: PushNotificationsConfig;
};

const platformNavigation: NavItem[] = [
  { label: "لوحة التحكم", href: "/admin" },
  { label: "التجار", href: "/admin/merchants" },
  { label: "الباقات", href: "/admin/plans" },
  { label: "المنتجات", href: "/admin/products" },
  { label: "التصنيفات", href: "/admin/categories" },
  {
    label: "الكتالوج",
    href: "#",
    children: [
      { label: "استيراد الكتالوج", href: "/admin/imports" },
      { label: "عناصر الكتالوج", href: "/admin/catalog-items" },
    ],
  },
  { label: "الطلبات", href: "/admin/orders" },
  { label: "المناطق", href: "/admin/areas" },
  { label: "واجهات المناطق", href: "/admin/zones" },
  { label: "سجل نشاط الإدارة", href: "/admin/activity" },
];

const operationsNavigation: NavItem[] = [
  { label: "المتاجر المسندة", href: "/admin/merchants" },
  { label: "توزيع طلبات المناطق", href: "/admin/zones" },
];

export const AdminShell = ({
  adminName,
  role,
  children,
  pushConfig,
}: AdminShellProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigation = role === "platform_admin"
    ? platformNavigation
    : operationsNavigation;

  return (
    <div className="min-h-screen overflow-x-hidden bg-gray-50" dir="rtl">
      <DashboardPwaControls
        scope="admin"
        appName="تجارتك للإدارة"
        config={pushConfig}
      />
      <div className="fixed inset-x-0 top-0 z-40 flex items-center gap-4 border-b border-gray-200 bg-white px-4 py-4 pe-48 shadow-sm sm:px-6 sm:pe-48 lg:hidden">
        <button
          type="button"
          className="-m-2.5 rounded-md p-2.5 text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          onClick={() => setSidebarOpen(true)}
        >
          <span className="sr-only">فتح القائمة</span>
          <span aria-hidden="true" className="text-xl">☰</span>
        </button>
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900">لوحة تحكم الإدارة</p>
          <p className="text-xs text-gray-500">{adminName}</p>
        </div>
      </div>

      <DashboardSidebar
        title={role === "platform_admin" ? "مسئولو تجارتك" : "عمليات تجارتك"}
        navigation={navigation}
        logoutAction={adminLogoutAction}
        pushScope="admin"
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        basePath="/admin"
      />

      <main className="flex min-h-screen min-w-0 w-full flex-col pb-10 pt-20 lg:ps-72 lg:pt-20">
        <div className="min-w-0 w-full flex-1 p-4 sm:p-8">{children}</div>
      </main>
    </div>
  );
};
