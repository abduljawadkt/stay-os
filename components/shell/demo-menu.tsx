"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Clock, CloudOff, FlaskConical, IndianRupee, MessageCircle, Play, QrCode, RotateCcw } from "lucide-react";
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
          <DropdownMenuItem onSelect={() => start()}>
            <Play /> {t("guidedDemo")}
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
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setConfirm(true)} className="text-danger-fg focus:text-danger-fg">
            <RotateCcw /> {t("resetDemo")}
          </DropdownMenuItem>
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
            <AlertDialogAction variant="destructive" onClick={() => reset()}>{t("resetConfirm")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function GuidedDemoButton({ className }: { className?: string }) {
  const t = useTranslations("shell");
  const start = useTour((s) => s.start);
  return (
    <Button variant="secondary" onClick={start} className={className} data-tour="guided-demo">
      <Play className="fill-current !size-3" /> {t("guidedDemo")}
    </Button>
  );
}
