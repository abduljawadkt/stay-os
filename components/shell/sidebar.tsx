"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Logo } from "@/components/brand/logo";
import { Avatar } from "@/components/common/avatar";
import { useDemo } from "@/lib/store";
import { hostel, staff } from "@/data";
import { overdueInvoices } from "@/lib/selectors";
import { todayISO } from "@/lib/clock";
import { NAV } from "./nav";
import { cn } from "@/lib/utils";

export function Sidebar({ onNavigate, className }: { onNavigate?: () => void; className?: string }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const role = useDemo((s) => s.role);
  const hydrated = useDemo((s) => s.hydrated);
  const openComplaints = useDemo((s) => s.complaints.filter((c) => c.status !== "resolved").length);
  const overdue = useDemo((s) => overdueInvoices(s.invoices, todayISO()).length);
  const occupied = useDemo((s) => s.beds.filter((b) => b.status === "occupied").length);
  const counts: Partial<Record<string, number>> = hydrated ? { complaints: openComplaints, rent: overdue } : {};
  const person = role === "warden" ? { name: staff[0].name, title: t("wardenTitle") } : { name: hostel.owner.name, title: t("ownerTitle") };

  return (
    <nav aria-label={t("label")} className={cn("flex h-full flex-col bg-canvas", className)}>
      <div className="flex h-14 shrink-0 items-center px-5">
        <Link href="/dashboard/" onClick={onNavigate} className="rounded-md">
          <Logo />
        </Link>
      </div>
      <div className="scrollbar-thin flex-1 overflow-y-auto px-3 pt-2 pb-4">
        {NAV.map((g) => {
          const items = g.items.filter((i) => role !== "warden" || !i.ownerOnly);
          if (!items.length) return null;
          return (
            <div key={g.group} className="mb-4">
              {g.group !== "overview" && <p className="mb-1 px-2 text-xs font-medium text-fg-3">{t(`groups.${g.group}`)}</p>}
              <ul className="space-y-0.5">
                {items.map((i) => {
                  const active = i.href === "/dashboard/" ? pathname === "/dashboard" || pathname === "/dashboard/" : pathname.startsWith(i.href.replace(/\/$/, ""));
                  return (
                    <li key={i.key}>
                      <Link
                        href={i.href}
                        onClick={onNavigate}
                        aria-current={active ? "page" : undefined}
                        data-tour={`nav-${i.key}`}
                        className={cn(
                          "flex h-8 items-center gap-2.5 rounded-sm border px-2 text-sm font-medium transition-colors duration-[120ms]",
                          active ? "border-line bg-surface text-fg shadow-sm" : "border-transparent text-fg-2 hover:bg-surface-2 hover:text-fg"
                        )}
                      >
                        <i.icon className={cn("size-4", active ? "text-brand-text" : "text-fg-3")} aria-hidden />
                        <span className="flex-1 truncate">{t(i.key)}</span>
                        {counts[i.key] ? (
                          <span className={cn("rounded-full px-1.5 text-xs leading-5 tnum", i.key === "rent" ? "bg-danger-tint text-danger-fg" : "bg-surface-3 text-fg-2")}>{counts[i.key]}</span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
      <div className="border-t border-line p-3">
        <div className="flex items-center gap-2.5 rounded-md px-2 py-1.5">
          <span className="grid size-8 place-items-center rounded-md bg-brand-tint text-xs font-semibold text-brand-tint-fg">AN</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-fg">{hostel.name}</p>
            <p className="truncate text-xs text-fg-3 tnum">{t("hostelMeta", { beds: 300, occupied: hydrated ? occupied : 260 })}</p>
          </div>
        </div>
        <div className="mt-1 flex items-center gap-2.5 rounded-md px-2 py-1.5">
          <Avatar name={person.name} size={32} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-fg">{person.name}</p>
            <p className="truncate text-xs text-fg-3">{person.title}</p>
          </div>
        </div>
      </div>
    </nav>
  );
}
