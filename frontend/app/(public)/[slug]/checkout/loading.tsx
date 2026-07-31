/**
 * Checkout is a form, not a catalogue — the inherited storefront skeleton would
 * show product rows where input fields are about to appear.
 */
export default function CheckoutLoading() {
  return (
    <div
      className="mx-auto min-h-screen w-full max-w-md bg-background"
      aria-busy="true"
      aria-label="جارٍ تحميل صفحة إتمام الطلب"
    >
      <div className="h-[104px] rounded-b-xl bg-brand-primary/90" />

      <div className="space-y-5 px-4 py-5">
        {/* Field groups */}
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="space-y-2">
            <div className="h-3.5 w-24 animate-pulse rounded bg-gray-100" />
            <div className="h-12 animate-pulse rounded-lg border border-gray-200 bg-white" />
          </div>
        ))}

        {/* Order summary */}
        <div className="h-32 animate-pulse rounded-lg border border-brand-border bg-brand-soft/40" />

        {/* Submit bar */}
        <div className="h-14 animate-pulse rounded-md bg-brand-primary/25" />
      </div>
    </div>
  );
}
