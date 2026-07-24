"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Download,
  PlusSquare,
  Smartphone,
  CheckCircle,
  Search,
  MoreVertical,
  Compass,
  Share,
} from "lucide-react";
import { usePwaStandalone } from "@/hooks/usePwaStandalone";
import { Logo } from "@/components/ui/Logo";

type BrowserFamily = "ios" | "android" | "desktop" | "unknown";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const isBeforeInstallPromptEvent = (
  event: Event,
): event is BeforeInstallPromptEvent =>
  "prompt" in event && "userChoice" in event;

const getBrowserFamily = (): BrowserFamily => {
  if (typeof window === "undefined") return "unknown";
  const userAgent = navigator.userAgent;
  const isIOS =
    /iPad|iPhone|iPod/.test(userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  if (isIOS) return "ios";
  if (/Android/i.test(userAgent)) return "android";
  if (/Windows|Macintosh|Linux/i.test(userAgent)) return "desktop";
  return "unknown";
};

export default function InstallGuide() {
  const isStandalone = usePwaStandalone();
  const [browserFamily, setBrowserFamily] = useState<BrowserFamily>("unknown");
  const [mounted, setMounted] = useState(false);
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    setBrowserFamily(getBrowserFamily());
    setMounted(true);

    // Check if the event fired before this component mounted
    const globalEvent = (window as any).__installPromptEvent;
    if (globalEvent && isBeforeInstallPromptEvent(globalEvent)) {
      setInstallPrompt(globalEvent as BeforeInstallPromptEvent);
    }

    // If it's already running as an app, we consider it installed
    if (isStandalone) {
      setIsInstalled(true);
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setInstallPrompt(null);
      setIsInstalled(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [isStandalone]);

  const handleInstallClick = useCallback(async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setIsInstalled(true);
    }
    setInstallPrompt(null);
  }, [installPrompt]);

  if (!mounted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="animate-pulse opacity-50">
          <Logo variant="icon" width={64} height={64} className="rounded-2xl grayscale" />
        </div>
        <div className="w-32 h-4 bg-gray-100 rounded-full animate-pulse" />
      </div>
    );
  }

  if (isInstalled) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 animate-in fade-in zoom-in duration-500">
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-[#27AE60] blur-xl opacity-20 rounded-full animate-pulse"></div>
          <CheckCircle className="w-24 h-24 text-[#27AE60] relative z-10" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4 tracking-tight">
          تم التثبيت بنجاح!
        </h1>
        <p className="text-lg text-gray-600 mb-8 max-w-sm mx-auto">
          تطبيقنا الآن متاح على الشاشة الرئيسية لجهازك. يمكنك إغلاق هذه الصفحة
          وفتح التطبيق مباشرة.
        </p>
      </div>
    );
  }

  return (
    <div className="py-12 px-4 sm:px-6 max-w-md mx-auto" dir="rtl">
      <div className="text-center mb-10 flex flex-col items-center">
        <Logo
          variant="icon"
          width={80}
          height={80}
          className="mb-6 rounded-2xl shadow-sm"
        />
        <h1 className="text-2xl font-bold text-gray-900 mb-3">
          تثبيت تطبيق تجارتك
        </h1>
        <p className="text-gray-600 text-sm leading-relaxed mb-6">
          احصل على تجربة أسرع وأفضل عبر تثبيت التطبيق على جهازك للوصول المباشر.
        </p>
        
        <button
          onClick={() => {
            if (installPrompt) {
              handleInstallClick();
            } else {
              if (browserFamily === "ios") {
                alert("نظام iOS لا يدعم التثبيت المباشر. يرجى اتباع خطوات زر المشاركة بالأسفل.");
              } else {
                alert("متصفحك يمنع التثبيت المباشر حالياً (قد يتطلب اتصالاً آمناً). يرجى اتباع الخطوات اليدوية بالأسفل.");
              }
            }
          }}
          className="w-full max-w-xs inline-flex items-center justify-center gap-2 rounded-xl bg-[#0F5A3D] px-4 py-3.5 text-sm font-bold text-white shadow-md transition-all hover:bg-[#27AE60] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[#27AE60] focus:ring-offset-2 active:scale-[0.98]"
        >
          <Download className="w-5 h-5" />
          تثبيت الآن
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* iOS Instructions */}
        {browserFamily === "ios" && (
          <div className="p-6">
            <h3 className="font-semibold text-gray-900 mb-6 flex items-center gap-2">
              <Compass className="w-5 h-5 text-gray-400" />
              خطوات التثبيت للآيفون
            </h3>
            <ol className="space-y-6 relative">
              <div className="absolute top-2 bottom-2 right-[19px] w-0.5 bg-gray-100 z-0"></div>

              <li className="relative z-10 flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#F3F4F6] border-4 border-white flex items-center justify-center font-bold text-sm text-gray-500 shadow-sm">
                  1
                </div>
                <div className="pt-2">
                  <p className="text-sm font-medium text-gray-900 mb-2">
                    اضغط على زر المشاركة
                  </p>
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-200 text-xs text-gray-600">
                    <Share className="w-4 h-4 text-blue-500" /> في أسفل الشاشة
                  </div>
                </div>
              </li>

              <li className="relative z-10 flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#F3F4F6] border-4 border-white flex items-center justify-center font-bold text-sm text-gray-500 shadow-sm">
                  2
                </div>
                <div className="pt-2">
                  <p className="text-sm font-medium text-gray-900 mb-2">
                    اسحب للأسفل واختر
                  </p>
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-200 text-xs text-gray-600">
                    <PlusSquare className="w-4 h-4" /> إضافة للشاشة الرئيسية
                  </div>
                </div>
              </li>

              <li className="relative z-10 flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#F3F4F6] border-4 border-white flex items-center justify-center font-bold text-sm text-gray-500 shadow-sm">
                  3
                </div>
                <div className="pt-2">
                  <p className="text-sm font-medium text-gray-900 mb-2">
                    قم بالتأكيد
                  </p>
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-500 rounded-lg text-xs text-white font-medium">
                    إضافة (Add)
                  </div>
                </div>
              </li>
            </ol>
          </div>
        )}

        {/* Android Instructions */}
        {browserFamily === "android" && (
          <div className="p-6">
            <h3 className="font-semibold text-gray-900 mb-6 flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-gray-400" />
              خطوات التثبيت للأندرويد
            </h3>

            <p className="text-sm text-gray-600 mb-6 border-b border-gray-100 pb-4">
              إذا لم يعمل زر التثبيت المباشر بالأعلى، يرجى اتباع الخطوات التالية:
            </p>
            <ol className="space-y-6 relative">
              <div className="absolute top-2 bottom-2 right-[19px] w-0.5 bg-gray-100 z-0"></div>

                <li className="relative z-10 flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#F3F4F6] border-4 border-white flex items-center justify-center font-bold text-sm text-gray-500 shadow-sm">
                    1
                  </div>
                  <div className="pt-2">
                    <p className="text-sm font-medium text-gray-900 mb-2">
                      اضغط على القائمة
                    </p>
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-200 text-xs text-gray-600">
                      <MoreVertical className="w-4 h-4 text-gray-500" /> أعلى
                      الشاشة
                    </div>
                  </div>
                </li>

                <li className="relative z-10 flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#F3F4F6] border-4 border-white flex items-center justify-center font-bold text-sm text-gray-500 shadow-sm">
                    2
                  </div>
                  <div className="pt-2">
                    <p className="text-sm font-medium text-gray-900 mb-2">
                      اختر تثبيت التطبيق
                    </p>
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-200 text-xs text-gray-600">
                      <Download className="w-4 h-4" /> Install And Create
                      Shortcut
                    </div>
                  </div>
                </li>
              </ol>
          </div>
        )}

        {/* Desktop / Unknown Fallback */}
        {(browserFamily === "desktop" || browserFamily === "unknown") && (
          <div className="p-8 text-center bg-gray-50">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 text-gray-400 mb-4">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="font-medium text-gray-900 mb-2">
              افتح هذا الرابط من جوالك
            </h3>
            <p className="text-sm text-gray-500 leading-relaxed max-w-xs mx-auto">
              هذه الصفحة مخصصة للأجهزة المحمولة. يرجى زيارة نفس الرابط من متصفح
              سفاري على الآيفون أو كروم على الأندرويد للتمكن من التثبيت.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
