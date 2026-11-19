"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { Bell, ChevronLeft, ChevronRight, Moon, Pin, Repeat, Sun } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/common/avatar";
import { useDemo, type Role } from "@/lib/store";
import { useLocale } from "@/lib/i18n";
import { useFormat, useNow } from "@/lib/hooks";
import { haptic } from "@/lib/native";
import { ROLES } from "@/components/shell/role-switcher";
import { cn } from "@/lib/utils";

export function BackButton({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="-ml-2 inline-flex h-9 items-center gap-0.5 rounded-md pr-2 text-base text-brand-text">
      <ChevronLeft className="size-5" aria-hidden /> {label}
    </Link>
  );
}

export function BellLink({ href, count }: { href: string; count: number }) {
  const t = useTranslations("mobile");
  return (
    <Link href={href} className="relative grid size-10 place-items-center rounded-full bg-surface ring-1 ring-line" aria-label={t("notifications", { count })}>
      <Bell className="size-5 text-fg" aria-hidden />
      {count > 0 && <span className="absolute -top-0.5 -right-0.5 grid min-w-[18px] place-items-center rounded-full bg-danger px-1 text-[11px] leading-[18px] font-semibold text-white tnum">{count}</span>}
    </Link>
  );
}

/** Avatar button that opens settings: language, theme and demo view. */
export function ProfileButton({ name, subtitle }: { name: string; subtitle: string }) {
  const t = useTranslations("mobile.profile");
  const tr = useTranslations("roles");
  const [open, setOpen] = useState(false);
  const { locale, setLocale } = useLocale();
  const { resolvedTheme, setTheme } = useTheme();
  const router = useRouter();
  const setRole = useDemo((s) => s.setRole);
  const go = (r: Role) => {
    setRole(r);
    setOpen(false);
    router.push(r === "owner" || r === "warden" ? "/dashboard/" : `/${r}/`);
  };
  return (
    <>
      <button onClick={() => setOpen(true)} className="rounded-full" aria-label={t("open")}><Avatar name={name} size={40} /></button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl p-0 pb-[env(safe-area-inset-bottom)]">
          <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-line-strong" aria-hidden />
          <div className="flex items-center gap-3 px-5 pt-4 pb-3">
            <Avatar name={name} size={44} />
            <div><SheetTitle className="text-base">{name}</SheetTitle><SheetDescription className="text-small">{subtitle}</SheetDescription></div>
          </div>
          <ul className="divide-y divide-line border-y border-line">
            <li className="flex items-center justify-between px-5 py-3">
              <span className="text-base text-fg">{t("language")}</span>
              <div className="flex rounded-md bg-surface-2 p-0.5" role="radiogroup" aria-label={t("language")}>
                {(["en", "ml"] as const).map((l) => (
                  <button key={l} role="radio" aria-checked={locale === l} onClick={() => setLocale(l)} className={cn("h-9 rounded-sm px-3 text-sm font-medium", locale === l ? "bg-surface text-fg shadow-sm dark:bg-surface-3" : "text-fg-2")}>{l === "en" ? "English" : "മലയാളം"}</button>
                ))}
              </div>
            </li>
            <li>
              <button onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")} className="flex w-full items-center justify-between px-5 py-3.5 text-base text-fg">
                {t("theme")} {resolvedTheme === "dark" ? <Moon className="size-5 text-fg-2" aria-hidden /> : <Sun className="size-5 text-fg-2" aria-hidden />}
              </button>
            </li>
          </ul>
          <p className="flex items-center gap-1.5 px-5 pt-4 pb-2 text-xs font-medium text-fg-3"><Repeat className="size-3.5" aria-hidden />{t("switch")}</p>
          <div className="grid grid-cols-2 gap-2 px-5 pb-5">
            {ROLES.map((r) => <button key={r} onClick={() => go(r)} className="h-11 rounded-lg border border-line bg-surface text-sm font-medium text-fg hover:bg-surface-2">{tr(r)}</button>)}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

export function NoticesList({ audience }: { audience: string }) {
  const t = useTranslations("mobile.notices");
  const { locale } = useLocale();
  const f = useFormat();
  const now = useNow(60000);
  const notices = useDemo((s) => s.notices);
  const list = notices.filter((n) => n.audience === "all" || n.audience === audience).sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.postedAt.localeCompare(a.postedAt));
  return (
    <ul className="space-y-3 px-4">
      {list.map((n) => (
        <li key={n.id} className="rounded-xl border border-line bg-surface p-4">
          <div className="flex items-center gap-2">
            <Badge variant={n.category === "maintenance" ? "warning" : n.category === "fees" ? "brand" : n.category === "safety" ? "danger" : "neutral"}>{t(`cat.${n.category}`)}</Badge>
            {n.pinned && <Pin className="size-3.5 text-fg-3" aria-label={t("pinned")} />}
            <time className="ml-auto text-xs text-fg-3">{f.relative(n.postedAt, now)}</time>
          </div>
          <p className="mt-2 text-base font-semibold text-fg">{locale === "ml" ? n.titleMl : n.title}</p>
          <p className="mt-1 text-sm text-fg-2">{locale === "ml" ? n.bodyMl : n.body}</p>
        </li>
      ))}
    </ul>
  );
}

export function RowLink({ href, icon: Icon, label, meta, tone = "neutral" }: { href: string; icon: React.ElementType; label: string; meta?: string; tone?: "neutral" | "brand" | "warning" | "danger" | "success" }) {
  const toneCls = { neutral: "bg-surface-2 text-fg-2", brand: "bg-brand-tint text-brand-tint-fg", warning: "bg-warning-tint text-warning-fg", danger: "bg-danger-tint text-danger-fg", success: "bg-success-tint text-success-fg" }[tone];
  return (
    <Link href={href} onClick={() => haptic()} className="flex items-center gap-3 px-4 py-3 active:bg-surface-2">
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", toneCls)}><Icon className="size-[18px]" aria-hidden /></span>
      <span className="min-w-0 flex-1"><span className="block truncate text-base text-fg">{label}</span>{meta && <span className="block truncate text-small text-fg-3">{meta}</span>}</span>
      <ChevronRight className="size-4 text-fg-3" aria-hidden />
    </Link>
  );
}
