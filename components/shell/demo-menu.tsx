"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Clock, CloudOff, FlaskConical, IndianRupee, MessageCircle, Moon, Play, QrCode, RotateCcw, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { useDemo } from "@/lib/store";
import { useTour } from "@/components/tour/tour-store";
import { simulateGateScan, simulatePayment, simulateWhatsAppComplaint } from "@/lib/demo-actions";
import { useFormat, useNow } from "@/lib/hooks";
import { useSession } from "@/lib/session";

/** Sample-data hostels run the demo story; their owner can reset them. */
export function useSampleHostel() {
  const sample = useSession((s) => s.org?.settings.clock?.mode === "demo");
  const owner = useSession((s) => s.membership?.role === "owner");
  return { sample, canReset: sample && owner };
}

export function DemoMenu() {
  const t = useTranslations("shell");
  const f = useFormat();
  const now = useNow(15000);
  const [confirm, setConfirm] = useState(false);
  const offline = useDemo((s) => s.offline);
  const setOffline = useDemo((s) => s.setOffline);
  const reset = useDemo((s) => s.reset);
  const openWhatsApp = useDemo((s) => s.openWhatsApp);
  const start = useTour((s) => s.start);
  const { resolvedTheme, setTheme } = useTheme();
  const { sample, canReset } = useSampleHostel();
  const [resetting, setResetting] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="quiet" size="icon" aria-label={t("demoMenu")} data-tour="demo-menu">
            <FlaskConical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel className="flex items-center gap-1.5 text-xs font-medium text-fg-3">
            <Clock className="size-3.5" aria-hidden /> {t("demoClock")} · <span className="tnum">{f.weekday(now)}, {f.time(now)}</span>
          </DropdownMenuLabel>
          {sample && (
            <DropdownMenuItem onSelect={() => start()}>
              <Play /> {t("guidedDemo")}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")} className="sm:hidden">
            {resolvedTheme === "dark" ? <Sun /> : <Moon />} {resolvedTheme === "dark" ? t("lightMode") : t("darkMode")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => simulatePayment()}>
            <IndianRupee /> {t("simulatePayment")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              const { threadId } = simulateWhatsAppComplaint();
              if (threadId) openWhatsApp(threadId);
            }}
          >
            <MessageCircle /> {t("simulateComplaint")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => simulateGateScan()}>
            <QrCode /> {t("simulateScan")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setOffline(!offline); }}>
            <CloudOff /> <span className="flex-1">{t("simulateOffline")}</span>
            <Switch checked={offline} tabIndex={-1} aria-hidden className="pointer-events-none" />
          </DropdownMenuItem>
          {canReset && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setConfirm(true)} className="text-danger-fg focus:text-danger-fg">
                <RotateCcw /> {t("resetDemo")}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("resetTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("resetBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={resetting}
              onClick={async (e) => {
                e.preventDefault();
                setResetting(true);
                try {
                  await reset();
                } finally {
                  setResetting(false);
                  setConfirm(false);
                }
              }}
            >
              {resetting ? t("resetting") : t("resetConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function GuidedDemoButton({ className, iconOnly = false }: { className?: string; iconOnly?: boolean }) {
  const t = useTranslations("shell");
  const start = useTour((s) => s.start);
  const preparing = useTour((s) => s.preparing);
  const { sample } = useSampleHostel();
  if (!sample) return null;
  return (
    <Button variant="secondary" size={iconOnly ? "icon" : "default"} onClick={start} loading={preparing} className={className} data-tour={iconOnly ? undefined : "guided-demo"} aria-label={iconOnly ? t("guidedDemo") : undefined}>
      <Play className="fill-current !size-3" /> {!iconOnly && t("guidedDemo")}
    </Button>
  );
}
