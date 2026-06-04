import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * A container for horizontally scrollable tabs that bypasses flex gap layout bugs on mobile browsers.
 */
export function ScrollableTabList({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const isDragging = React.useRef(false);
  const startX = React.useRef(0);
  const scrollLeft = React.useRef(0);
  const dragged = React.useRef(false);

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.deltaY !== 0 && !e.shiftKey) {
      e.currentTarget.scrollLeft += e.deltaY;
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!scrollRef.current) return;
    isDragging.current = true;
    dragged.current = false;
    startX.current = e.pageX - scrollRef.current.offsetLeft;
    scrollLeft.current = scrollRef.current.scrollLeft;
  };

  const handleMouseLeave = () => {
    isDragging.current = false;
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging.current || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX.current) * 1.5;
    if (Math.abs(walk) > 5) {
      dragged.current = true;
    }
    scrollRef.current.scrollLeft = scrollLeft.current - walk;
  };

  const handleClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragged.current) {
      e.stopPropagation();
      e.preventDefault();
      dragged.current = false;
    }
  };

  return (
    <div
      ref={scrollRef}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseLeave={handleMouseLeave}
      onMouseUp={handleMouseUp}
      onMouseMove={handleMouseMove}
      onClickCapture={handleClickCapture}
      className={cn(
        "flex min-w-0 gap-2 overflow-x-auto py-2 no-scrollbar touch-pan-x select-none",
        className,
      )}
    >
      {children}
      {/* Spacer div to ensure there is a margin after the last pill in the scroll container */}
      <div className="w-px shrink-0" aria-hidden="true" />
    </div>
  );
}

export type TabButtonProps = {
  isActive?: boolean;
  variant?: "pill" | "card";
  href?: string;
  as?: React.ElementType;
  prefetch?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement> &
  React.AnchorHTMLAttributes<HTMLAnchorElement>;

/**
 * A flexible tab button that supports different visual variants and active states.
 * It passes through any extra props (like onClick) and classes to the underlying component.
 * Can act as a standard `<button>`, a Next.js `<Link>` (if `href` is provided), or any custom element (via `as`).
 */
export const TabButton = React.forwardRef<HTMLElement, TabButtonProps>(
  (
    {
      isActive = false,
      variant = "pill",
      href,
      as,
      className,
      children,
      ...props
    },
    ref,
  ) => {
    // Shared accessibility & focus ring styles
    const baseStyles =
      "relative shrink-0 transition-all duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/20 border";

    // Visual variants
    const variantStyles = {
      card: "h-14 rounded-lg px-3 py-1.5",
      pill: "min-h-11 rounded-full px-4 py-2 text-sm font-medium flex items-center gap-2 whitespace-nowrap",
    };

    // Default static colors (used mostly for 'card', as 'pill' usually passes dynamic classes via parent)
    const defaultStyles = {
      card: {
        active: "border-brand-primary bg-brand-soft text-brand-primary",
        inactive: "border-brand-border bg-white text-brand-text",
      },
      pill: {
        // Pill variant often relies on dynamic external active classes, but we provide sensible defaults here
        active: "border-current ring-1 ring-current",
        inactive:
          "bg-white text-brand-text border-brand-border hover:bg-brand-soft/60",
      },
    };

    const Component = as || (href ? Link : "button");
    const isButton = Component === "button";

    // Only pass href if we're not rendering a button
    const componentProps = isButton ? { type: "button" } : { href };

    return (
      <Component
        ref={ref as any}
        {...componentProps}
        className={cn(
          baseStyles,
          variantStyles[variant],
          isActive
            ? defaultStyles[variant].active
            : defaultStyles[variant].inactive,
          className, // Allows overriding active colors for dynamic badges like StatusTabs
        )}
        {...props}
      >
        {children}
      </Component>
    );
  },
);
TabButton.displayName = "TabButton";
