import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-50 w-full bg-white shadow-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <Logo
            variant="icon"
            width={32}
            height={32}
            className="rounded-md"
          />
          <span className="text-xl font-bold text-[#0F5A3D]">تجارتك</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href="/merchant/login"
            className="text-sm font-semibold text-[#0F5A3D] transition-colors hover:text-[#27AE60]"
          >
            تسجيل الدخول
          </Link>
          <Link
            href="/merchant/register"
            className="inline-flex h-10 items-center justify-center rounded-full bg-[#0F5A3D] px-5 text-sm font-bold text-white transition-colors hover:bg-[#00412a]"
          >
            قدّم طلب انضمام
          </Link>
        </div>
      </div>
    </header>
  );
}
