import Image from "next/image";

export function PublicFooter() {
  return (
    <footer className="bg-white py-12 border-t border-gray-100">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 sm:flex-row sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          {/* <Logo
            variant="icon"
            width={24}
            height={24}
            className="rounded-md opacity-80"
          />
          <span className="text-lg font-bold text-[#0F5A3D]">تجارتك</span> */}
          <Image
            alt="تجارتك أسهل. تجارتك أونلاين. "
            src="/tijaratk-logo-suite/horizontal-logo-dark.png"
            width={1774}
            height={887}
            className="w-32 sm:w-36 h-auto rounded-2xl"
            sizes="(max-width: 640px) 128px, 144px"
            loading="lazy"
          />
        </div>
        <p className="text-sm font-medium text-[#222B2E]/60">
          © {new Date().getFullYear()} جميع الحقوق محفوظة لـ{" "}
          <span className="text-[#0F5A3D] font-bold">تجارتك</span>.
        </p>
        <div className="flex items-center gap-4 text-[#222B2E]/60">
          <a
            href="https://www.facebook.com/profile.php?id=61589320905109"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#0F5A3D] transition-colors"
          >
            <span className="sr-only">فيسبوك</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
            </svg>
          </a>
          <a
            href="https://wa.me/201037007345"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#0F5A3D] transition-colors"
          >
            <span className="sr-only">واتساب</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
              <path d="M3 21l1.65 -3.8a9 9 0 1 1 3.4 2.9l-5.05 .9"></path>
              <path d="M9 10a.5 .5 0 0 0 1 0v-1a.5 .5 0 0 0 -1 0v1a5 5 0 0 0 5 5h1a.5 .5 0 0 0 0 -1h-1a.5 .5 0 0 0 0 1"></path>
            </svg>
          </a>
        </div>
      </div>
    </footer>
  );
}
