import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";

export interface NavItem {
  label: string;
  href: string;
  icon?: React.ReactNode;
}

export interface DashboardSidebarProps {
  title?: React.ReactNode;
  navigation: NavItem[];
  logoutAction: string | ((formData: FormData) => void) | any;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  topContent?: React.ReactNode; // Extra content at the top (e.g. Install PWA)
  basePath?: string; // e.g. '/admin' or '/merchant' for active state logic
  activeClass?: string;
  inactiveClass?: string;
}

export function DashboardSidebar({
  title,
  navigation,
  logoutAction,
  sidebarOpen,
  setSidebarOpen,
  topContent,
  basePath = "/",
  activeClass = "bg-red-50 text-red-700",
  inactiveClass = "text-gray-900 hover:bg-gray-50 hover:text-gray-900",
}: DashboardSidebarProps) {
  const pathname = usePathname();

  const isItemActive = (href: string) => {
    if (href === basePath) {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  const SidebarContent = () => (
    <div className="flex grow flex-col overflow-y-auto bg-white min-h-screen border-e border-gray-200">
      {title && (
        <div className="h-16 flex justify-center items-center px-6 border-b border-gray-200 shrink-0">
          {typeof title === "string" ? (
            <span className="font-bold text-brand-accent">{title}</span>
          ) : (
            title
          )}
        </div>
      )}
      
      {topContent && <div className="px-6 pt-4">{topContent}</div>}

      <nav className="p-4 space-y-1 flex-1">
        {navigation.map((item) => {
          const isActive = isItemActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-x-3 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                isActive ? activeClass : inactiveClass
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 flex flex-col gap-4 justify-center items-center border-t border-gray-200 shrink-0">
        <form action={logoutAction} className="w-full">
          <Button
            type="submit"
            variant="outline"
            className="w-full text-red-600 border-red-200 hover:text-red-700 hover:bg-red-50"
            onClick={() => setSidebarOpen(false)}
          >
            تسجيل خروج
          </Button>
        </form>

        <Logo className="rounded-lg" />
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="relative z-50 lg:hidden" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-gray-900/80 transition-opacity"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          ></div>

          {/* Drawer container: pointer-events-none to let clicks pass through to backdrop */}
          <div className="fixed inset-0 flex pointer-events-none">
            {/* Drawer: pointer-events-auto to catch clicks on the drawer itself */}
            <div className="relative me-16 flex w-full max-w-xs flex-1 pointer-events-auto">
              <div className="absolute start-full top-0 flex w-16 justify-center pt-5">
                <button
                  type="button"
                  className="-m-2.5 rounded-md p-2.5 text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  onClick={() => setSidebarOpen(false)}
                >
                  <span className="sr-only">إغلاق القائمة</span>
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
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
              <SidebarContent />
            </div>
          </div>
        </div>
      )}

      {/* Static sidebar for desktop */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col lg:start-0">
        <SidebarContent />
      </div>
    </>
  );
}
