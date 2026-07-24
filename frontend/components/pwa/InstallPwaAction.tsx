"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, Download, ExternalLink, Share2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePwaStandalone } from "@/hooks/usePwaStandalone";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type BrowserFamily = "ios" | "android" | "desktop" | "unknown";

type InstallPwaActionProps = {
  appName: string;
  shareUrl?: string;
  className?: string;
  iconClassName?: string;
  buttonText?: string;
  label?: string;
  id?: string;
};

const isBeforeInstallPromptEvent = (
  event: Event,
): event is BeforeInstallPromptEvent =>
  "prompt" in event && "userChoice" in event;

const getBrowserFamily = (): BrowserFamily => {
  if (typeof window === "undefined") return "unknown";
  const userAgent =
    navigator.userAgent || navigator.vendor || (window as any).opera;

  if (/windows phone/i.test(userAgent)) return "android";
  if (/android/i.test(userAgent)) return "android";
  if (/iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream)
    return "ios";
  if (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
    return "ios";

  if (/Macintosh|Windows|Linux/i.test(userAgent)) return "desktop";
  return "unknown";
};

export default function InstallPwaAction({
  appName,
  shareUrl,
  className,
  iconClassName,
  buttonText,
  label = "حفظ على الشاشة الرئيسية",
  id,
}: InstallPwaActionProps) {
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const isStandalone = usePwaStandalone();
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [browserFamily, setBrowserFamily] = useState<BrowserFamily>("unknown");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setBrowserFamily(getBrowserFamily());
      setMounted(true);

      // Check if the event fired before this component mounted
      const globalEvent = (window as any).__installPromptEvent;
      if (globalEvent && isBeforeInstallPromptEvent(globalEvent)) {
        setInstallPrompt(globalEvent);
      }
    });

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      if (isBeforeInstallPromptEvent(event)) {
        setInstallPrompt(event);
      }
    };

    const handleAppInstalled = () => {
      setInstallPrompt(null);
      setIsOpen(false);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const instruction = useMemo(() => {
    if (installPrompt) {
      return "ثبّت التطبيق لسهولة الوصول إليه مباشرة من الشاشة الرئيسية.";
    }

    if (browserFamily === "ios") {
      return "للتثبيت من Safari: اضغط زر المشاركة بالأسفل، ثم اختر «إضافة إلى الشاشة الرئيسية» (Add to Home Screen). ملاحظة: إذا كان التطبيق مثبتاً بالفعل، يمكنك فتحه من الشاشة الرئيسية.";
    }

    if (browserFamily === "android") {
      return "للتثبيت: افتح قائمة المتصفح (⋮)، ثم اختر «إضافة إلى الشاشة الرئيسية» أو «Install And Create Shortcut». ملاحظة: قد لا يظهر الخيار إذا كان التطبيق مثبتاً بالفعل.";
    }

    if (browserFamily === "desktop") {
      return "للتثبيت على جهاز الكمبيوتر: انقر على أيقونة التثبيت (🖥️/⬇️) في شريط العنوان أعلى المتصفح. ملاحظة: إذا لم تظهر الأيقونة، فقد يكون التطبيق مثبتاً بالفعل أو متصفحك لا يدعم التثبيت المباشر.";
    }

    return "إذا لم يظهر خيار التثبيت، فقد يكون التطبيق مثبتاً بالفعل على جهازك. يمكنك أيضاً حفظ الرابط للوصول السريع.";
  }, [browserFamily, installPrompt]);

  const handleInstall = useCallback(async () => {
    if (!installPrompt) {
      setIsOpen(true);
      return;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setIsOpen(false);
    }
    setInstallPrompt(null);
  }, [installPrompt]);

  const getShareUrl = useCallback(
    () =>
      new URL(shareUrl || window.location.href, window.location.origin).href,
    [shareUrl],
  );

  const handleCopyLink = useCallback(async () => {
    const currentUrl = getShareUrl();

    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
      return;
    } catch {
      window.prompt("انسخ الرابط", currentUrl);
    }
  }, [getShareUrl]);

  const handleNativeShare = useCallback(async () => {
    if (!navigator.share) {
      await handleCopyLink();
      return;
    }

    try {
      await navigator.share({
        title: appName,
        url: getShareUrl(),
      });
    } catch {
      // User cancelled the share sheet.
    }
  }, [appName, getShareUrl, handleCopyLink]);

  if (isStandalone) {
    return null;
  }

  return (
    <>
      <button
        id={id}
        type="button"
        onClick={installPrompt ? handleInstall : () => setIsOpen(true)}
        className={cn(
          "inline-flex min-h-11 shrink-0 items-center justify-center rounded-md border border-white/30 bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/30",
          buttonText ? "gap-2 px-3 text-sm font-semibold" : "w-11",
          className,
        )}
        aria-label={label}
      >
        <Download
          className={cn("h-5 w-5 shrink-0", iconClassName)}
          aria-hidden="true"
        />
        {buttonText && <span>{buttonText}</span>}
      </button>

      {isOpen &&
        mounted &&
        createPortal(
          <div
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setIsOpen(false);
              }
            }}
            className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 px-4 pb-4 sm:items-center sm:pb-0"
            role="dialog"
            aria-modal="true"
            aria-labelledby="install-pwa-title"
            dir="rtl"
          >
            <div className="w-full max-w-sm rounded-lg bg-white p-5 text-right shadow-xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2
                    id="install-pwa-title"
                    className="text-lg font-bold text-[#222B2E]"
                  >
                    احفظ {appName}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-gray-600">
                    {instruction}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#27AE60]/20"
                  aria-label="إغلاق"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>

              <div className="mt-5 grid gap-2">
                {installPrompt && (
                  <button
                    type="button"
                    onClick={handleInstall}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#0F5A3D] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#27AE60] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#27AE60]/20"
                  >
                    <Download className="h-4 w-4" aria-hidden="true" />
                    تثبيت التطبيق
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleNativeShare}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-[#222B2E] transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#27AE60]/20"
                >
                  <Share2 className="h-4 w-4" aria-hidden="true" />
                  مشاركة الرابط
                </button>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-[#222B2E] transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#27AE60]/20"
                >
                  {copied ? (
                    <Check
                      className="h-4 w-4 text-[#0F5A3D]"
                      aria-hidden="true"
                    />
                  ) : (
                    <Copy className="h-4 w-4" aria-hidden="true" />
                  )}
                  {copied ? "تم نسخ الرابط" : "نسخ الرابط"}
                </button>
              </div>

              <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-gray-500">
                <ExternalLink
                  className="mt-0.5 h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
                بعض المتصفحات تعرض اسم الخيار بصيغة مختلفة مثل Add to Home
                Screen أو Install And Create Shortcut.
              </p>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
