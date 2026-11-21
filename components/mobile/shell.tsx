"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { QRCodeSVG } from "qrcode.react";
import { BatteryFull, Signal, Wifi, CheckCircle2, Users } from "lucide-react";
import { TopBar } from "@/components/shell/top-bar";
import { EmptyState } from "@/components/common/states";
import { ScreenTransition } from "@/components/shell/screen-transition";
import { isStaffRole, useSession } from "@/lib/session";
import { Avatar } from "@/components/common/avatar";
import { useDemo, type Role } from "@/lib/store";
import { useFormat, useNow } from "@/lib/hooks";
import { syncStatusBar } from "@/lib/native";
import { demo } from "@/config/demo";
import { brand } from "@/config/brand";
import { cn } from "@/lib/utils";

export interface TabItem { href: string; label: string; icon: React.ElementType; match?: (p: string) => boolean; tour?: string }

/**
 * Desktop: the app sits in a phone frame next to a short explainer.
 * Phone browser and the iOS app: the same screens run full-screen with safe areas.
 */
export function MobileShell({ role, tabs, children }: { role: Extract<Role, "resident" | "parent">; tabs: TabItem[]; children: React.ReactNode }) {
  const pathname = usePathname();
  const scroller = useRef<HTMLDivElement>(null);
  const setRole = useDemo((s) => s.setRole);
  const hydrated = useDemo((s) => s.hydrated);
  const current = useDemo((s) => s.role);
  const waOpen = useDemo((s) => s.waOpen);
  const { resolvedTheme } = useTheme();
  const staffView = useSession((s) => isStaffRole(s.membership?.role));
  const residents = useDemo((s) => s.residents);
  const te = useTranslations("account.empty");
  // the apps show one resident; in a new hostel that is the first one checked in
  if (!residents.some((r) => r.id === demo.residentId)) {
    const first = residents.find((r) => r.status !== "checked_out");
    if (first) demo.residentId = first.id;
  }
  const hasResident = residents.some((r) => r.id === demo.residentId);
  useEffect(() => {
    if (hydrated && current !== role) setRole(role);
  }, [hydrated, current, role, setRole]);
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [pathname]);
  useEffect(() => {
    syncStatusBar(resolvedTheme === "dark");
  }, [resolvedTheme]);

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <div className="demo-chrome"><TopBar variant="app" /></div>
      <div className={cn("flex flex-1 items-start justify-center gap-12 transition-[padding] duration-300 md:px-6 md:py-8 xl:py-10", waOpen && "2xl:pr-[396px]")}>
        {staffView && <Explainer role={role} />}
        <div className="phone-frame relative h-[calc(100dvh-56px)] w-full overflow-hidden bg-canvas md:h-[844px] md:max-h-[calc(100dvh-120px)] md:min-h-[640px] md:w-[390px] md:shrink-0 md:rounded-[52px] md:border-[10px] md:border-[#0b0b0a] md:shadow-[0_30px_80px_-20px_rgb(0_0_0/0.35),0_0_0_1px_rgb(255_255_255/0.06)_inset] dark:md:border-[#1d1d1b]">
          <StatusBar />
          <div ref={scroller} id="app-scroll" className="no-scrollbar h-full overflow-y-auto overscroll-contain pb-[calc(76px+env(safe-area-inset-bottom))] md:pt-11">
            <div className="pt-safe">
              {hasResident ? <ScreenTransition>{children}</ScreenTransition> : <EmptyState icon={Users} title={te("noResidentTitle")} body={te("noResidentBody")} className="min-h-[60vh]" />}
            </div>
          </div>
          <BottomTabs tabs={tabs} />
          <div aria-hidden className="pointer-events-none absolute bottom-2 left-1/2 hidden h-[5px] w-32 -translate-x-1/2 rounded-full bg-fg/80 md:block" />
        </div>
      </div>
    </div>
  );
}

function StatusBar() {
  const f = useFormat();
  const now = useNow(30000);
  return (
    <div className="demo-chrome pointer-events-none absolute inset-x-0 top-0 z-20 hidden h-11 items-center justify-between bg-canvas/90 px-7 text-[15px] font-semibold text-fg md:flex">
      <span className="tnum">{f.time(now).replace(/\s?[AP]M$/i, "")}</span>
      <span aria-hidden className="absolute top-2 left-1/2 h-7 w-28 -translate-x-1/2 rounded-full bg-[#0b0b0a]" />
      <span className="flex items-center gap-1.5"><Signal className="size-4" aria-hidden /><Wifi className="size-4" aria-hidden /><BatteryFull className="size-5" aria-hidden /></span>
    </div>
  );
}

