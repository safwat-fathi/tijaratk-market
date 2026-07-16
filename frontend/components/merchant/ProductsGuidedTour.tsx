"use client";

import { useEffect, useState } from "react";
import { Joyride, type EventData, STATUS, type Step } from "react-joyride";

const PRODUCTS_TOUR_COMPLETED_KEY = "tijaratk_merchant_products_tour_completed";

export function ProductsGuidedTour() {
  const [run, setRun] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);

  useEffect(() => {
    setIsClient(true);
    const hasCompletedTour = localStorage.getItem(PRODUCTS_TOUR_COMPLETED_KEY);
    if (!hasCompletedTour) {
      const isMobile = window.matchMedia("(max-width: 1023px)").matches;

      const tourSteps: Step[] = [
        {
          target: "body",
          placement: "center",
          title: "إدارة المنتجات",
          content:
            "هنا يمكنك إضافة منتجاتك الجديدة إما برفع ملف، أو اختيارها من الكتالوج الجاهز، أو إضافتها يدوياً خطوة بخطوة.",
          skipBeacon: true,
        },
        {
          target: 'a[href="/api/merchant/products/import-template"]',
          title: "قالب الاستيراد",
          content:
            "يمكنك تحميل قالب CSV لملء بيانات منتجاتك ثم رفعها دفعة واحدة لتوفير الوقت.",
        },
        {
          target: "#csv-upload-form",
          title: "رفع المنتجات دفعة واحدة",
          content:
            "بعد تجهيز ملف الـ CSV، قم برفعه هنا لإضافة كل المنتجات أو تحديث أسعارها بسرعة وسهولة.",
        },
        {
          target: "#tour-product-readiness",
          title: "مؤشر إكتمال المنتجات",
          content:
            "هذا المؤشر يوضح لك عدد المنتجات المطلوبة. متجرك لن يظهر للعملاء ولن يستقبل طلبات إلا بعد وصولك للعدد المطلوب، لذلك احرص على إضافة منتجاتك حتى يكتمل المؤشر.",
        },
        {
          target: "#add-core-assortment-btn",
          title: "التشكيلة الأساسية",
          content:
            "بضغطة واحدة، يمكنك إضافة تشكيلة المنتجات الأساسية والأكثر مبيعاً لمتجرك لتبدأ البيع فوراً.",
        },
        {
          target: "#section-tab-catalog",
          title: "الكتالوج الجاهز",
          content:
            "هذا هو الكتالوج الموحد. يحتوي على آلاف المنتجات الجاهزة بصورها وتفاصيلها لتضيفها لمتجرك بسهولة.",
          placement: "bottom",
        },
        {
          target: ".tour-hide-item-btn",
          title: "إخفاء المنتجات",
          content:
            "إذا كان هناك منتج في الكتالوج لا تبيعه ولا تريده أن يظهر لك مرة أخرى، يمكنك إخفاؤه بالضغط هنا.",
        },
        {
          target: "#tour-show-hidden-btn",
          title: "المنتجات المخفية",
          content:
            "في أي وقت، يمكنك الضغط هنا لاستعراض جميع المنتجات التي قمت بإخفائها لإعادتها للكتالوج إذا أردت.",
          placement: "bottom",
        },
      ];

      setSteps(tourSteps);
      setRun(true);
    }
  }, []);

  const handleJoyrideCallback = (data: EventData) => {
    const { status, type, action, index } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    // Auto-click the catalog tab to show elements for subsequent steps
    if (type === "step:after" && action === "next") {
      const catalogStepIndex = 5;
      
      if (index === catalogStepIndex) {
        document.getElementById("section-tab-catalog")?.click();
      }
    }

    if (finishedStatuses.includes(status)) {
      setRun(false);
      localStorage.setItem(PRODUCTS_TOUR_COMPLETED_KEY, "true");
    }
  };

  if (!isClient || steps.length === 0) return null;

  return (
      <Joyride
        onEvent={handleJoyrideCallback}
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
        skip: "تخطي الجولة",
      }}
      options={{
        arrowColor: "#fff",
        backgroundColor: "#fff",
        primaryColor: "#059669", // emerald-600
        textColor: "#1f2937", // gray-800
        overlayColor: "rgba(0, 0, 0, 0.6)",
        zIndex: 10000,
        showProgress: true,
        buttons: ["back", "skip", "primary"],
      }}
      styles={{
        tooltipContainer: {
          textAlign: "right",
          direction: "rtl",
          fontFamily: "inherit",
        },
        buttonPrimary: {
          backgroundColor: "#059669",
          color: "#fff",
          padding: "8px 16px",
          borderRadius: "8px",
          fontWeight: 600,
        },
        buttonBack: {
          color: "#4b5563",
          marginRight: 10,
        },
        buttonSkip: {
          color: "#6b7280",
        },
      }}
    />
  );
}
