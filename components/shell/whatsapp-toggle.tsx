"use client";

import { MessageCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useDemo } from "@/lib/store";

export function WhatsAppToggle() {
  const t = useTranslations("shell");
  const open = useDemo((s) => s.waOpen);
  const unread = useDemo((s) => (s.hydrated ? s.whatsapp.reduce((a, th) => a + th.unread, 0) : 0));
  const openWA = useDemo((s) => s.openWhatsApp);
  const close = useDemo((s) => s.closeWhatsApp);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="quiet" size="icon" aria-label={t("whatsapp")} aria-pressed={open} data-tour="wa-toggle" onClick={() => (open ? close() : openWA())} className={open ? "bg-surface-2 text-fg" : ""}>
          <MessageCircle />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 grid min-w-4 place-items-center rounded-full bg-whatsapp px-1 text-[10px] leading-4 font-semibold text-[#063] tnum">{unread}</span>
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{t("whatsapp")}</TooltipContent>
    </Tooltip>
  );
}
