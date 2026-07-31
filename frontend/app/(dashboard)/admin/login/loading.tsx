/**
 * The admin layout still awaits `cookies()` on the login route, so the segment
 * suspends briefly. Without this the parent admin skeleton flashes a list of
 * table rows behind a centred login card.
 */
export default function AdminLoginLoading() {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8"
      dir="rtl"
      aria-busy="true"
      aria-label="جارٍ التحميل"
    >
      <div className="w-full max-w-md space-y-8 rounded-xl border border-gray-100 bg-white p-8 shadow-sm">
        <div className="flex flex-col items-center gap-6">
          <div className="h-12 w-40 animate-pulse rounded bg-gray-100" />
          <div className="h-8 w-56 animate-pulse rounded-lg bg-gray-100" />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="space-y-2">
              <div className="h-3.5 w-24 animate-pulse rounded bg-gray-100" />
              <div className="h-11 animate-pulse rounded-md border border-gray-200 bg-white" />
            </div>
          ))}
        </div>
        <div className="h-11 animate-pulse rounded-md bg-gray-200" />
      </div>
    </div>
  );
}