function BottomTabs({ tabs }: { tabs: TabItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="absolute inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] md:pb-4" aria-label="App">
      <ul className="flex h-16">
        {tabs.map((t) => {
          const active = t.match ? t.match(pathname) : pathname.replace(/\/$/, "") === t.href.replace(/\/$/, "");
          return (
            <li key={t.href} className="flex-1">
              <Link href={t.href} aria-current={active ? "page" : undefined} data-tour={t.tour} className={cn("flex h-full flex-col items-center justify-center gap-1 text-xs font-medium transition-colors", active ? "text-brand-text" : "text-fg-3 hover:text-fg-2")}>
                <t.icon className="size-[22px]" strokeWidth={active ? 2.1 : 1.75} aria-hidden />
                <span className="max-w-full truncate px-1">{t.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function Explainer({ role }: { role: "resident" | "parent" }) {
  const t = useTranslations("mobile.explainer");
  const residents = useDemo((s) => s.residents);
  const r = residents.find((x) => x.id === demo.residentId);
  const name = role === "resident" ? r?.name ?? "" : r?.parent.name ?? "";
  const points = role === "resident" ? ["r1", "r2", "r3", "r4"] : ["p1", "p2", "p3", "p4"];
  const [url, setUrl] = useState("");
  useEffect(() => setUrl(window.location.href), []);
  return (
    <aside className="demo-chrome hidden w-[320px] shrink-0 pt-6 lg:block">
      <p className="text-xs font-medium text-fg-3">{t("eyebrow", { brand: brand.name })}</p>
      <h1 className="mt-1 text-page font-semibold tracking-[-0.015em] text-fg">{role === "resident" ? t("residentTitle") : t("parentTitle")}</h1>
      <div className="mt-5 flex items-center gap-3 rounded-lg border border-line bg-surface p-3">
        <Avatar name={name} size={40} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-fg">{name}</p>
          <p className="truncate text-xs text-fg-3">{role === "resident" ? t("residentMeta", { bed: r?.bedId ?? "", inst: r?.institution.split(" · ")[1] ?? "" }) : t("parentMeta", { child: r?.name ?? "" })}</p>
        </div>
      </div>
      <ul className="mt-5 space-y-3">
        {points.map((p) => (
          <li key={p} className="flex gap-2.5 text-sm text-fg-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand-text" aria-hidden />{t(p)}</li>
        ))}
      </ul>
      <div className="mt-6 flex items-center gap-4 rounded-lg border border-line bg-surface p-4">
        <div className="rounded-md bg-white p-1.5">{url && <QRCodeSVG value={url} size={76} level="M" />}</div>
        <div>
          <p className="text-sm font-medium text-fg">{t("openOnPhone")}</p>
          <p className="mt-0.5 text-xs text-fg-3">{t("openOnPhoneBody")}</p>
        </div>
      </div>
    </aside>
  );
}

/** Large-title header used at the top of each app screen. */
export function AppHeader({ title, subtitle, left, right, large = true }: { title: React.ReactNode; subtitle?: React.ReactNode; left?: React.ReactNode; right?: React.ReactNode; large?: boolean }) {
  return (
    <header className="px-4 pt-4 pb-3">
      {(left || right) && <div className="mb-2 flex min-h-9 items-center justify-between">{left ?? <span />}{right}</div>}
      <h1 className={cn("font-semibold tracking-[-0.02em] text-fg", large ? "text-[28px] leading-[34px]" : "text-title")}>{title}</h1>
      {subtitle && <p className="mt-0.5 text-sm text-fg-2">{subtitle}</p>}
    </header>
  );
}

export function MCard({ className, ...props }: React.ComponentProps<"section">) {
  return <section className={cn("mx-4 rounded-xl border border-line bg-surface p-4", className)} {...props} />;
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mx-4 mt-6 mb-2 flex items-center justify-between">
      <h2 className="text-base font-semibold text-fg">{children}</h2>
      {action}
    </div>
  );
}
