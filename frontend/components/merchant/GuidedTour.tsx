"use client";

import { useEffect, useState } from "react";
import { Joyride, type EventData, STATUS, type Step } from "react-joyride";

const TOUR_COMPLETED_KEY = "tijaratk_merchant_tour_completed";

export function GuidedTour() {
  const [run, setRun] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);

  useEffect(() => {
    setIsClient(true);
    const hasCompletedTour = localStorage.getItem(TOUR_COMPLETED_KEY);
    if (!hasCompletedTour) {
      // Determine steps based on screen size to support mobile-first properly
      const isMobile = window.matchMedia("(max-width: 1023px)").matches;

      const desktopSteps: Step[] = [
        {
          target: "body",
          placement: "center",
          title: "أهلاً بك في لوحة تحكم التاجر!",
          content:
            "هذه جولة سريعة لتعريفك بأهم أقسام لوحة التحكم لتتمكن من إدارة متجرك بسهولة وفعالية.",
          skipBeacon: true,
        },
        {
          target: '.hidden.lg\\:fixed a[href="/merchant"]',
          title: "نظرة عامة",
          content:
            "هنا يمكنك متابعة أداء متجرك، ومراجعة الإحصائيات السريعة مثل عدد الطلبات المنجزة والمبيعات.",
        },
        {
          target: '.hidden.lg\\:fixed a[href="/merchant/products/new"]',
          title: "إدارة المنتجات",
          content:
            "من هذا القسم، يمكنك إضافة منتجات جديدة وتعديل تفاصيلها وأسعارها ومخزونها بكل سهولة.",
        },
        {
          target: '.hidden.lg\\:fixed a[href="/merchant/orders"]',
          title: "إدارة الطلبات",
          content:
            "تابع طلبات عملائك الواردة، وقم بتحديث حالاتها من قيد الانتظار إلى قيد التوصيل أو مكتملة.",
        },
        {
          target: '.hidden.lg\\:fixed a[href="/merchant/settings"]',
          title: "الإعدادات",
          content:
            "قم بضبط إعدادات متجرك، وتحديث بياناتك الشخصية ومعلومات المتجر وطرق الدفع والتوصيل.",
        },
      ];

      const mobileSteps: Step[] = [
        {
          target: "body",
          placement: "center",
          title: "أهلاً بك في لوحة تحكم التاجر!",
          content:
            "هذه جولة سريعة لتعريفك بأهم أقسام لوحة التحكم. اضغط على التالي للبدء.",
          skipBeacon: true,
        },
        {
          target: "#mobile-menu-trigger",
          title: "القائمة الرئيسية",
          content:
            "اضغط هنا في أي وقت لفتح القائمة الجانبية والوصول إلى المنتجات، الطلبات والإعدادات.",
          placement: "bottom",
        },
      ];

      setSteps(isMobile ? mobileSteps : desktopSteps);
      setRun(true);
    }
  }, []);

  const handleJoyrideCallback = (data: EventData) => {
    const { status } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status)) {
      setRun(false);
      localStorage.setItem(TOUR_COMPLETED_KEY, "true");
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
