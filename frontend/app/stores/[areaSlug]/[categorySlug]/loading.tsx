/** Directory skeleton matching the store-card grid. */
export default function StoresCategoryLoading() {
  return (
    <div
      className="mx-auto w-full max-w-5xl px-4 py-8"
      aria-busy="true"
      aria-label="جارٍ تحميل المتاجر"
    >
      <div className="h-10 w-64 animate-pulse rounded-lg bg-gray-200" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="h-36 animate-pulse rounded-2xl bg-gray-200"
          />
        ))}
      </div>
    </div>
  );
}
