"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/actions/auth-server";
import { Logo } from "@/components/ui/Logo";
import InstallPwaAction from "@/components/pwa/InstallPwaAction";
import { SupportWidget } from "@/components/ui/SupportWidget";

const navigation = [
  {
    label: "لوحة التحكم",
    href: "/merchant",
    icon: (
      <svg
        className="me-3 h-6 w-6 shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="2.5"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
        />
      </svg>
    ),
  },
  {
    label: "الطلبات",
    href: "/merchant/orders",
    icon: (
      <svg
        className="me-3 h-6 w-6 shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="2.5"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
        />
      </svg>
    ),
  },
  {
    label: "المنتجات",
    href: "/merchant/products/new",
    icon: (
      <svg
        className="me-3 h-6 w-6 shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="2.5"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9"
        />
      </svg>
    ),
  },
  {
    label: "العملاء",
    href: "/merchant/customers",
    icon: (
      <svg
        className="me-3 h-6 w-6 shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="2.5"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
        />
      </svg>
    ),
  },
  {
    label: "طلبات توفير المنتجات",
    href: "/merchant/availability-requests",
    icon: (
      <svg
        className="me-3 h-6 w-6 shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="2.5"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
        />
      </svg>
    ),
  },
  {
    label: "سجل النشاط",
    href: "/merchant/activity",
    icon: (
      <svg
        className="me-3 h-6 w-6 shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="2.5"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 6v6l3.75 2.25M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
        />
      </svg>
    ),
  },
  {
    label: "الإعدادات",
    href: "/merchant/settings",
    icon: (
      <svg
        className="me-3 h-6 w-6 shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="2.5"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 0 1 1.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.559.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.894.149c-.424.07-.764.383-.929.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 0 1-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.398.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 0 1-.12-1.45l.527-.737c.25-.35.272-.806.108-1.204-.165-.397-.506-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 0 1 .12-1.45l.773-.773a1.125 1.125 0 0 1 1.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894Z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
        />
      </svg>
    ),
  },
  {
    label: "إعدادات الأمان",
    href: "/merchant/settings/security",
    icon: (
      <svg
        className="me-3 h-6 w-6 shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="2.5"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
        />
      </svg>
    ),
  },
];

import { DashboardSidebar } from "@/components/layout/DashboardSidebar";

// ... [previous code, navigation array]

export default function MerchantLayoutClient({
  children,
  merchantAppName,
}: {
  children: React.ReactNode;
  merchantAppName: string;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar placeholder/trigger */}
      <div className="fixed inset-x-0 top-0 z-40 flex items-center gap-x-6 border-b border-brand-border bg-white px-4 py-4 shadow-soft sm:px-6 lg:hidden">
        <button
          type="button"
          className="-m-2.5 rounded-md p-2.5 text-brand-text transition-colors hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/20 lg:hidden"
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
        <div className="flex-1 text-sm font-semibold leading-6 text-brand-text">
          لوحة التحكم
        </div>
        <div className="flex items-center gap-2">
          <InstallPwaAction
            appName={merchantAppName}
            className="border-brand-border bg-brand-soft text-brand-primary hover:bg-brand-soft/80 focus-visible:ring-brand-accent/20"
            iconClassName="h-5 w-5"
          />
          <Link href="#">
            <span className="sr-only">الملف الشخصي</span>
            <Logo
              variant="icon"
              width={32}
              height={32}
              className="h-8 w-8 rounded-full bg-brand-soft"
            />
          </Link>
        </div>
      </div>

      <DashboardSidebar
        title={
          <Logo
            variant="light"
            width={150}
            height={40}
            className="h-8 w-auto"
          />
        }
        topContent={
          <InstallPwaAction
            appName={merchantAppName}
            buttonText="تثبيت التطبيق"
            className="w-full justify-start border-brand-border bg-brand-soft/60 text-brand-primary hover:bg-brand-soft focus-visible:ring-brand-accent/20"
            iconClassName="h-5 w-5"
          />
        }
        navigation={navigation}
        logoutAction={logoutAction}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        basePath="/merchant"
        activeClass="bg-brand-soft text-brand-primary"
        inactiveClass="text-brand-text hover:bg-brand-soft hover:text-brand-primary"
      />

      {/* Main content */}
      <main className="pt-24 pb-10 lg:py-10 lg:ps-72 w-full min-w-0 max-w-full flex-1 flex flex-col">
        <div className="px-4 sm:px-6 lg:px-8 w-full min-w-0">{children}</div>
      </main>

      {/* Global Support Widget FAB */}
      <SupportWidget />
    </div>
  );
}
