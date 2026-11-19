"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Logo } from "@/components/brand/logo";
import { useDemo } from "@/lib/store";
import { useSession } from "@/lib/session";
import { AccountMenu } from "./account-menu";
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
  const saving = useSession((s) => s.saving);
  const counts: Partial<Record<string, number>> = hydrated ? { complaints: openComplaints, rent: overdue } : {};

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
                          "flex min-h-8 items-center gap-2.5 rounded-sm border px-2 py-1 text-sm leading-tight font-medium transition-colors duration-[120ms]",
                          active ? "border-line bg-surface text-fg shadow-sm" : "border-transparent text-fg-2 hover:bg-surface-2 hover:text-fg"
                        )}
                      >
                        <i.icon className={cn("size-4", active ? "text-brand-text" : "text-fg-3")} aria-hidden />
                        <span className="flex-1">{t(i.key)}</span>
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
        {saving !== "idle" && (
          <p className={cn("mb-1.5 flex items-center gap-1.5 px-2 text-xs", saving === "error" ? "text-danger-fg" : "text-fg-3")} role="status">
            <span className={cn("size-1.5 rounded-full", saving === "saving" ? "animate-pulse bg-warning" : saving === "error" ? "bg-danger" : "bg-success")} aria-hidden />
            {t(`saving.${saving}`)}
          </p>
        )}
        <AccountMenu onNavigate={onNavigate} />
      </div>
    </nav>
  );
}
