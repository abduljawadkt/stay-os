"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarClock, Check, CheckCircle2, LogIn, LogOut, Phone, Soup, Moon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/common/avatar";
import { LeaveChip } from "@/components/common/chips";
import { AppHeader, MCard, SectionTitle } from "./shell";
import { BackButton, BellLink, NoticesList, ProfileButton } from "./common";
import { useDemo } from "@/lib/store";
import { useFormat, useNow } from "@/lib/hooks";
import { haptic } from "@/lib/native";
import { invoiceState } from "@/lib/selectors";
import { todayISO } from "@/lib/clock";
import { demo } from "@/config/demo";
import { hostel, staff, type LeaveRequest } from "@/data";
import { cn } from "@/lib/utils";

function useChild() {
  const residents = useDemo((s) => s.residents);
  return residents.find((r) => r.id === demo.residentId)!;
}

function LeaveDecision({ l, compact }: { l: LeaveRequest; compact?: boolean }) {
  const t = useTranslations("mobile.parent");
  const f = useFormat();
  const decide = useDemo((s) => s.decideLeave);
  const child = useChild();
  return (
    <div data-tour="parent-approval">
      <p className="text-base font-semibold text-fg">{t("leaveAsk", { name: child.name.split(" ")[0] })}</p>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div><dt className="text-xs text-fg-3">{t("leaving")}</dt><dd className="text-fg tnum">{f.weekday(l.from)}, {f.time(l.from)}</dd></div>
        <div><dt className="text-xs text-fg-3">{t("back")}</dt><dd className="text-fg tnum">{f.weekday(l.to)}, {f.time(l.to)}</dd></div>
        <div><dt className="text-xs text-fg-3">{t("going")}</dt><dd className="text-fg">{l.destination}</dd></div>
        <div><dt className="text-xs text-fg-3">{t("reason")}</dt><dd className="text-fg">{l.reason}</dd></div>
      </dl>
      {!compact && <p className="mt-3 text-xs text-fg-3">{t("leaveNote")}</p>}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="secondary" size="xl" onClick={() => { decide(l.id, "rejected"); haptic("warning"); }}><X /> {t("reject")}</Button>
        <Button variant="primary" size="xl" onClick={() => { decide(l.id, "approved"); haptic("success"); }} data-tour="parent-approve"><Check /> {t("approve")}</Button>
      </div>
    </div>
  );
}

