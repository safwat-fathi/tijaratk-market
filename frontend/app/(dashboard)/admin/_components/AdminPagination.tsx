import Link from "next/link";

type AdminPaginationProps = {
  basePath: string;
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  params?: Record<string, string | undefined>;
};

export function AdminPagination({
  basePath,
  page,
  totalPages,
  total,
  limit,
  params = {},
}: AdminPaginationProps) {
  const safeTotalPages = Math.max(1, totalPages);
  const hasPrevious = page > 1;
  const hasNext = page < safeTotalPages;
  const start = total === 0 ? 0 : (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  const hrefForPage = (nextPage: number) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) query.set(key, value);
    });
    query.set("page", String(nextPage));
    query.set("limit", String(limit));

    return `${basePath}?${query.toString()}`;
  };

  const controlClass =
    "inline-flex h-10 items-center rounded-md border border-brand-border px-4 text-sm font-medium transition-colors";
  const activeClass = "bg-white text-brand-text hover:bg-brand-soft";
  const disabledClass = "cursor-not-allowed bg-gray-50 text-gray-400";

  return (
    <div className="flex flex-col gap-3 border-t border-brand-border pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-gray-600">
        عرض {start} - {end} من {total}
      </p>
      <div className="flex items-center gap-2">
        {hasPrevious ? (
          <Link
            href={hrefForPage(page - 1)}
            className={`${controlClass} ${activeClass}`}
          >
            السابق
          </Link>
        ) : (
          <span className={`${controlClass} ${disabledClass}`}>السابق</span>
        )}
        <span className="min-w-24 text-center text-sm font-medium text-brand-text">
          {page} / {safeTotalPages}
        </span>
        {hasNext ? (
          <Link
            href={hrefForPage(page + 1)}
            className={`${controlClass} ${activeClass}`}
          >
            التالي
          </Link>
        ) : (
          <span className={`${controlClass} ${disabledClass}`}>التالي</span>
        )}
      </div>
    </div>
  );
}
