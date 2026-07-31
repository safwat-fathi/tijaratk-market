/** Streams the admin shell immediately instead of blocking on the layout fetches. */
export default function AdminLoading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="جارٍ التحميل">
      <div className="h-8 w-56 animate-pulse rounded-lg bg-gray-200" />
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            className="h-14 animate-pulse rounded-lg border border-gray-200 bg-white"
          />
        ))}
      </div>
    </div>
  );
}
