"use client";

import dynamic from "next/dynamic";
import { CircleHelp } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { EventData, Step } from "react-joyride";
import { cn } from "@/lib/utils";
import { usePwaStandalone } from "@/lib/hooks/usePwaStandalone";

const Joyride = dynamic(
  () => import("react-joyride").then((module) => module.Joyride),
  { ssr: false },
);

const CUSTOMER_STOREFRONT_TOUR_COMPLETED_KEY =
  "tijaratk_customer_storefront_tour_v1_completed";
const FINISHED_TOUR_STATUSES = new Set<string>(["finished", "skipped"]);

const createTourSteps = (): Step[] => {
  const steps: Step[] = [
    {
      id: "welcome",
      target: "body",
      placement: "center",
      title: "أهلاً بك في المتجر",
      content:
        "جولة سريعة توضح لك التصفح والطلب والتوصيل، وكيف تحفظ المتجر وتتابع طلباتك بسهولة.",
      skipScroll: true,
    },
    {
      id: "install",
      target: "#customer-storefront-pwa-install",
      placement: "bottom",
      title: "احفظ المتجر على موبايلك",
      content:
        "بعد انتهاء الجولة اضغط هنا لتثبيت المتجر أو حفظه على الشاشة الرئيسية للوصول إليه بسرعة.",
    },
    {
      id: "tracking",
      target: '[data-customer-tour="tracking"]',
      placement: "bottom",
      title: "تابع كل طلباتك",
      content:
        "افتح صفحة طلباتي لمتابعة الطلبات المحفوظة على هذا الجهاز، أو ابحث بكود العميل ورقم الهاتف من أي جهاز.",
    },
    {
      id: "delivery-area",
      target: '[data-customer-tour="delivery-area"]',
      placement: "bottom",
      title: "اختر أقرب منطقة صحيحة",
      content:
        "حدد منطقتك الفعلية، أو أقرب منطقة مدعومة تمثل عنوانك، حتى تظهر رسوم التوصيل وإمكانية الخدمة بشكل صحيح.",
    },
    {
      id: "catalog",
      target: '[data-customer-tour="catalog"]',
      placement: "bottom",
      title: "ابحث واختر منتجاتك",
      content:
        "ابحث بالاسم أو افتح أحد الأقسام، ثم حدد الكمية أو الوزن أو المبلغ المناسب حسب طريقة بيع المنتج.",
    },
    {
      id: "payment",
      target: '[data-customer-tour="payment-methods"]',
      placement: "bottom",
      title: "طرق الدفع",
      content:
        "اضغط هنا قبل إرسال الطلب لمعرفة طرق الدفع التي وفرها المتجر.",
    },
    {
      id: "missing-product",
      target: '[data-customer-tour="missing-product"]',
      placement: "top",
      title: "اطلب توفير منتج",
      content:
        "لو المنتج غير موجود أو غير متاح، اكتب اسمه لإبلاغ التاجر أنك تحتاجه. هذا الطلب لا يضيف المنتج تلقائياً إلى سلتك الحالية.",
    },
    {
      id: "manual-order",
      target: '[data-customer-tour="manual-order"]',
      placement: "top",
      title: "ما هو الطلب اليدوي؟",
      content:
        "اكتب هنا أي طلب لم تجده في القائمة. سيتواصل معك المتجر لتأكيد التوفر والسعر قبل التنفيذ.",
    },
    {
      id: "prescription",
      target: '[data-customer-tour="prescription"]',
      placement: "top",
      title: "اطلب بالروشتة",
      content:
        "في الصيدليات يمكنك تصوير الروشتة أو رفعها، وتحديد ما تفضله إذا لم يتوفر أحد الأصناف.",
    },
    {
      id: "customer-code",
      target: '[data-customer-tour="customer-code"]',
      placement: "top",
      title: "ما هو كود العميل؟",
      content:
        "تحصل على الكود بعد إرسال طلب. استخدمه مع نفس رقم الهاتف لاسترجاع بياناتك وعناوينك ومتابعة طلباتك من أي جهاز.",
    },
    {
      id: "review",
      target: "body",
      placement: "center",
      title: "راجع الطلب ثم أرسله",
      content:
        "بعد إضافة منتج أو طلب يدوي أو روشتة سيظهر زر التأكيد. راجع طلبك وحدد هل تريد بديلاً، حذف المنتج، أو إلغاء الطلب إذا لم يتوفر صنف، ثم تابع الحالة من صفحة طلباتي.",
      skipScroll: true,
    },
  ];

  return steps.filter((step) => {
    if (step.target === "body") return true;
    return (
      typeof step.target === "string" &&
      Boolean(document.querySelector(step.target))
    );
  });
};

