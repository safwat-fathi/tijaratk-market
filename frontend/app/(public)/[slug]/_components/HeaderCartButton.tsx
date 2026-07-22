"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { useEffect, useState } from "react";

export const STOREFRONT_CART_CHANGED_EVENT = "storefront-cart-changed";

type HeaderCartButtonProps = {
  tenantSlug: string;
  initialCount: number;
};

/** Keeps the header cart badge in sync with client-side catalog edits. */
export default function HeaderCartButton({
  tenantSlug,
  initialCount,
}: HeaderCartButtonProps) {
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    const updateCount = (event: Event) => {
      const nextCount = Number((event as CustomEvent<number>).detail);
      if (Number.isFinite(nextCount)) setCount(Math.max(0, nextCount));
    };
    window.addEventListener(STOREFRONT_CART_CHANGED_EVENT, updateCount);
    return () =>
      window.removeEventListener(STOREFRONT_CART_CHANGED_EVENT, updateCount);
  }, []);

  return (
    <Link
      href={`/${encodeURIComponent(tenantSlug)}/cart`}
      className="relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-white/30 bg-white/10 p-2.5 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/30"
      aria-label={`عرض الطلب${count > 0 ? `، ${count} منتجات` : ""}`}
    >
      <ShoppingCart className="h-5 w-5" aria-hidden="true" />
      {count > 0 ? (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[10px] font-black leading-none text-brand-primary shadow-sm">
          {count}
        </span>
      ) : null}
    </Link>
  );
}
