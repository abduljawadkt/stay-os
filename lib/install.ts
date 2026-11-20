"use client";

import { create } from "zustand";

// Installing the web app to the home screen.
// Android and desktop Chrome/Edge fire `beforeinstallprompt`; we keep it and show our own sheet with an
// Install button. iPhone Safari has no prompt at all, so the sheet shows the Share → Add to Home Screen steps.

type Platform = "ios" | "android" | "desktop";
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface InstallState {
  ready: boolean;
  platform: Platform;
  standalone: boolean;
  native: boolean;
  canPrompt: boolean;
  installed: boolean;
  open: boolean;
  setOpen: (v: boolean) => void;
}

const DISMISS_KEY = "stayos-install-dismissed";
const SNOOZE_DAYS = 7;
let deferred: BeforeInstallPromptEvent | null = null;

export const useInstall = create<InstallState>((set) => ({
  ready: false,
  platform: "desktop",
  standalone: false,
  native: false,
  canPrompt: false,
  installed: false,
  open: false,
  setOpen: (open) => set({ open }),
}));

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/Android/.test(ua)) return "android";
  if (/iPhone|iPad|iPod/.test(ua)) return "ios";
  // iPadOS Safari reports itself as a Mac; a Mac with a touchscreen is an iPad
  if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1 && !/Chrome|Edg|Firefox/.test(ua)) return "ios";
  return "desktop";
}

/** Call once at startup: registers the service worker and listens for the browser's install offer. */
export function initInstall() {
  if (typeof window === "undefined" || useInstall.getState().ready) return;
  const native = !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
  useInstall.setState({ ready: true, platform: detectPlatform(), standalone, native });

  if (!native && "serviceWorker" in navigator && process.env.NODE_ENV === "production") {
    window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => undefined), { once: true });
    if (document.readyState === "complete") navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    useInstall.setState({ canPrompt: true });
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    useInstall.setState({ installed: true, canPrompt: false, open: false });
  });
}

/** Whether the app can be installed here at all (not already installed, not inside the iOS app). */
export function installAvailable(s = useInstall.getState()) {
  return s.ready && !s.native && !s.standalone && !s.installed && (s.platform === "ios" || s.platform === "android" || s.canPrompt);
}

export function snoozed() {
  try {
    return Number(localStorage.getItem(DISMISS_KEY) ?? 0) > Date.now();
  } catch {
    return false;
  }
}

export function snooze() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now() + SNOOZE_DAYS * 86400000));
  } catch {}
  useInstall.setState({ open: false });
}

/** Show the browser's own install dialog (Android, desktop Chrome/Edge). */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  await deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null;
  useInstall.setState({ canPrompt: false, ...(outcome === "accepted" ? { installed: true, open: false } : {}) });
  return outcome === "accepted";
}