const hasCompletedTour = () => {
  try {
    return localStorage.getItem(CUSTOMER_STOREFRONT_TOUR_COMPLETED_KEY) === "true";
  } catch {
    return false;
  }
};

const persistTourCompletion = () => {
  try {
    localStorage.setItem(CUSTOMER_STOREFRONT_TOUR_COMPLETED_KEY, "true");
  } catch {
    // The tour remains usable when browser storage is unavailable.
  }
};

export default function CustomerStorefrontOnboarding({ buttonText }: { buttonText?: string } = {}) {
  const [steps, setSteps] = useState<Step[]>([]);
  const [run, setRun] = useState(false);
  const [shouldRenderTour, setShouldRenderTour] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const isStandalone = usePwaStandalone();

  const startTour = useCallback(() => {
    setPrefersReducedMotion(
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
    setSteps(createTourSteps());
    setShouldRenderTour(true);
    setRun(true);
  }, []);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      if (!hasCompletedTour()) {
        startTour();
      }
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [startTour]);

  const handleJoyrideEvent = useCallback((data: EventData) => {
    if (!FINISHED_TOUR_STATUSES.has(data.status)) return;

    persistTourCompletion();
    setRun(false);
    setShouldRenderTour(false);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={startTour}
        className={cn(
          "inline-flex min-h-11 cursor-pointer touch-manipulation items-center justify-center rounded-md border border-white/30 bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20 active:bg-white/25 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/30 shrink-0",
          buttonText
            ? isStandalone
              ? "gap-2 px-3 text-sm font-semibold"
              : "p-2.5 text-sm font-semibold sm:gap-2 sm:px-3"
            : "w-11",
        )}
        aria-label="إعادة الجولة التعريفية للمتجر"
        title="مساعدة وجولة تعريفية"
      >
        <CircleHelp className="h-5 w-5 shrink-0" aria-hidden="true" />
        {buttonText && (
          <span className={isStandalone ? undefined : "sr-only sm:not-sr-only"}>
            {buttonText}
          </span>
        )}
      </button>

      {shouldRenderTour && steps.length > 0 ? (
        <Joyride
          onEvent={handleJoyrideEvent}
          continuous
          run={run}
          scrollToFirstStep
          steps={steps}
          locale={{
            back: "السابق",
            close: "إغلاق",
            last: "إنهاء الجولة",
            next: "التالي",
            nextWithProgress: "التالي ({current} من {total})",
            open: "فتح الإرشاد",
            skip: "تخطي الجولة",
          }}
          options={{
            arrowColor: "#ffffff",
            backgroundColor: "#ffffff",
            blockTargetInteraction: true,
            buttons: ["back", "primary"],
            overlayClickAction: false,
            overlayColor: "rgba(0, 0, 0, 0.62)",
            primaryColor: "#0F5A3D",
            scrollDuration: prefersReducedMotion ? 0 : 280,
            scrollOffset: 88,
            showProgress: true,
            skipBeacon: true,
            spotlightPadding: 8,
            spotlightRadius: 12,
            targetWaitTimeout: 800,
            textColor: "#222B2E",
            width: "min(360px, calc(100vw - 24px))",
            zIndex: 10000,
          }}
          styles={{
            tooltip: {
              borderRadius: "12px",
              padding: "16px",
            },
            tooltipContainer: {
              direction: "rtl",
              fontFamily: "inherit",
              textAlign: "right",
            },
            tooltipContent: {
              fontSize: "16px",
              lineHeight: 1.7,
              padding: "12px 0",
            },
            tooltipFooter: {
              gap: "8px",
            },
            buttonPrimary: {
              backgroundColor: "#0F5A3D",
              borderRadius: "8px",
              fontWeight: 700,
              minHeight: "44px",
              padding: "8px 16px",
              touchAction: "manipulation",
            },
            buttonBack: {
              color: "#222B2E",
              minHeight: "44px",
              padding: "8px 12px",
              touchAction: "manipulation",
            },
            buttonSkip: {
              color: "#4B5B55",
              minHeight: "44px",
              padding: "8px 12px",
              touchAction: "manipulation",
            },
          }}
        />
      ) : null}
    </>
  );
}
