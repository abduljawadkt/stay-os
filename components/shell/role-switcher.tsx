"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { motion } from "framer-motion";
import { Building2, Check, ChevronDown, ShieldCheck, User, Users } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useDemo, type Role } from "@/lib/store";
import { allowedViews, useSession } from "@/lib/session";
import { haptic } from "@/lib/native";
import { cn } from "@/lib/utils";

export const ROLES: Role[] = ["owner", "warden", "resident", "parent"];
/** The views this member may switch between (staff can preview the resident and parent apps). */
export const useViews = () => allowedViews(useSession((s) => s.membership?.role));

export function useRoleNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const setRole = useDemo((s) => s.setRole);
  return (r: Role) => {
    setRole(r);
    if (r === "owner" || r === "warden") {
      if (!pathname.startsWith("/dashboard")) router.push("/dashboard/");
    } else if (!pathname.startsWith(`/${r}`)) router.push(`/${r}/`);
  };
}

export function RoleSwitcher({ className }: { className?: string }) {
  const t = useTranslations("roles");
  const role = useDemo((s) => s.role);
  const hydrated = useDemo((s) => s.hydrated);
  const go = useRoleNavigation();
  const views = useViews();
  if (views.length < 2) return null;
  return (
    <div role="radiogroup" aria-label={t("label")} data-tour="role-switcher" className={cn("relative flex rounded-md bg-surface-2 p-0.5", className)}>
      {views.map((r) => {
        const active = hydrated && role === r;
        return (
          <button
            key={r}
            role="radio"
            aria-checked={active}
            onClick={() => go(r)}
            onKeyDown={(e) => {
              if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
              e.preventDefault();
              const i = views.indexOf(role);
              const next = views[(i + (e.key === "ArrowRight" ? 1 : views.length - 1)) % views.length];
              go(next);
              (e.currentTarget.parentElement?.querySelectorAll("button")[views.indexOf(next)] as HTMLButtonElement | undefined)?.focus();
            }}
            tabIndex={active || (!hydrated && r === views[0]) ? 0 : -1}
            className={cn(
              "relative z-0 h-7 rounded-sm px-3 text-small font-medium transition-colors duration-[120ms]",
              active ? "text-fg" : "text-fg-2 hover:text-fg"
            )}
          >
            {active && <motion.span layoutId="role-thumb" className="absolute inset-0 -z-10 rounded-sm bg-surface shadow-sm dark:bg-surface-3" transition={{ type: "spring", stiffness: 420, damping: 36 }} />}
            {t(r)}
          </button>
        );
      })}
    </div>
  );
}

const VIEW_ICONS: Record<Role, React.ElementType> = { owner: Building2, warden: ShieldCheck, resident: User, parent: Users };

/**
 * Phones: the current view as a small pill in the nav bar ("Owner ⌄"). Tapping it opens a sheet to switch
 * between the views this member may use. Renders nothing for residents and parents, who have one view.
 */
export function ViewSwitchButton({ className }: { className?: string }) {
  const t = useTranslations("roles");
  const role = useDemo((s) => s.role);
  const hydrated = useDemo((s) => s.hydrated);
  const memberRole = useSession((s) => s.membership?.role);
  const views = useViews();
  const go = useRoleNavigation();
  const [open, setOpen] = useState(false);
  if (!hydrated || views.length < 2) return null;
  const current = views.includes(role) ? role : views[0];
  return (
    <>
      <button
        type="button"
        onClick={() => { haptic("light"); setOpen(true); }}
        aria-haspopup="dialog"
        aria-label={`${t("switchTitle")}: ${t(current)}`}
        className={cn("flex h-8 max-w-[120px] items-center gap-0.5 rounded-full bg-surface-2 pr-2 pl-3 text-[15px] font-medium text-fg active:opacity-60", className)}
      >
        <span className="truncate">{t(current)}</span>
        <ChevronDown className="size-4 shrink-0 text-fg-2" aria-hidden />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>{t("switchTitle")}</DialogTitle>
            <DialogDescription>{t("switchBody", { role: t(memberRole ?? current) })}</DialogDescription>
          </DialogHeader>
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line" role="radiogroup" aria-label={t("switchTitle")}>
            {views.map((v) => {
              const Icon = VIEW_ICONS[v];
              const active = v === current;
              return (
                <li key={v}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => { haptic("light"); setOpen(false); if (!active) go(v); }}
                    className="flex w-full items-center gap-3 bg-surface px-4 py-3 text-left active:bg-surface-2"
                  >
                    <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", active ? "bg-brand-tint text-brand-tint-fg" : "bg-surface-2 text-fg-2")}><Icon className="size-[18px]" aria-hidden /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-base font-medium text-fg">{t(v)}</span>
                      <span className="block text-sm text-fg-2">{t(`${v}Sub` as "ownerSub")}</span>
                    </span>
                    {active && <Check className="size-5 shrink-0 text-brand-text" aria-hidden />}
                  </button>
                </li>
              );
            })}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
