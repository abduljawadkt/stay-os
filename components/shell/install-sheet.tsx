"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Check, Compass, Ellipsis, EllipsisVertical, ExternalLink, Share, SquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { installAvailable, promptInstall, snooze, snoozed, useInstall } from "@/lib/install";
import { brand } from "@/config/brand";

/** The "Install StayOS" sheet. Mounted once; opened automatically after sign-in on phones, or from More. */
export function InstallSheet() {
  const t = useTranslations("account.install");
  const open = useInstall((s) => s.open);
  const platform = useInstall((s) => s.platform);
  const canPrompt = useInstall((s) => s.canPrompt);
  const inApp = useInstall((s) => s.inApp);
  const iosOther = useInstall((s) => s.iosOtherBrowser);
  const setOpen = useInstall((s) => s.setOpen);

  // apps' built-in browsers (WhatsApp, Instagram…) can't install: first hop to Safari or Chrome
  const steps: { icon: React.ElementType; text: string }[] = inApp
    ? platform === "ios"
      ? [{ icon: Ellipsis, text: t("inApp1") }, { icon: Compass, text: t("inAppIos2") }, { icon: Share, text: t("inApp3") }]
      : [{ icon: EllipsisVertical, text: t("inApp1") }, { icon: ExternalLink, text: t("inAppAndroid2") }, { icon: SquarePlus, text: t("inApp3") }]
    : platform === "ios"
      ? [{ icon: Share, text: t(iosOther ? "iosOther1" : "ios1") }, { icon: SquarePlus, text: t("ios2") }, { icon: Check, text: t("ios3") }]
      : platform === "android"
        ? [{ icon: EllipsisVertical, text: t("android1") }, { icon: SquarePlus, text: t("android2") }, { icon: Check, text: t("android3") }]
        : [{ icon: SquarePlus, text: t("desktop1") }];

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : snooze())}>
      <DialogContent className="sm:max-w-[420px]" showCloseButton={false}>
        <DialogHeader className="items-center text-center sm:items-center sm:text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-192.png" alt="" width={64} height={64} className="mb-2 size-16 rounded-[18px] shadow-sm" />
          <DialogTitle className="text-xl">{t("title", { brand: brand.name })}</DialogTitle>
          <DialogDescription>{t("body")}</DialogDescription>
        </DialogHeader>
        {canPrompt ? (
          <ul className="space-y-2 text-sm text-fg-2">
            {(["b1", "b2", "b3"] as const).map((k) => (
              <li key={k} className="flex gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-brand-text" aria-hidden />{t(k)}</li>
            ))}
          </ul>
        ) : (
          <ol className="divide-y divide-line rounded-xl border border-line">
            {steps.map((s, i) => (
              <li key={i} className="flex items-center gap-3 px-4 py-3 text-[15px] text-fg">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-brand-text"><s.icon className="size-[18px]" aria-hidden /></span>
                <span><span className="mr-1 text-fg-3 tnum">{i + 1}.</span>{s.text}</span>
              </li>
            ))}
          </ol>
        )}
        <div className="flex flex-col gap-2 pt-1">
          {canPrompt ? (
            <Button variant="primary" size="lg" className="h-12 w-full rounded-xl text-base" onClick={() => promptInstall()}>
              {t("install")}
            </Button>
          ) : (
            <Button variant="primary" size="lg" className="h-12 w-full rounded-xl text-base" onClick={() => snooze()}>
              {t("gotIt")}
            </Button>
          )}
          <Button variant="quiet" size="lg" className="w-full" onClick={() => snooze()}>
            {t("notNow")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Offers the install to every phone visitor, on any page, once per visit, at the first quiet moment:
 * 2.5 seconds after the last tap, scroll or key press, so it never lands on top of something being tapped.
 * Skipped when the app is already installed, inside the iOS app, or after "Not now" for a day.
 */
export function AutoInstallPrompt() {
  const ready = useInstall((s) => s.ready);
  const canPrompt = useInstall((s) => s.canPrompt);
  useEffect(() => {
    if (!ready) return;
    const phone = window.matchMedia("(max-width: 767px), (pointer: coarse)").matches;
    if (!phone || !installAvailable() || snoozed()) return;
    try {
      if (sessionStorage.getItem("stayos-install-offered")) return;
    } catch {}
    let id = 0;
    const show = () => {
      // wait while a sheet or dialog is open, or a page is still loading after a tap
      if (document.querySelector('[role="dialog"], [role="alertdialog"]') || document.querySelector('[aria-busy="true"], .animate-spin')) return arm();
      if (!installAvailable() || snoozed()) return;
      try {
        sessionStorage.setItem("stayos-install-offered", "1");
      } catch {}
      stop();
      useInstall.getState().setOpen(true);
    };
    const arm = () => {
      window.clearTimeout(id);
      id = window.setTimeout(show, 2500);
    };
    const events = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
    const stop = () => {
      window.clearTimeout(id);
      events.forEach((e) => window.removeEventListener(e, arm, true));
    };
    events.forEach((e) => window.addEventListener(e, arm, { capture: true, passive: true }));
    arm();
    return stop;
  }, [ready, canPrompt]);
  return null;
}
