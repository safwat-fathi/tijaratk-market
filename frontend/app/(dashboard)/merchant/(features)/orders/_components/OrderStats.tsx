"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useBodyScrollLock } from "@/lib/hooks/useBodyScrollLock";
import { useDragToClose } from "@/lib/hooks/useDragToClose";
import { formatArabicInteger } from "@/lib/utils/number";

interface OrderStatsProps {
  count: number;
  selectedDate?: string;
  selectedTab?: string;
  dateFilterEnabled?: boolean;
}

export default function OrderStats({
  count,
  selectedDate,
  selectedTab,
  dateFilterEnabled = true,
}: OrderStatsProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const dateInputRef = useRef<HTMLInputElement>(null);
  useBodyScrollLock(isOpen);
  const sheetRef = useDragToClose<HTMLDivElement>({
    onClose: () => setIsOpen(false),
    dragThreshold: 80,
    isOpen,
  });

  // Helper to format label
  const getLabel = () => {
    if (!selectedDate) return "اليوم";

    const date = new Date(selectedDate);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return "اليوم";
    if (date.toDateString() === yesterday.toDateString()) return "أمس";

    return date.toLocaleDateString("ar-EG", { month: "short", day: "numeric" });
  };

  const buildOrdersUrl = (date?: string) => {
    const query = new URLSearchParams();
    if (date) query.set("date", date);
    if (selectedTab && selectedTab !== "draft") query.set("tab", selectedTab);
    const queryString = query.toString();
    return `/merchant/orders${queryString ? `?${queryString}` : ""}`;
  };

  const handleSelect = (option: "today" | "yesterday" | "older") => {
    if (option === "today") {
      router.push(buildOrdersUrl());
      setIsOpen(false);
    } else if (option === "yesterday") {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const yStr = y.toISOString().split("T")[0];
      router.push(buildOrdersUrl(yStr));
      setIsOpen(false);
    } else if (option === "older") {
      // Trigger native picker
      dateInputRef.current?.showPicker();
      // Don't close yet, wait for change
    }
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val) {
      router.push(buildOrdersUrl(val));
      setIsOpen(false);
    }
  };

  return (
    <>
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-brand-border bg-white px-4 py-3 shadow-soft">
        <h1 className="text-xl font-bold text-brand-text">الطلبات</h1>

        {dateFilterEnabled ? (
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="flex min-h-10 items-center gap-1 rounded-full bg-brand-soft px-3 py-1 text-sm font-medium text-muted-foreground transition-colors active:bg-brand-soft/80 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/20"
          >
            <span>{getLabel()}</span>
            <span className="text-brand-border">•</span>
            <span className="font-bold text-brand-text">
              {formatArabicInteger(count) || count} طلب
            </span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="ms-1 text-muted-foreground"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
        ) : (
          <div className="flex min-h-10 items-center gap-1 rounded-full bg-brand-soft px-3 py-1 text-sm font-medium text-muted-foreground">
            <span>كل الطلبات المسندة</span>
            <span className="text-brand-border">•</span>
            <span className="font-bold text-brand-text">
              {formatArabicInteger(count) || count} طلب
            </span>
          </div>
        )}
      </div>

      {/* Hidden Date Input */}
      {dateFilterEnabled ? (
        <input
          type="date"
          ref={dateInputRef}
          className="pointer-events-none absolute opacity-0"
          onChange={handleDateChange}
        />
      ) : null}

      {/* Bottom Sheet Backdrop */}
      {dateFilterEnabled && isOpen ? (
        <div
          className="fixed inset-0 z-50 animate-fade-in bg-black/40 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            ref={sheetRef}
            className="absolute bottom-0 left-0 right-0 animate-slide-up rounded-t-xl bg-white p-4 shadow-float transition-transform"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex justify-center">
              <div className="h-1 w-12 rounded-full bg-brand-border" />
            </div>

            <h3 className="mb-4 px-2 font-medium text-muted-foreground">
              طلبات
            </h3>

            <div className="space-y-1">
              <button
                type="button"
                onClick={() => handleSelect("today")}
                className="flex w-full items-center gap-3 rounded-md px-4 py-3 text-left hover:bg-brand-soft active:bg-brand-soft/80"
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    !selectedDate || getLabel() === "اليوم"
                      ? "bg-brand-primary"
                      : "border border-brand-border bg-transparent"
                  }`}
                />
                <span className="font-medium text-brand-text">اليوم</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelect("yesterday")}
                className="flex w-full items-center gap-3 rounded-md px-4 py-3 text-left hover:bg-brand-soft active:bg-brand-soft/80"
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    getLabel() === "أمس"
                      ? "bg-brand-primary"
                      : "border border-brand-border bg-transparent"
                  }`}
                />
                <span className="font-medium text-brand-text">أمس</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelect("older")}
                className="flex w-full items-center gap-3 rounded-md px-4 py-3 text-left hover:bg-brand-soft active:bg-brand-soft/80"
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    getLabel() !== "اليوم" && getLabel() !== "أمس"
                      ? "bg-brand-primary"
                      : "border border-brand-border bg-transparent"
                  }`}
                />
                <span className="font-medium text-brand-text">طلبات أقدم…</span>
              </button>
            </div>

            <div className="mt-4 border-t border-brand-border pt-4">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-full py-3 text-center font-medium text-muted-foreground"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
