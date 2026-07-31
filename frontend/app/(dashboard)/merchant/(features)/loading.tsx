/** Streams the merchant shell immediately instead of blocking on the layout fetches. */
export default function MerchantFeaturesLoading() {
  return (
    <div className="space-y-4 p-4" aria-busy="true" aria-label="جارٍ التحميل">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-brand-soft" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="h-32 animate-pulse rounded-xl border border-brand-border bg-white"
          />
        ))}
      </div>
    </div>
  );
}
