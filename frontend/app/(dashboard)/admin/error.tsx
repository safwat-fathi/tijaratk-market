"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * Keeps failures inside the content area so the admin shell and
 * navigation survive a failed page render.
 */
export default function SegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <h2 className="text-xl font-bold text-brand-text">تعذر تحميل هذه الصفحة</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        حدث خطأ غير متوقع أثناء تحميل البيانات. يمكنك المحاولة مرة أخرى دون
        إعادة تحميل الصفحة بالكامل.
      </p>
      {error.digest ? (
        <p className="font-mono text-xs text-gray-400">معرف الخطأ: {error.digest}</p>
      ) : null}
      <button
        type="button"
        onClick={() => reset()}
        className="rounded-lg bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white transition-all active:scale-[0.98]"
      >
        حاول مرة أخرى
      </button>
    </div>
  );
}
