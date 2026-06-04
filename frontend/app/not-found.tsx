import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-center">
      <h1 className="mb-4 text-4xl font-bold text-brand-text">
        404 - المورد غير موجود
      </h1>
      <p className="mb-6 text-muted-foreground">
        عذراً، المورد أو الصفحة التي تبحث عنها غير موجود.
      </p>
      <Link
        href="/"
        className="inline-flex min-h-11 items-center justify-center rounded-md bg-brand-primary px-5 py-3 text-sm font-bold text-white shadow-soft transition-colors hover:bg-brand-primary-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/20"
      >
        العودة للصفحة الرئيسية
      </Link>
    </div>
  );
}
