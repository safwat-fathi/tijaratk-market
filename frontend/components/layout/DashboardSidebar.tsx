import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/ui/Logo";
import { PushAwareLogoutForm } from "@/components/pwa/PushAwareLogoutForm";
import { formatArabicInteger } from "@/lib/utils/number";
import type { PushScope } from "@/types/services/push-notifications";

export interface NavItem {
  label: string;
  href: string;
  icon?: React.ReactNode;
  badgeCount?: number;
  activePrefixes?: string[];
  children?: Omit<NavItem, "icon" | "children">[];
}

export interface DashboardSidebarProps {
  title?: React.ReactNode;
  navigation: NavItem[];
  logoutAction: (formData: FormData) => void | Promise<void>;
  pushScope: PushScope;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  topContent?: React.ReactNode; // Extra content at the top (e.g. Install PWA)
  mobileTopContent?: React.ReactNode;
  footerContent?: React.ReactNode;
  basePath?: string; // e.g. '/admin' or '/merchant' for active state logic
  activeClass?: string;
  inactiveClass?: string;
}

function NavGroup({
  item,
  isItemActive,
  setSidebarOpen,
  activeClass,
  inactiveClass,
}: {
  item: NavItem;
  isItemActive: (href: string) => boolean;
  setSidebarOpen: (open: boolean) => void;
  activeClass: string;
  inactiveClass: string;
}) {
  const hasActiveChild =
    item.children?.some((child) => isItemActive(child.href)) ?? false;
  const [isOpen, setIsOpen] = useState(hasActiveChild);

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex w-full items-center justify-between gap-x-3 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
          hasActiveChild ? activeClass : inactiveClass
        }`}
      >
        <div className="flex items-center gap-x-3">
          {item.icon}
          {item.label}
          {item.badgeCount !== undefined && item.badgeCount > 0 ? (
            <span className="rounded-full bg-brand-primary px-2 py-0.5 text-xs font-bold text-white">
              {formatArabicInteger(item.badgeCount) || item.badgeCount}
            </span>
          ) : null}
        </div>
        <svg
          className={`h-4 w-4 shrink-0 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth="2.5"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m19.5 8.25-7.5 7.5-7.5-7.5"
          />
        </svg>
      </button>

      {isOpen && item.children && (
        <div className="mt-1 space-y-1 ps-8">
          {item.children.map((child) => {
            const isChildActive = isItemActive(child.href);
            return (
              <Link
                key={child.href}
                href={child.href}
                onClick={() => setSidebarOpen(false)}
                className={`block px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  isChildActive ? activeClass : inactiveClass
                }`}
              >
                {child.label}
                {child.badgeCount !== undefined && child.badgeCount > 0 ? (
                  <span className="ms-2 rounded-full bg-brand-primary px-2 py-0.5 text-xs font-bold text-white">
                    {formatArabicInteger(child.badgeCount) || child.badgeCount}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

type SidebarContentProps = Pick<
  DashboardSidebarProps,
  | "title"
  | "navigation"
  | "logoutAction"
  | "pushScope"
  | "setSidebarOpen"
  | "topContent"
  | "mobileTopContent"
  | "footerContent"
> & {
  mobile?: boolean;
  isItemActive: (href: string) => boolean;
  activeClass: string;
  inactiveClass: string;
};

function SidebarContent({
  title,
  navigation,
  logoutAction,
  pushScope,
  setSidebarOpen,
  topContent,
  mobileTopContent,
  footerContent,
  mobile = false,
  isItemActive,
  activeClass,
  inactiveClass,
}: SidebarContentProps) {
  const resolvedTopContent = mobile
    ? mobileTopContent ?? topContent
    : topContent;

  return (
    <div className="flex min-h-screen grow flex-col overflow-y-auto border-e border-gray-200 bg-white">
      {title && (
        <div className="flex h-16 shrink-0 items-center justify-center border-b border-gray-200 px-6">
          {typeof title === "string" ? (
            <span className="font-bold text-brand-accent">{title}</span>
          ) : (
            title
          )}
        </div>
      )}

      {resolvedTopContent ? (
        <div className="px-6 pt-4">{resolvedTopContent}</div>
      ) : null}

      <nav className="flex-1 space-y-1 p-4">
        {navigation.map((item) => {
          if (item.children) {
            return (
              <NavGroup
                key={item.label}
                item={item}
                isItemActive={isItemActive}
                setSidebarOpen={setSidebarOpen}
                activeClass={activeClass}
                inactiveClass={inactiveClass}
              />
            );
          }

          const isActive = isItemActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-x-3 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                isActive ? activeClass : inactiveClass
              }`}
            >
              {item.icon}
              {item.label}
              {item.badgeCount !== undefined && item.badgeCount > 0 ? (
                <span className="ms-auto rounded-full bg-brand-primary px-2 py-0.5 text-xs font-bold text-white">
                  {formatArabicInteger(item.badgeCount) || item.badgeCount}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="flex shrink-0 flex-col items-center justify-center gap-4 border-t border-gray-200 p-4">
        {footerContent ? <div className="w-full">{footerContent}</div> : null}
        <div className="w-full">
          <PushAwareLogoutForm scope={pushScope} logoutAction={logoutAction} />
        </div>
        <Logo className="rounded-lg" />
      </div>
    </div>
  );
}

export function DashboardSidebar({
  title,
  navigation,
  logoutAction,
  pushScope,
  sidebarOpen,
  setSidebarOpen,
  topContent,
  mobileTopContent,
  footerContent,
  basePath = "/",
  activeClass = "bg-red-50 text-red-700",
  inactiveClass = "text-gray-900 hover:bg-gray-50 hover:text-gray-900",
}: DashboardSidebarProps) {
  const pathname = usePathname();

  const activeHref = useMemo(
    () =>
      navigation
        .flatMap((item) =>
          item.children ? [item, ...item.children] : [item],
        )
        .filter((item) => item.href && item.href !== "#")
        .sort((a, b) => b.href.length - a.href.length)
        .find(
          (item) =>
            pathname === item.href ||
            pathname.startsWith(`${item.href}/`) ||
            item.activePrefixes?.some(
              (prefix) =>
                pathname === prefix || pathname.startsWith(`${prefix}/`),
            ),
        )?.href,
    [navigation, pathname],
  );

  const isItemActive = useCallback(
    (href: string) => {
      if (href === basePath) {
        return pathname === href || pathname === `${href}/`;
      }
      return href === activeHref;
    },
    [activeHref, basePath, pathname],
  );

  const sidebarContentProps = {
    title,
    navigation,
    logoutAction,
    pushScope,
    setSidebarOpen,
    topContent,
    mobileTopContent,
    footerContent,
    isItemActive,
    activeClass,
    inactiveClass,
  };

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
              <SidebarContent {...sidebarContentProps} mobile />
            </div>
          </div>
        </div>
      )}

      {/* Static sidebar for desktop */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col lg:start-0">
        <SidebarContent {...sidebarContentProps} />
      </div>
    </>
  );
}
