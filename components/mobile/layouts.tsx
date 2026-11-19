"use client";

import { useTranslations } from "next-intl";
import { BedDouble, Bell, CalendarClock, DoorOpen, Home, IndianRupee, LifeBuoy, Soup } from "lucide-react";
import { MobileShell } from "./shell";

export function ResidentLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations("mobile.tabs");
  return (
    <MobileShell
      role="resident"
      tabs={[
        { href: "/resident/", label: t("home"), icon: Home, match: (p) => p === "/resident" || p === "/resident/" || p.startsWith("/resident/pay") || p.startsWith("/resident/notices") },
        { href: "/resident/mess/", label: t("mess"), icon: Soup, tour: "tab-mess" },
        { href: "/resident/gate/", label: t("gate"), icon: DoorOpen },
        { href: "/resident/help/", label: t("help"), icon: LifeBuoy, match: (p) => p.startsWith("/resident/help") },
        { href: "/resident/room/", label: t("room"), icon: BedDouble },
      ]}
    >
      {children}
    </MobileShell>
  );
}

export function ParentLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations("mobile.tabs");
  return (
    <MobileShell
      role="parent"
      tabs={[
        { href: "/parent/", label: t("home"), icon: Home, match: (p) => p === "/parent" || p === "/parent/" || p.startsWith("/parent/notices") },
        { href: "/parent/alerts/", label: t("alerts"), icon: Bell },
        { href: "/parent/leave/", label: t("leave"), icon: CalendarClock },
        { href: "/parent/pay/", label: t("fees"), icon: IndianRupee, match: (p) => p.startsWith("/parent/pay") },
      ]}
    >
      {children}
    </MobileShell>
  );
}
