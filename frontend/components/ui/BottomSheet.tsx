"use client";

import type { ReactNode } from "react";
import { useEffect, useId, useRef } from "react";
import { useBodyScrollLock } from "@/lib/hooks/useBodyScrollLock";
import { useDragToClose } from "@/lib/hooks/useDragToClose";
import { cn } from "@/lib/utils";

type BottomSheetProps = {
  isOpen: boolean;
  title?: string;
  closeLabel?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  desktopDialog?: boolean;
};

export default function BottomSheet({
  isOpen,
  title,
  closeLabel = "إغلاق",
  onClose,
  children,
  footer,
  className,
  desktopDialog = false,
}: BottomSheetProps) {
  useBodyScrollLock(isOpen);
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const sheetRef = useDragToClose<HTMLDivElement>({
    onClose,
    dragThreshold: 80,
    isOpen,
  });

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    return () => cancelAnimationFrame(frame);
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={closeLabel}
        className="absolute inset-0 bg-black/45 backdrop-blur-[1px]"
      />

      <div
        className={cn(
          "absolute inset-x-0 bottom-0 flex justify-center",
          desktopDialog && "sm:inset-0 sm:items-center sm:p-6",
        )}
      >
        <div
          ref={sheetRef}
          className={cn(
            "flex max-h-[92dvh] w-full max-w-md animate-slide-up flex-col overflow-hidden rounded-t-xl bg-white shadow-float transition-transform duration-200 whitespace-normal",
            desktopDialog && "sm:max-w-2xl sm:rounded-xl",
            className,
          )}
        >
          <div className="shrink-0 border-b border-brand-border/70 px-4 pb-3 pt-3">
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-brand-border" />
            <div className="flex min-h-10 items-center justify-between gap-3">
              {title ? (
                <h2 id={titleId} className="text-lg font-bold text-brand-text">
                  {title}
                </h2>
              ) : (
                <span />
              )}
              <button
                ref={closeButtonRef}
                type="button"
                onClick={onClose}
                className="min-h-10 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-brand-soft hover:text-brand-text focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/20"
              >
                {closeLabel}
              </button>
            </div>
          </div>

          <div
            className={cn(
              "flex-1 overflow-y-auto overscroll-contain px-4 py-4 [-webkit-overflow-scrolling:touch]",
              !footer && "safe-bottom-padding"
            )}
          >
            {children}
          </div>

          {footer ? (
            <div
              className="safe-bottom-padding shrink-0 border-t border-brand-border/70 bg-white px-4 pt-3"
            >
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
