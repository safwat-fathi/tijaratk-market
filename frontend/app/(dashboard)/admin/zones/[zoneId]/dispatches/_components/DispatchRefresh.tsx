"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export const DispatchRefresh = () => {
  const router = useRouter();

  useEffect(() => {
    const intervalId = window.setInterval(() => router.refresh(), 12_000);
    return () => window.clearInterval(intervalId);
  }, [router]);

  return <span className="text-xs text-gray-500">تحديث تلقائي كل 12 ثانية</span>;
};
