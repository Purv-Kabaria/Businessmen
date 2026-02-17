"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "pwa-install-dismissed";
const DISMISS_DAYS = 7;
const SHOW_AFTER_MS = 1000;

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    nav.standalone === true ||
    document.referrer.includes("android-app://")
  );
}

function isIOS(): boolean {
  if (typeof window === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function wasDismissedRecently(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const t = parseInt(raw, 10);
    if (Number.isNaN(t)) return false;
    return Date.now() - t < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function setDismissed(): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {}
}

export function PWAInstallPrompt() {
  const pathname = usePathname();
  const [showPopup, setShowPopup] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<{
    prompt: () => Promise<{ outcome: string }>;
  } | null>(null);
  const [ios, setIos] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as unknown as { prompt: () => Promise<{ outcome: string }> });
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    const mq = window.matchMedia("(max-width: 768px)");
    const check = () => setIsMobile(mq.matches);
    check();
    mq.addEventListener("change", check);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      mq.removeEventListener("change", check);
    };
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (isStandalone() || wasDismissedRecently()) return;

    const onMobile = isMobile;
    const onHome = pathname === "/";
    if (!onMobile && !onHome) return;

    const t = setTimeout(() => {
      setIos(isIOS());
      setShowPopup(true);
    }, SHOW_AFTER_MS);

    return () => clearTimeout(t);
  }, [mounted, pathname, isMobile]);

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      setShowPopup(false);
      setDeferredPrompt(null);
      setDismissed();
    }
  };

  const handleDismiss = () => {
    setShowPopup(false);
    setDismissed();
  };

  const openPopup = () => setShowPopup(true);

  const showFab = mounted && isMobile && !isStandalone();

  return (
    <>
      {showFab && !showPopup && (
        <button
          type="button"
          onClick={openPopup}
          className="fixed bottom-4 right-4 z-[99] flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg hover:bg-primary/90"
          style={{ bottom: "max(1rem, calc(env(safe-area-inset-bottom) + 0.5rem))" }}
          aria-label="Download app"
        >
          <Download className="h-4 w-4" />
          Download app
        </button>
      )}
      {!mounted || !showPopup ? null : (
    <div
      className="fixed inset-x-0 bottom-0 z-[100] flex items-center justify-between gap-3 border-t bg-background px-4 py-4 shadow-[0_-4px_20px_rgba(0,0,0,0.2)] animate-in slide-in-from-bottom-4 duration-300 sm:px-6"
      style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      role="region"
      aria-label="Download app"
    >
      <div className="min-w-0 flex-1">
        <p className="text-base font-semibold">Download FinBridge app</p>
        {ios ? (
          <p className="mt-0.5 text-sm text-muted-foreground">
            Tap Share in Safari, then &quot;Add to Home Screen&quot;
          </p>
        ) : (
          <p className="mt-0.5 text-sm text-muted-foreground">
            Install on your phone for quick access
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {ios ? (
          <Button size="sm" variant="outline" onClick={handleDismiss}>
            OK
          </Button>
        ) : (
          <>
            <Button size="default" className="gap-2 font-semibold" onClick={handleInstall}>
              <Download className="h-5 w-5" />
              Download app
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-9 w-9"
              onClick={handleDismiss}
              aria-label="Dismiss"
            >
              <X className="h-5 w-5" />
            </Button>
          </>
        )}
      </div>
    </div>
      )}
    </>
  );
}
