"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";
import { AskStayOS } from "@/components/assistant/ask-stayos";
import { ResidentDrawer, BedDrawer } from "@/components/residents/resident-drawer";
import { CheckInDialog } from "@/components/residents/check-in-dialog";
import { useDemo } from "@/lib/store";
import { useSession } from "@/lib/session";
import { TrialBanner } from "./trial-banner";
import { MobileTabBar, MobileTopBar } from "./mobile-nav";
import { cn } from "@/lib/utils";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations("shell");
  const [menu, setMenu] = useState(false);
  const pathname = usePathname();
  const waOpen = useDemo((s) => s.waOpen);
  const role = useDemo((s) => s.role);
  const hydrated = useDemo((s) => s.hydrated);
  const setRole = useDemo((s) => s.setRole);
  useEffect(() => setMenu(false), [pathname]);
  const memberRole = useSession((s) => s.membership?.role);
  // landing on the dashboard while a mobile role is selected switches back to the member's own view
  useEffect(() => {
    if (hydrated && (role === "resident" || role === "parent")) setRole(memberRole === "warden" ? "warden" : "owner");
  }, [hydrated, role, setRole, memberRole]);

  return (
    <div className="flex min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:shadow-lg">
        {t("skip")}
      </a>
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 border-r border-line lg:block">
        <Sidebar />
      </aside>
      <Sheet open={menu} onOpenChange={setMenu}>
        <SheetContent side="left" className="w-72 p-0" showCloseButton={false}>
          <SheetTitle className="sr-only">{t("menu")}</SheetTitle>
          <Sidebar onNavigate={() => setMenu(false)} />
        </SheetContent>
      </Sheet>
      <div className={cn("flex min-w-0 flex-1 flex-col transition-[padding] duration-300 ease-[cubic-bezier(.2,0,0,1)]", waOpen && "2xl:pr-[396px]")}>
        <div className="hidden lg:block">
          <TopBar onMenu={() => setMenu(true)} />
          <TrialBanner />
        </div>
        <MobileTopBar />
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1440px] flex-1 px-4 pt-2 pb-[calc(84px+env(safe-area-inset-bottom))] outline-none sm:px-6 lg:px-8 lg:pt-8 lg:pb-24">
          {children}
        </main>
      </div>
      <MobileTabBar />
      <ResidentDrawer />
      <BedDrawer />
      <CheckInDialog />
      <AskStayOS />
    </div>
  );
}