export function ParentHome() {
  const t = useTranslations("mobile.parent");
  const f = useFormat();
  const now = useNow(30000);
  const child = useChild();
  const gate = useDemo((s) => s.gate);
  const leaves = useDemo((s) => s.leaves);
  const invoices = useDemo((s) => s.invoices);
  const optOuts = useDemo((s) => s.optOuts);
  const notices = useDemo((s) => s.notices);
  const today = todayISO();
  const events = useMemo(() => gate.filter((g) => g.residentId === child.id).sort((a, b) => b.at.localeCompare(a.at)), [gate, child.id]);
  const last = events[0];
  const pending = leaves.find((l) => l.residentId === child.id && l.status === "awaiting_parent");
  const recentDecision = leaves.find((l) => l.residentId === child.id && l.status !== "awaiting_parent" && l.parentDecisionAt && new Date(l.parentDecisionAt).getTime() > now - 30 * 60000);
  const unpaid = invoices.filter((i) => i.residentId === child.id && i.status === "unpaid").sort((a, b) => a.dueOn.localeCompare(b.dueOn));
  const lastPaid = invoices.filter((i) => i.residentId === child.id && i.status === "paid").sort((a, b) => (b.paidOn ?? "").localeCompare(a.paidOn ?? ""))[0];
  const week = useMemo(() => {
    const since = new Date(new Date(`${today}T12:00:00+05:30`).getTime() - 7 * 86400000).toISOString().slice(0, 10);
    const skipped = optOuts.filter((o) => o.residentId === child.id && o.date >= since && o.date <= today).reduce((a, o) => a + o.meals.length, 0);
    return { meals: 28 - skipped, nights: 7 - leaves.filter((l) => l.residentId === child.id && l.status === "approved" && l.from >= since).length };
  }, [optOuts, events, leaves, child.id, today]);
  const blockWarden = hostel.blocks.find((b) => b.id === child.bedId.split("-")[0])?.wardenId;
  const warden = staff.find((s) => s.id === blockWarden) ?? staff.find((s) => s.role === "warden") ?? staff[0];

  return (
    <>
      <AppHeader
        title={t("hello", { name: child.parent.name.split(" ")[0] })}
        subtitle={t("subtitle", { hostel: hostel.name })}
        left={<ProfileButton name={child.parent.name} subtitle={t("parentOf", { name: child.name })} />}
        right={<BellLink href="/parent/notices/" count={notices.filter((n) => n.postedAt.startsWith(today)).length} />}
      />
      <MCard>
        <div className="flex items-center gap-3">
          <Avatar name={child.name} size={48} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold text-fg">{child.name}</p>
            <p className="truncate text-small text-fg-3">{child.institution}</p>
          </div>
        </div>
        {last && (
          <div className={cn("mt-4 flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm", last.type === "in" ? "bg-success-tint text-success-fg" : "bg-surface-2 text-fg")}>
            {last.type === "in" ? <LogIn className="size-4" aria-hidden /> : <LogOut className="size-4" aria-hidden />}
            {last.type === "in" ? t("inside", { time: `${last.at.startsWith(today) ? t("today") : t("yesterday")} ${f.time(last.at)}` }) : t("outside", { time: `${last.at.startsWith(today) ? t("today") : t("yesterday")} ${f.time(last.at)}` })}
          </div>
        )}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button asChild variant="secondary" size="lg"><a href={`tel:${child.phone.replace(/\s/g, "")}`}><Phone /> {t("callChild", { name: child.name.split(" ")[0] })}</a></Button>
          {warden && <Button asChild variant="secondary" size="lg"><a href={`tel:${warden.phone.replace(/\s/g, "")}`}><Phone /> {t("callWarden")}</a></Button>}
        </div>
      </MCard>

      <AnimatePresence>
        {pending && (
          <motion.section key={pending.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} className="mx-4 mt-4 rounded-xl border border-warning/40 bg-surface p-4">
            <Badge variant="warning" dot className="mb-2">{t("needsYou")}</Badge>
            <LeaveDecision l={pending} />
          </motion.section>
        )}
        {!pending && recentDecision && (
          <motion.section key="decided" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mx-4 mt-4 flex items-center gap-3 rounded-xl border border-line bg-surface p-4">
            <span className={cn("grid size-10 place-items-center rounded-full", recentDecision.status === "approved" ? "bg-success-tint text-success-fg" : "bg-danger-tint text-danger-fg")}>{recentDecision.status === "approved" ? <CheckCircle2 className="size-5" aria-hidden /> : <X className="size-5" aria-hidden />}</span>
            <p className="flex-1 text-sm text-fg">{recentDecision.status === "approved" ? t("approvedNote", { name: child.name.split(" ")[0] }) : t("rejectedNote")}</p>
          </motion.section>
        )}
      </AnimatePresence>

      <SectionTitle>{t("fees")}</SectionTitle>
      <MCard data-tour="parent-fees">
        {unpaid.length ? (() => {
          const inv = unpaid[0];
          const st = invoiceState(inv, today);
          const total = unpaid.reduce((a, i) => a + i.total, 0);
          return (
            <>
              <p className={cn("text-small font-medium", st.state === "overdue" ? "text-danger-fg" : "text-fg-2")}>{st.state === "overdue" ? t("feeOverdue", { month: f.month(inv.month), days: st.days }) : t("feeDue", { month: f.month(inv.month), date: f.day(inv.dueOn) })}</p>
              <p className="mt-1 text-[34px] leading-10 font-semibold tracking-[-0.02em] text-fg tnum">{f.inr(total)}</p>
              <Button asChild variant="primary" size="xl" className="mt-3 w-full"><Link href={`/parent/pay/?invoice=${inv.id}`} onClick={() => haptic()}>{t("payFor", { amount: f.inr(total), name: child.name.split(" ")[0] })}</Link></Button>
            </>
          );
        })() : (
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-full bg-success-tint text-success-fg"><CheckCircle2 className="size-5" aria-hidden /></span>
            <div><p className="text-base font-semibold text-fg">{t("feesClear")}</p>{lastPaid?.paidOn && <p className="text-small text-fg-3 tnum">{t("lastPaid", { amount: f.inr(lastPaid.total), date: f.day(lastPaid.paidOn) })}</p>}</div>
          </div>
        )}
      </MCard>

      <SectionTitle action={<Link href="/parent/alerts/" className="text-sm text-brand-text">{t("seeAll")}</Link>}>{t("alerts")}</SectionTitle>
      <ul className="mx-4 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
        {events.slice(0, 4).map((e) => (
          <li key={e.id} className="flex items-center gap-3 px-4 py-3">
            <span className={cn("grid size-8 place-items-center rounded-full", e.type === "in" ? "bg-success-tint text-success-fg" : "bg-surface-2 text-fg-2")}>{e.type === "in" ? <LogIn className="size-4" aria-hidden /> : <LogOut className="size-4" aria-hidden />}</span>
            <p className="flex-1 text-sm text-fg">{e.type === "in" ? t("cameIn", { name: child.name.split(" ")[0] }) : t("wentOut", { name: child.name.split(" ")[0] })}</p>
            <span className="text-xs text-fg-3 tnum">{f.relative(e.at, now)}</span>
          </li>
        ))}
      </ul>

      <SectionTitle>{t("week")}</SectionTitle>
      {/* parents see presence and meals; late entries stay with the warden */}
      <div className="mx-4 mb-4 grid grid-cols-2 gap-2">
        {[{ icon: Moon, v: `${week.nights}/7`, l: t("nights") }, { icon: Soup, v: week.meals, l: t("meals") }].map((s) => (
          <div key={s.l} className="rounded-xl border border-line bg-surface p-3 text-center">
            <s.icon className="mx-auto size-4 text-fg-3" aria-hidden />
            <p className="mt-1 text-title font-semibold text-fg tnum">{s.v}</p>
            <p className="text-[11px] text-fg-3">{s.l}</p>
          </div>
        ))}
      </div>
    </>
  );
}

