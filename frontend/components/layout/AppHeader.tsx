import Link from "next/link";
import { ClipboardList } from "lucide-react";
import type { ReactNode } from "react";
import SafeImage from "@/components/ui/SafeImage";

type AppHeaderProps = {
  title: string;
  subtitle?: string;
  innerClassName?: string;
  headerClassName?: string;
  actions?: ReactNode;
  "data-store-header"?: boolean;
};

export function AppHeader({
  title,
  subtitle,
  actions,
  innerClassName = "px-4 py-3 flex items-center justify-between",
  headerClassName = "sticky top-0 z-50 rounded-b-xl border-b border-white/10 bg-brand-primary text-white shadow-soft backdrop-blur-md transition-[background-color,box-shadow] duration-200",
  ...props
}: AppHeaderProps) {
  return (
    <div
      className={headerClassName}
      {...(props["data-store-header"] ? { "data-store-header": true } : {})}
    >
      <div className={innerClassName}>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="shrink-0 rounded-md border border-white/10 bg-white p-1 shadow-inner backdrop-blur-sm">
            <SafeImage
              src="/tijaratk-logo-suite/app-icon-green.png"
              alt={title}
              width={40}
              height={40}
              className="rounded-lg object-contain"
              sizes="40px"
              loading="eager"
              fallback={<div className="h-10 w-10 rounded-lg bg-white/20" />}
            />
          </div>
          <div className="flex flex-col min-w-0">
            <h1 className="line-clamp-1 text-lg font-bold leading-tight tracking-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="text-xs text-white/80">{subtitle}</p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {actions}
          <Link
            href="/track-orders"
            data-customer-tour="tracking"
            className="inline-flex min-h-11 min-w-11 touch-manipulation items-center justify-center rounded-md border border-white/30 bg-white/10 p-2.5 text-white backdrop-blur transition-colors hover:bg-white/20 active:bg-white/25 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/30 sm:gap-2 sm:px-3"
            aria-label="تتبع طلباتي"
          >
            <ClipboardList className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">تتبع طلباتي</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
