/**
 * Mirrors `OrderSuccessView`'s fixed centred overlay.
 *
 * Without this the parent `[slug]/loading.tsx` applies, and the customer sees a
 * product-list skeleton flash before the confirmation screen.
 */
export default function OrderSuccessLoading() {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-start overflow-y-auto bg-white p-6 py-10 text-center sm:justify-center"
      aria-busy="true"
      aria-label="جارٍ تأكيد الطلب"
    >
      {/* Success badge */}
      <div className="mb-4 h-20 w-20 shrink-0 animate-pulse rounded-full bg-status-success/15" />

      {/* Heading */}
      <div className="mb-3 h-9 w-56 animate-pulse rounded-lg bg-brand-soft" />

      {/* Two-line description */}
      <div className="mb-1 h-4 w-64 animate-pulse rounded bg-brand-soft/70" />
      <div className="mb-5 h-4 w-72 max-w-full animate-pulse rounded bg-brand-soft/70" />

      {/* Liability notice */}
      <div className="mb-4 h-16 w-full max-w-sm animate-pulse rounded-lg border border-brand-border bg-brand-soft/30" />

      {/* Customer access code */}
      <div className="mb-4 h-28 w-full max-w-sm animate-pulse rounded-lg border border-brand-border bg-brand-soft/50" />

      {/* Tracking link */}
      <div className="mb-6 h-20 w-full max-w-sm animate-pulse rounded-lg border border-brand-border bg-brand-soft/50" />

      {/* Actions */}
      <div className="flex w-full max-w-xs flex-col gap-3">
        <div className="h-14 animate-pulse rounded-md bg-brand-primary/25" />
        <div className="h-14 animate-pulse rounded-md border border-brand-border bg-white" />
        <div className="h-12 animate-pulse rounded-md bg-brand-soft/40" />
      </div>
    </div>
  );
}
