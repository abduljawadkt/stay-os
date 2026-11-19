"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { useDemo, type Role } from "@/lib/store";
import { cn } from "@/lib/utils";

export const ROLES: Role[] = ["owner", "warden", "resident", "parent"];

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
  return (
    <div role="radiogroup" aria-label={t("label")} data-tour="role-switcher" className={cn("relative flex rounded-md bg-surface-2 p-0.5", className)}>
      {ROLES.map((r) => {
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
              const i = ROLES.indexOf(role);
              const next = ROLES[(i + (e.key === "ArrowRight" ? 1 : ROLES.length - 1)) % ROLES.length];
              go(next);
              (e.currentTarget.parentElement?.querySelectorAll("button")[ROLES.indexOf(next)] as HTMLButtonElement | undefined)?.focus();
            }}
            tabIndex={active || (!hydrated && r === "owner") ? 0 : -1}
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
