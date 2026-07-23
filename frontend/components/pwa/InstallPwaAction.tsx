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
  const userAgent = navigator.userAgent;
  const isIOS =
    /iPad|iPhone|iPod/.test(userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  if (isIOS) return "ios";
  if (/Android/i.test(userAgent)) return "android";
  if (/Windows|Macintosh|Linux/i.test(userAgent)) return "desktop";
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
      return "ثبّت الاختصار كتطبيق على موبايلك وافتحه مباشرة من الشاشة الرئيسية.";
    }

    if (browserFamily === "ios") {
      return "من Safari اضغط زر المشاركة، ثم اختر إضافة إلى الشاشة الرئيسية.";
    }

    if (browserFamily === "android") {
      return "افتح قائمة المتصفح، ثم اختر إضافة إلى الشاشة الرئيسية أو احفظ الرابط.";
    }

    if (browserFamily === "desktop") {
      return "هذا المتصفح قد لا يدعم التثبيت هنا. يمكنك نسخ الرابط أو استخدام قائمة المتصفح لحفظ الصفحة.";
    }

    return "إذا لم يظهر خيار التثبيت، انسخ الرابط أو احفظه من قائمة المتصفح.";
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
    () => new URL(shareUrl || window.location.href, window.location.origin).href,
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

      {isOpen && mounted && createPortal(
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
                  <Check className="h-4 w-4 text-[#0F5A3D]" aria-hidden="true" />
                ) : (
                  <Copy className="h-4 w-4" aria-hidden="true" />
                )}
                {copied ? "تم نسخ الرابط" : "نسخ الرابط"}
              </button>
            </div>

            <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-gray-500">
              <ExternalLink className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              بعض المتصفحات تعرض اسم الخيار بصيغة مختلفة مثل Add to Home Screen أو Install App.
            </p>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
