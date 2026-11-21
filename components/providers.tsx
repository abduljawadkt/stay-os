"use client";

import { useEffect } from "react";
import { ThemeProvider } from "next-themes";
import { MotionConfig } from "framer-motion";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "@/lib/i18n";
import { useDemo } from "@/lib/store";
import { boot, useSession } from "@/lib/session";
import { neon } from "@/lib/neon";
import { initInstall, useInstall } from "@/lib/install";
import { AutoInstallPrompt, InstallSheet } from "@/components/shell/install-sheet";
import { EventToaster } from "@/components/shell/event-toaster";
import { WhatsAppPanel } from "@/components/whatsapp/whatsapp-panel";
import { TourOverlay } from "@/components/tour/tour-overlay";

function SessionBoot() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") Object.assign(window, { __demo: useDemo, __session: useSession, __neon: neon, __install: useInstall });
    initInstall();
    boot();
  }, []);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <I18nProvider>
        <MotionConfig reducedMotion="user" transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}>
          <TooltipProvider delayDuration={300}>
            <SessionBoot />
            {children}
            <EventToaster />
            <WhatsAppPanel />
            <TourOverlay />
            <InstallSheet />
            <AutoInstallPrompt />
            <Toaster
              position="bottom-right"
              offset={{ bottom: 76, right: 20 }}
              mobileOffset={{ bottom: "calc(72px + env(safe-area-inset-bottom))" }}
              toastOptions={{
                classNames: {
                  toast: "!bg-inverse !text-inverse-fg !border-0 !rounded-lg !shadow-lg !text-sm !font-sans !gap-2.5 !py-3 !px-4",
                  description: "!text-inverse-fg/70 !text-small",
                  actionButton: "!bg-transparent !text-brand-tint !font-medium",
                  icon: "!text-inverse-fg",
                },
              }}
            />
          </TooltipProvider>
        </MotionConfig>
      </I18nProvider>
    </ThemeProvider>
  );
}
