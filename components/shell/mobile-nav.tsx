"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { BedDouble, ChevronLeft, Ellipsis, Home, IndianRupee, MessageCircle, MessageSquareWarning, Sparkles } from "lucide-react";
import { useDemo } from "@/lib/store";
import { overdueInvoices } from "@/lib/selectors";
import { todayISO } from "@/lib/clock";
import { haptic } from "@/lib/native";
import { useKeyboardOpen } from "@/lib/hooks";
import { hostel } from "@/data";
import { NAV } from "./nav";
import { ViewSwitchButton } from "./role-switcher";
import { cn } from "@/lib/utils";

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "H";

const ROOTS: Record<string, (p: string) => boolean> = {
  home: (p) => p === "/dashboard" || p === "/dashboard/",
  rooms: (p) => p.startsWith("/dashboard/rooms"),
  rent: (p) => p.startsWith("/dashboard/rent"),
  complaints: (p) => p.startsWith("/dashboard/complaints"),
};

/** The four screens owners and wardens open most, plus More. */
export const TABS: { key: string; href: string; icon: React.ElementType; match: (p: string) => boolean }[] = [
  { key: "home", href: "/dashboard/", icon: Home, match: ROOTS.home },
  { key: "rooms", href: "/dashboard/rooms/", icon: BedDouble, match: ROOTS.rooms },
  { key: "rent", href: "/dashboard/rent/", icon: IndianRupee, match: ROOTS.rent },
  { key: "complaints", href: "/dashboard/complaints/", icon: MessageSquareWarning, match: ROOTS.complaints },
  { key: "more", href: "/dashboard/more/", icon: Ellipsis, match: (p) => !Object.values(ROOTS).some((r) => r(p)) },
];
const isTabRoot = (p: string) => TABS.some((t) => t.key !== "more" && t.match(p)) || p.startsWith("/dashboard/more");

/** Title of the current screen, for the compact nav bar. */
function useScreenTitle() {
  const t = useTranslations("nav");
  const tm = useTranslations("account.more");
  const pathname = usePathname();
  if (pathname.startsWith("/dashboard/more")) return tm("title");
  if (pathname.startsWith("/dashboard/residents/profile")) return t("residents");
  for (const g of NAV) for (const i of g.items) {
    const base = i.href.replace(/\/$/, "");
    if (i.key === "home" ? pathname === "/dashboard" || pathname === "/dashboard/" : pathname.startsWith(base)) return t(i.key);
  }
  return "";
}

/**
 * iOS-style navigation bar for phones: hostel badge or back button on the left, the screen's title
 * once the large title has scrolled away, and WhatsApp and Ask StayOS on the right.
 */
export function MobileTopBar() {
  const t = useTranslations("shell");
  const tm = useTranslations("account.more");
  const router = useRouter();
  const pathname = usePathname();
  const title = useScreenTitle();
  const root = isTabRoot(pathname);
  const unread = useDemo((s) => (s.hydrated ? s.whatsapp.reduce((a, th) => a + th.unread, 0) : 0));
  const openWA = useDemo((s) => s.openWhatsApp);
  const setAiOpen = useDemo((s) => s.setAiOpen);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 44);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, [pathname]);

  return (
    <header
      className={cn(
        "sticky top-0 z-30 select-none border-b bg-canvas/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl backdrop-saturate-150 transition-colors lg:hidden",
        scrolled ? "border-line" : "border-transparent"
      )}
    >
      <div className="relative flex h-12 items-center gap-1 px-2">
        {root ? (
          <>
            <Link href="/dashboard/more/" aria-label={tm("title")} className="grid size-11 shrink-0 place-items-center rounded-full active:bg-surface-2">
              <span className="grid size-8 place-items-center rounded-full bg-brand-tint text-[11px] font-semibold text-brand-tint-fg">{initials(hostel.name)}</span>
            </Link>
            <ViewSwitchButton />
          </>
        ) : (
          <button
            onClick={() => (window.history.length > 1 ? router.back() : router.push("/dashboard/more/"))}
            className="flex h-11 items-center gap-0.5 rounded-full pr-2 pl-1 text-[17px] text-brand-text active:opacity-60"
          >
            <ChevronLeft className="size-7" strokeWidth={2.2} aria-hidden />
            <span>{tm("back")}</span>
          </button>
        )}
        <p
          aria-hidden={!scrolled}
          className={cn(
            "pointer-events-none absolute inset-x-28 truncate text-center text-[17px] font-semibold text-fg transition-opacity duration-200",
            scrolled ? "opacity-100" : "opacity-0"
          )}
        >
          {title}
        </p>
        <div className="ml-auto flex items-center">
          <button aria-label={t("whatsapp")} onClick={() => openWA()} className="relative grid size-11 place-items-center rounded-full text-fg-2 active:bg-surface-2">
            <MessageCircle className="size-[22px]" aria-hidden />
            {unread > 0 && <span className="absolute top-1.5 right-1.5 grid min-w-4 place-items-center rounded-full bg-whatsapp px-1 text-[10px] leading-4 font-semibold text-[#063] tnum">{unread}</span>}
          </button>
          <button aria-label={tm("ask")} onClick={() => setAiOpen(true)} className="grid size-11 place-items-center rounded-full text-brand-text active:bg-surface-2">
            <Sparkles className="size-[22px]" aria-hidden />
          </button>
        </div>
      </div>
    </header>
  );
}

/** Bottom tab bar for owners and wardens on phones, styled like the resident app's. */
export function MobileTabBar() {
  const tm = useTranslations("account.more");
  const pathname = usePathname();
  const openComplaints = useDemo((s) => s.complaints.filter((c) => c.status !== "resolved").length);
  const overdue = useDemo((s) => overdueInvoices(s.invoices, todayISO()).length);
  const badges: Record<string, number> = { complaints: openComplaints, rent: overdue };
  const typing = useKeyboardOpen();
  return (
    <nav aria-label="App" hidden={typing} className="fixed inset-x-0 bottom-0 z-40 select-none border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl backdrop-saturate-150 lg:hidden">
      <ul className="mx-auto flex h-[58px] max-w-xl">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          const badge = badges[tab.key];
          return (
            <li key={tab.key} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                onClick={() => haptic("light")}
                className={cn("relative flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium active:opacity-60", active ? "text-brand-text" : "text-fg-3")}
              >
                <span className="relative">
                  <tab.icon className="size-[24px]" strokeWidth={active ? 2.1 : 1.7} aria-hidden />
                  {badge ? (
                    <span className={cn("absolute -top-1.5 left-4 min-w-[18px] rounded-full px-1 text-center text-[10px] leading-[18px] font-semibold text-white tnum", tab.key === "rent" ? "bg-danger" : "bg-fg-2")}>
                      {badge > 99 ? "99+" : badge}
                    </span>
                  ) : null}
                </span>
                <span className="max-w-full truncate px-1">{tab.key === "more" ? tm("title") : tm(`tabs.${tab.key}` as "tabs.home")}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
