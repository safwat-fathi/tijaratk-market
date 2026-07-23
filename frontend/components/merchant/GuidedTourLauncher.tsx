"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { runAfterLoadAndIdle } from "@/lib/browser/run-after-load-and-idle";

const TOUR_COMPLETED_KEY = "tijaratk_merchant_tour_completed";

const GuidedTour = dynamic(
  () =>
    import("@/components/merchant/GuidedTour").then(
      (module) => module.GuidedTour,
    ),
  { ssr: false },
);

export function GuidedTourLauncher() {
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(
    () =>
      runAfterLoadAndIdle(() => {
        if (!localStorage.getItem(TOUR_COMPLETED_KEY)) {
          setShouldLoad(true);
        }
      }),
    [],
  );

  return shouldLoad ? <GuidedTour /> : null;
}
