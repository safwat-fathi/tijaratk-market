/**
 * Storefront skeleton. Also inherited by `cart`, which renders the same
 * `max-w-md` + `StoreHeader` shell over a list of rows. `success` and
 * `checkout` have their own because their layouts differ.
 */
export default function StorefrontLoading() {
  return (
    <div
      className="mx-auto min-h-screen w-full max-w-md bg-background"
      aria-busy="true"
      aria-label="جارٍ تحميل المتجر"
    >
      {/* Matches StoreHeader: brand-primary with a rounded bottom edge */}
      <div className="h-[104px] rounded-b-xl bg-brand-primary/90" />

      {/* Category rail */}
      <div className="flex gap-2 overflow-hidden px-4 py-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="h-9 w-20 shrink-0 animate-pulse rounded-full bg-brand-soft"
          />
        ))}
      </div>

      {/* Product rows */}
      <div className="space-y-3 px-4 pb-6">
        {Array.from({ length: 7 }).map((_, index) => (
          <div
            key={index}
            className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3"
          >
            <div className="h-14 w-14 shrink-0 animate-pulse rounded-lg bg-gray-100" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-2/3 animate-pulse rounded bg-gray-100" />
              <div className="h-3 w-1/3 animate-pulse rounded bg-gray-100" />
            </div>
            <div className="h-9 w-20 shrink-0 animate-pulse rounded-md bg-brand-soft" />
          </div>
        ))}
      </div>
    </div>
  );
}
