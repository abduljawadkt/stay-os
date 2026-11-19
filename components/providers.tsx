"use client";

import { useEffect } from "react";
import { ThemeProvider } from "next-themes";
import { MotionConfig } from "framer-motion";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "@/lib/i18n";
import { useDemo } from "@/lib/store";
import { EventToaster } from "@/components/shell/event-toaster";
import { WhatsAppPanel } from "@/components/whatsapp/whatsapp-panel";
import { TourOverlay } from "@/components/tour/tour-overlay";

function StoreHydrator() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") (window as unknown as { __demo: typeof useDemo }).__demo = useDemo;
    const p = useDemo.persist.rehydrate();
    Promise.resolve(p).finally(() => useDemo.getState().setHydrated());
  }, []);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <I18nProvider>
        <MotionConfig reducedMotion="user" transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}>
          <TooltipProvider delayDuration={300}>
            <StoreHydrator />
            {children}
            <EventToaster />
            <WhatsAppPanel />
            <TourOverlay />
            <Toaster
              position="bottom-right"
              offset={{ bottom: 76, right: 20 }}
              mobileOffset={{ bottom: 76 }}
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
