'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from '@/components/ui/Logo';
import { Button } from '@/components/ui/Button';
import { adminLogoutAction } from '@/actions/admin-server';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === '/admin/login') {
    return <div className="min-h-screen bg-gray-50">{children}</div>;
  }

  const navItems = [
    { label: 'لوحة التحكم', href: '/admin' },
    { label: 'التجار', href: '/admin/merchants' },
    { label: 'الباقات', href: '/admin/plans' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row rtl:space-x-reverse" dir="rtl">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-white border-l border-gray-200 flex-shrink-0 flex flex-col min-h-screen md:min-h-0">
        <div className="h-16 flex items-center px-6 border-b border-gray-200">
          <Logo />
          <span className="mr-2 font-bold text-red-600">Admin</span>
        </div>
        <nav className="p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center px-4 py-2 text-sm font-medium rounded-md ${
                  isActive
                    ? 'bg-red-50 text-red-700'
                    : 'text-gray-900 hover:bg-gray-50'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-gray-200 mt-auto">
          <form action={adminLogoutAction}>
            <Button type="submit" variant="outline" className="w-full text-red-600 hover:text-red-700 hover:bg-red-50">
              تسجيل خروج
            </Button>
          </form>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
