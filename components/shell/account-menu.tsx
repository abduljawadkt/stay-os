"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check, ChevronsUpDown, LogOut, Plus, Settings } from "lucide-react";
import { Avatar } from "@/components/common/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDemo } from "@/lib/store";
import { openOrg, signOut, useSession } from "@/lib/session";
import { hostel } from "@/data";
import { TOTAL_BEDS } from "@/lib/selectors";
import { cn } from "@/lib/utils";

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "H";

/** Hostel and account switcher at the foot of the sidebar. */
export function AccountMenu({ onNavigate, className }: { onNavigate?: () => void; className?: string }) {
  const t = useTranslations("account.menu");
  const tn = useTranslations("nav");
  const tr = useTranslations("roles");
  const router = useRouter();
  const user = useSession((s) => s.user);
  const memberships = useSession((s) => s.memberships) ?? [];
  const membership = useSession((s) => s.membership);
  const occupied = useDemo((s) => s.beds.filter((b) => b.status === "occupied").length);
  const isOwner = membership?.role === "owner";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn("flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-brand aria-expanded:bg-surface-2", className)}
        data-tour="account-menu"
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-brand-tint text-xs font-semibold text-brand-tint-fg">{initials(hostel.name)}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-fg">{hostel.name}</span>
          <span className="block truncate text-xs text-fg-3 tnum">{tn("hostelMeta", { beds: TOTAL_BEDS, occupied })}</span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-fg-3" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-72">
        <DropdownMenuLabel className="flex items-center gap-2.5 py-2">
          <Avatar name={user?.name || user?.email || "?"} size={32} />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-fg">{user?.name || user?.email}</span>
            <span className="block truncate text-xs font-normal text-fg-3">{user?.email} · {membership ? tr(membership.role) : ""}</span>
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs font-medium text-fg-3">{t("hostels")}</DropdownMenuLabel>
        {memberships.map((m) => (
          <DropdownMenuItem
            key={m.orgId}
            onSelect={() => {
              if (m.orgId === membership?.orgId) return;
              onNavigate?.();
              router.push(m.role === "resident" ? "/resident/" : m.role === "parent" ? "/parent/" : "/dashboard/");
              openOrg(m.orgId);
            }}
          >
            <span className="grid size-6 shrink-0 place-items-center rounded bg-surface-3 text-[10px] font-semibold text-fg-2">{initials(m.orgName)}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate">{m.orgName}</span>
              <span className="block truncate text-xs text-fg-3">{m.isDemo ? t("liveDemo") : tr(m.role)}</span>
            </span>
            {m.orgId === membership?.orgId && <Check className="text-brand-text" aria-label={t("current")} />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuItem asChild>
          <Link href="/onboarding/?new=1" onClick={onNavigate}>
            <Plus /> {t("newHostel")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {isOwner && (
          <DropdownMenuItem asChild>
            <Link href="/dashboard/settings/" onClick={onNavigate}>
              <Settings /> {t("settings")}
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onSelect={async () => {
            await signOut();
            router.replace("/login/");
          }}
        >
          <LogOut /> {t("signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
