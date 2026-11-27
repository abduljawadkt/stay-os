"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import {
  Check, ChevronRight, CloudOff, Download, IndianRupee, KeyRound, LogOut, MessageCircle, Play, Plus, QrCode, RotateCcw, Sparkles,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useDemo } from "@/lib/store";
import { isStaffRole, openOrg, signOut, useSession } from "@/lib/session";
import { useTour } from "@/components/tour/tour-store";
import { simulateGateScan, simulatePayment, simulateWhatsAppComplaint } from "@/lib/demo-actions";
import { useLocale } from "@/lib/i18n";
import { ChangePasswordDialog } from "@/components/auth/change-password";
import { installAvailable, useInstall } from "@/lib/install";
import { TOTAL_BEDS } from "@/lib/selectors";
import { planById } from "@/config/plans";
import { hostel } from "@/data";
import { NAV } from "./nav";
import { TABS } from "./mobile-nav";
import { useRoleNavigation, useViews } from "./role-switcher";
import { useSampleHostel } from "./demo-menu";
import { cn } from "@/lib/utils";
import { useOwnerView } from "@/components/common/owner-only";

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "H";

/** Everything that isn't a tab, as a native grouped list: other screens, demo tools, preferences, account. */
export function MoreScreen() {
  const t = useTranslations("account.more");
  const ti = useTranslations("account.install");
  const tn = useTranslations("nav");
  const ts = useTranslations("shell");
  const tr = useTranslations("roles");
  const tp = useTranslations("marketing.pricing.plans");
  const router = useRouter();
  const role = useDemo((s) => s.role);
  const ownerView = useOwnerView();
  const occupied = useDemo((s) => s.beds.filter((b) => b.status === "occupied").length);
  const residents = useDemo((s) => s.residents.filter((r) => r.status !== "checked_out").length);
  const offline = useDemo((s) => s.offline);
  const setOffline = useDemo((s) => s.setOffline);
  const openWhatsApp = useDemo((s) => s.openWhatsApp);
  const setAiOpen = useDemo((s) => s.setAiOpen);
  const reset = useDemo((s) => s.reset);
  const user = useSession((s) => s.user);
  const org = useSession((s) => s.org);
  const membership = useSession((s) => s.membership);
  const memberships = useSession((s) => s.memberships) ?? [];
  const staff = isStaffRole(membership?.role);
  const owner = membership?.role === "owner";
  const views = useViews();
  const go = useRoleNavigation();
  const startTour = useTour((s) => s.start);
  const { sample, canReset } = useSampleHostel();
  const { locale, setLocale } = useLocale();
  const { theme, setTheme } = useTheme();
  const install = useInstall();
  const canInstall = installAvailable(install);
  const [confirm, setConfirm] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const sharedDemoLogin = !!user?.email.endsWith("@demo.stayos.space");
  const [resetting, setResetting] = useState(false);

  const tabKeys = new Set<string>(TABS.map((x) => x.key));
  const screens = NAV.flatMap((g) => g.items).filter((i) => !tabKeys.has(i.key) && (ownerView || !i.ownerOnly) && (i.key !== "settings" || owner));
  const trialDays = org?.trial_ends_at ? Math.max(0, Math.ceil((new Date(org.trial_ends_at).getTime() - Date.now()) / 86400000)) : 0;
  const plan = org ? tp(`${planById(org.plan).id}.name`) : "";

  return (
    <div className="-mx-4 pb-6 sm:mx-0">
      <h1 className="px-4 pt-1 pb-4 text-[32px] leading-10 font-bold tracking-[-0.02em] text-fg sm:px-0">{t("title")}</h1>

      {/* hostel card */}
      <Link href={owner ? "/dashboard/settings/?tab=billing" : "/dashboard/"} className="mx-4 flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 active:bg-surface-2 sm:mx-0">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-brand-tint text-base font-semibold text-brand-tint-fg">{initials(hostel.name)}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[17px] font-semibold text-fg">{hostel.name}</span>
          <span className="line-clamp-2 block text-sm text-fg-2 tnum">{tn("hostelMeta", { beds: TOTAL_BEDS, occupied })}</span>
          {owner && org && (
            <span className={cn("mt-1 inline-flex items-center gap-1.5 text-xs font-medium", org.subscription_status === "trialing" ? "text-warning-fg" : "text-success-fg")}>
              <span className={cn("size-1.5 rounded-full", org.subscription_status === "trialing" ? "bg-warning" : "bg-success")} aria-hidden />
              {org.subscription_status === "trialing" ? t("trial", { plan, days: trialDays }) : t("active", { plan })}
            </span>
          )}
        </span>
        {owner && <ChevronRight className="size-5 shrink-0 text-fg-3" aria-hidden />}
      </Link>

      <Group title={t("screens")}>
        {screens.map((i) => (
          <Row key={i.key} href={i.href} icon={i.icon} label={tn(i.key)} value={i.key === "residents" ? String(residents) : undefined} />
        ))}
      </Group>

      {staff && (
        <Group title={t("demo")} footer={t("demoFooter")}>
          {views.length > 1 && (
            <div className="px-4 py-3">
              <p className="mb-2 text-sm text-fg-2">{tr("label")}</p>
              <Segmented value={role} options={views.map((v) => ({ value: v, label: tr(v) }))} onChange={(v) => go(v as typeof role)} />
            </div>
          )}
          {sample && <Row icon={Play} label={ts("guidedDemo")} onClick={() => { router.push("/dashboard/"); startTour(); }} />}
          <Row icon={MessageCircle} label={t("whatsapp")} onClick={() => openWhatsApp()} />
          <Row icon={Sparkles} label={t("ask")} onClick={() => setAiOpen(true)} />
          {sample && (
            <>
              <Row icon={IndianRupee} label={ts("simulatePayment")} onClick={() => simulatePayment()} />
              <Row icon={MessageCircle} label={ts("simulateComplaint")} onClick={() => { const { threadId } = simulateWhatsAppComplaint(); if (threadId) openWhatsApp(threadId); }} />
              <Row icon={QrCode} label={ts("simulateScan")} onClick={() => simulateGateScan()} />
            </>
          )}
          <Row icon={CloudOff} label={ts("simulateOffline")} onClick={() => setOffline(!offline)} checked={offline} />
          {canReset && <Row icon={RotateCcw} label={ts("resetDemo")} danger onClick={() => setConfirm(true)} />}
        </Group>
      )}

      <Group title={t("preferences")}>
        {canInstall && <Row icon={Download} label={ti("row")} sub={ti("rowSub")} onClick={() => install.setOpen(true)} />}
        <div className="px-4 py-3">
          <p className="mb-2 text-sm text-fg-2">{ts("language")}</p>
          <Segmented value={locale} options={[{ value: "en", label: "English" }, { value: "ml", label: "മലയാളം" }]} onChange={(v) => setLocale(v as "en" | "ml")} />
        </div>
        <div className="px-4 py-3">
          <p className="mb-2 text-sm text-fg-2">{t("appearance")}</p>
          <Segmented value={theme ?? "system"} options={[{ value: "light", label: t("light") }, { value: "dark", label: t("dark") }, { value: "system", label: t("system") }]} onChange={setTheme} />
        </div>
      </Group>

      <Group title={t("account")}>
        <div className="px-4 py-3">
          <p className="truncate text-[15px] font-medium text-fg">{user?.name || user?.email}</p>
          <p className="truncate text-sm text-fg-3">{user?.email}{membership ? ` · ${tr(membership.role)}` : ""}</p>
        </div>
        {memberships.length > 1 &&
          memberships.map((m) => (
            <Row
              key={m.orgId}
              label={m.orgName}
              sub={m.isDemo ? t("liveDemo") : tr(m.role)}
              avatar={initials(m.orgName)}
              trailing={m.orgId === membership?.orgId ? <Check className="size-5 text-brand-text" aria-label={t("current")} /> : undefined}
              onClick={() => {
                if (m.orgId === membership?.orgId) return;
                router.push(m.role === "resident" ? "/resident/" : m.role === "parent" ? "/parent/" : "/dashboard/");
                openOrg(m.orgId);
              }}
            />
          ))}
        {!sharedDemoLogin && <Row icon={KeyRound} label={t("changePassword")} onClick={() => setPwOpen(true)} />}
        <Row icon={Plus} label={t("addHostel")} href="/onboarding/?new=1" />
        <Row icon={LogOut} label={t("signOut")} danger onClick={async () => { await signOut(); router.replace("/login/"); }} />
      </Group>

      <ChangePasswordDialog open={pwOpen} onOpenChange={setPwOpen} />
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{ts("resetTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{ts("resetBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{ts("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={resetting}
              onClick={async (e) => {
                e.preventDefault();
                setResetting(true);
                try {
                  await reset();
                } finally {
                  setResetting(false);
                  setConfirm(false);
                }
              }}
            >
              {resetting ? ts("resetting") : ts("resetConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Group({ title, footer, children }: { title: string; footer?: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="mb-1.5 px-8 text-[13px] font-medium tracking-wide text-fg-3 uppercase sm:px-4">{title}</h2>
      <div className="mx-4 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface sm:mx-0">{children}</div>
      {footer && <p className="mt-1.5 px-8 text-[13px] text-fg-3 sm:px-4">{footer}</p>}
    </section>
  );
}

function Row({
  icon: Icon, avatar, label, sub, value, href, onClick, trailing, danger, checked,
}: { icon?: React.ElementType; avatar?: string; label: string; sub?: string; value?: string; href?: string; onClick?: () => void; trailing?: React.ReactNode; danger?: boolean; checked?: boolean }) {
  const toggle = checked !== undefined;
  const inner = (
    <>
      {Icon && (
        <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", danger ? "bg-danger-tint text-danger-fg" : "bg-surface-2 text-fg-2")}>
          <Icon className="size-[18px]" aria-hidden />
        </span>
      )}
      {avatar && <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-3 text-[11px] font-semibold text-fg-2">{avatar}</span>}
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate text-[16px]", danger ? "text-danger-fg" : "text-fg")}>{label}</span>
        {sub && <span className="block truncate text-[13px] text-fg-3">{sub}</span>}
      </span>
      {value && <span className="text-[15px] text-fg-3 tnum">{value}</span>}
      {toggle ? (
        <span aria-hidden className={cn("relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors", checked ? "bg-brand" : "bg-surface-3")}>
          <span className={cn("absolute top-0.5 size-[27px] rounded-full bg-white shadow-sm transition-[left]", checked ? "left-[22px]" : "left-0.5")} />
        </span>
      ) : (
        trailing ?? (href ? <ChevronRight className="size-5 shrink-0 text-fg-3" aria-hidden /> : null)
      )}
    </>
  );
  const cls = "flex min-h-[52px] w-full items-center gap-3 px-4 py-2 text-left active:bg-surface-2";
  if (href) return <Link href={href} className={cls}>{inner}</Link>;
  return (
    <button type="button" onClick={onClick} className={cls} {...(toggle ? { role: "switch", "aria-checked": checked } : {})}>
      {inner}
    </button>
  );
}

function Segmented({ value, options, onChange }: { value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <div role="radiogroup" className="grid rounded-[10px] bg-surface-2 p-0.5" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn("h-9 truncate rounded-lg px-2 text-[14px] font-medium transition-colors", value === o.value ? "bg-surface text-fg shadow-sm dark:bg-surface-3" : "text-fg-2")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