export function ParentAlerts() {
  const t = useTranslations("mobile.parent");
  const f = useFormat();
  const child = useChild();
  const gate = useDemo((s) => s.gate);
  const events = gate.filter((g) => g.residentId === child.id).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 30);
  const today = todayISO();
  return (
    <>
      <AppHeader title={t("alertsTitle")} subtitle={t("alertsSubtitle", { name: child.name.split(" ")[0] })} />
      {events.length === 0 ? <MCard><p className="text-sm text-fg-2">{t("noAlerts")}</p></MCard> : (
        <ol className="mx-4 mb-4 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {events.map((e) => (
            <li key={e.id} className="flex items-center gap-3 px-4 py-3">
              <span className={cn("grid size-9 place-items-center rounded-full", e.type === "in" ? "bg-success-tint text-success-fg" : "bg-surface-2 text-fg-2")}>{e.type === "in" ? <LogIn className="size-4" aria-hidden /> : <LogOut className="size-4" aria-hidden />}</span>
              <div className="flex-1"><p className="text-sm text-fg">{e.type === "in" ? t("cameIn", { name: child.name.split(" ")[0] }) : t("wentOut", { name: child.name.split(" ")[0] })}</p><p className="text-xs text-fg-3">{e.passId ? t("onPass") : t("qrScan")}</p></div>
              <span className="text-xs text-fg-2 tnum">{e.at.startsWith(today) ? t("today") : f.weekday(e.at)}, {f.time(e.at)}</span>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

export function ParentLeave() {
  const t = useTranslations("mobile.parent");
  const f = useFormat();
  const child = useChild();
  const leaves = useDemo((s) => s.leaves);
  const mine = leaves.filter((l) => l.residentId === child.id);
  const pending = mine.filter((l) => l.status === "awaiting_parent");
  return (
    <>
      <AppHeader title={t("leaveTitle")} subtitle={t("leaveSubtitle", { name: child.name.split(" ")[0] })} />
      {pending.map((l) => <MCard key={l.id} className="mb-3 border-warning/40"><LeaveDecision l={l} /></MCard>)}
      <SectionTitle>{t("history")}</SectionTitle>
      <ul className="mx-4 mb-4 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
        {mine.filter((l) => l.status !== "awaiting_parent").length === 0 ? <li className="p-4 text-sm text-fg-2">{t("noHistory")}</li> : mine.filter((l) => l.status !== "awaiting_parent").map((l) => (
          <li key={l.id} className="flex items-center gap-3 px-4 py-3">
            <CalendarClock className="size-4 text-fg-3" aria-hidden />
            <div className="min-w-0 flex-1"><p className="truncate text-sm text-fg">{l.destination} · {l.reason}</p><p className="text-xs text-fg-3 tnum">{f.day(l.from)} → {f.day(l.to)}</p></div>
            <LeaveChip status={l.status} />
          </li>
        ))}
      </ul>
    </>
  );
}

export function ParentNotices() {
  const t = useTranslations("mobile.notices");
  const child = useChild();
  return (
    <>
      <AppHeader title={t("title")} left={<BackButton href="/parent/" label={t("back")} />} />
      <NoticesList audience={child.bedId[0]} />
      <div className="h-4" />
    </>
  );
}

