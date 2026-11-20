"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Check, EllipsisVertical, Share, SquarePlus } from "lucide-react";
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
  const setOpen = useInstall((s) => s.setOpen);

  const steps: { icon: React.ElementType; text: string }[] =
    platform === "ios"
      ? [{ icon: Share, text: t("ios1") }, { icon: SquarePlus, text: t("ios2") }, { icon: Check, text: t("ios3") }]
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
 * Offers the install once per visit on phones, shortly after a signed-in screen opens. Skipped when the
 * app is already installed, inside the iOS app, or the person said "Not now" in the last week.
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
    const id = setTimeout(() => {
      if (!installAvailable() || snoozed()) return;
      try {
        sessionStorage.setItem("stayos-install-offered", "1");
      } catch {}
      useInstall.getState().setOpen(true);
    }, 2500);
    return () => clearTimeout(id);
  }, [ready, canPrompt]);
  return null;
}
