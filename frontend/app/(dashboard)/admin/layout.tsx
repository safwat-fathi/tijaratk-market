"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/ui/Logo";
import { adminLogoutAction } from "@/actions/admin-server";

import {
  DashboardSidebar,
  NavItem,
} from "@/components/layout/DashboardSidebar";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (pathname === "/admin/login") {
    return <div className="min-h-screen bg-gray-50">{children}</div>;
  }

  const navItems: NavItem[] = [
    { label: "لوحة التحكم", href: "/admin" },
    { label: "التجار", href: "/admin/merchants" },
    { label: "الباقات", href: "/admin/plans" },
    { label: "المنتجات", href: "/admin/products" },
    { label: "التصنيفات", href: "/admin/categories" },
    { label: "استيراد الكتالوج", href: "/admin/imports" },
    { label: "عناصر الكتالوج", href: "/admin/catalog-items" },
    { label: "الطلبات", href: "/admin/orders" },
    { label: "المناطق", href: "/admin/areas" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden" dir="rtl">
      {/* Mobile sidebar placeholder/trigger */}
      <div className="fixed inset-x-0 top-0 z-40 flex items-center gap-x-6 border-b border-gray-200 bg-white px-4 py-4 shadow-sm sm:px-6 lg:hidden">
        <button
          type="button"
          className="-m-2.5 rounded-md p-2.5 text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 lg:hidden"
          onClick={() => setSidebarOpen(true)}
        >
          <span className="sr-only">فتح القائمة</span>
          <svg
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="2.5"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
            />
          </svg>
        </button>
        <div className="flex-1 text-sm font-semibold leading-6 text-gray-900">
          لوحة تحكم الإدارة
        </div>
        <Logo variant="icon" width={32} height={32} className="h-8 w-8" />
      </div>

      <DashboardSidebar
        title="مسئولى تجارتك"
        navigation={navItems}
        logoutAction={adminLogoutAction}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        basePath="/admin"
      />

      {/* Main Content */}
      <main className="pt-20 pb-10 lg:py-0 lg:ps-72 min-h-screen flex flex-col min-w-0 w-full">
        <div className="p-4 sm:p-8 flex-1 min-w-0 w-full">{children}</div>
      </main>
    </div>
  );
}
