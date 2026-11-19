"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "framer-motion";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  AlarmClock, ArrowRight, BedDouble, BellRing, CalendarClock, CheckCircle2, ClipboardCheck, DoorOpen, FileWarning, IndianRupee, LogIn, LogOut,
  MessageCircle, MessageSquareWarning, ShieldAlert, Soup, TrendingUp, UserPlus, Users, Wallet,
} from "lucide-react";
import { Card, CardHeader, PageHeader } from "@/components/common/card";
import { KpiCard } from "@/components/common/kpi-card";
import { EmptyState, ErrorState, KpiSkeleton, Sk } from "@/components/common/states";
import { Avatar } from "@/components/common/avatar";
import { Button } from "@/components/ui/button";
import { ChartTooltip, LegendItem, axisProps } from "./chart-bits";
import { useDemo } from "@/lib/store";
import { useSession } from "@/lib/session";
import { useUI } from "@/components/shell/ui-store";
import { useFormat, useNow, useScreenState } from "@/lib/hooks";
import { aging, collectionTrend, headcount, monthSummary, occupancy, occupancyByBlock, occupancyTrend, overdueInvoices, pnl, presence, prevMonth, sla, blockGender } from "@/lib/selectors";
import { hostel, staff } from "@/data";
import { demo } from "@/config/demo";
import { toIST, todayISO } from "@/lib/clock";
import { cn } from "@/lib/utils";
import type { Activity } from "@/data";

export function HomeScreen() {
  const t = useTranslations("home");
  const f = useFormat();
  const now = useNow(30000);
  const { loading, error, retry } = useScreenState("home");
  const role = useDemo((s) => s.role);
  const userName = useSession((s) => s.user?.name ?? "");
  const beds = useDemo((s) => s.beds);
  const invoices = useDemo((s) => s.invoices);
  const expenses = useDemo((s) => s.expenses);
  const complaints = useDemo((s) => s.complaints);
  const residents = useDemo((s) => s.residents);
  const gate = useDemo((s) => s.gate);
  const leaves = useDemo((s) => s.leaves);
  const optOuts = useDemo((s) => s.optOuts);
  const today = todayISO();
  const month = demo.currentMonth;

  const d = useMemo(() => {
    const occ = occupancy(beds);
    const sum = monthSummary(invoices, month);
    const prev = monthSummary(invoices, prevMonth(month));
    const p = pnl(invoices, expenses, month);
    const pp = pnl(invoices, expenses, prevMonth(month));
    const open = complaints.filter((c) => c.status !== "resolved");
    const breached = open.filter((c) => sla(c, now).state === "breached");
    const trend = collectionTrend(invoices, hostel.months);
    const pres = presence(gate, residents, leaves, toIST(now));
    const hc = headcount(residents, optOuts, today);
    const occTrend = occupancyTrend(residents, hostel.months, occ.rate).map((x) => x.rate * 100);
    return { occ, sum, prev, p, pp, open, breached, trend, pres, hc, occTrend };
  }, [beds, invoices, expenses, complaints, gate, residents, leaves, optOuts, month, now, today]);

  const hour = Number(toIST(now).slice(11, 13));
  const greet = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  const warden = staff.find((s) => s.id === hostel.wardenId) ?? staff.find((s) => s.role === "warden");
  const name = (role === "warden" ? warden?.name.split(" ")[1] ?? warden?.name : hostel.owner.name.split(" ")[0]) || userName.split(" ")[0];
  const owner = role !== "warden";

  return (
    <>
      <PageHeader
        title={t(`greeting.${greet}`, { name })}
        description={t("subtitle", { date: f.weekday(now), hostel: hostel.name })}
        actions={
          <>
            <Button variant="secondary" onClick={() => useUI.getState().openCheckIn()}>
              <UserPlus /> {t("checkIn")}
            </Button>
          </>
        }
      />
      {error ? (
        <Card><ErrorState what={t("what")} onRetry={retry} /></Card>
      ) : (
        <>
          <div data-tour="kpis" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 2xl:grid-cols-6">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => <KpiSkeleton key={i} />)
            ) : owner ? (
              <>
                <KpiCard id="occupancy" icon={BedDouble} label={t("kpi.occupancy")} value={d.occ.rate * 100} format={(v) => `${v.toFixed(1)}%`} sub={t("kpi.occupancySub", { occupied: d.occ.occupied, total: d.occ.total })} spark={d.occTrend} />
                <KpiCard id="billed" icon={IndianRupee} label={t("kpi.billed", { month: f.monthShort(month) })} value={d.sum.billed} format={f.inrCompact} sub={t("kpi.billedSub", { count: d.sum.count })} />
                <KpiCard id="collected" icon={Wallet} label={t("kpi.collected")} value={d.sum.collected} format={f.inrCompact} sub={t("kpi.collectedSub", { rate: f.pct(d.sum.rate) })} delta={d.sum.rate - d.prev.rateInMonth} deltaLabel={t("kpi.vs", { value: f.pct(Math.abs(d.sum.rate - d.prev.rateInMonth)), month: f.monthShort(prevMonth(month)) })} />
                <KpiCard id="pending" icon={FileWarning} label={t("kpi.pending")} value={d.sum.pending} format={f.inrCompact} sub={t("kpi.pendingSub", { count: d.sum.unpaidCount })} />
                <KpiCard id="profit" icon={TrendingUp} label={t("kpi.netProfit")} value={d.p.net} format={f.inrCompact} sub={t("kpi.netProfitSub", { margin: f.pct(d.p.margin, 0) })} delta={d.pp.net ? (d.p.net - d.pp.net) / Math.abs(d.pp.net) : 0} deltaLabel={t("kpi.vs", { value: f.pct(Math.abs(d.pp.net ? (d.p.net - d.pp.net) / Math.abs(d.pp.net) : 0)), month: f.monthShort(prevMonth(month)) })} />
                <KpiCard id="complaints" icon={MessageSquareWarning} label={t("kpi.openComplaints")} value={d.open.length} format={(v) => f.num(v)} sub={t("kpi.openComplaintsSub", { count: d.breached.length })} />
              </>
            ) : (
              <>
                <KpiCard id="occupancy" icon={BedDouble} label={t("kpi.occupancy")} value={d.occ.rate * 100} format={(v) => `${v.toFixed(1)}%`} sub={t("kpi.occupancySub", { occupied: d.occ.occupied, total: d.occ.total })} />
                <KpiCard id="inside" icon={LogIn} label={t("kpi.inside")} value={d.pres.inside} format={(v) => f.num(v)} sub={t("kpi.insideSub")} />
                <KpiCard id="out" icon={LogOut} label={t("kpi.out")} value={d.pres.out} format={(v) => f.num(v)} sub={t("kpi.outSub")} />
                <KpiCard id="leave" icon={CalendarClock} label={t("kpi.onLeave")} value={d.pres.leave} format={(v) => f.num(v)} sub={t("kpi.onLeaveSub")} />
                <KpiCard id="lunch" icon={Soup} label={t("kpi.lunch")} value={d.hc[1].cooking} format={(v) => f.num(v)} sub={t("kpi.lunchSub", { count: d.hc[1].skipped })} />
                <KpiCard id="complaints" icon={MessageSquareWarning} label={t("kpi.openComplaints")} value={d.open.length} format={(v) => f.num(v)} sub={t("kpi.openComplaintsSub", { count: d.breached.length })} />
              </>
            )}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
            {owner ? <CollectionTrend data={d.trend} loading={loading} /> : <PresenceCard pres={d.pres} hc={d.hc} loading={loading} />}
            <NeedsAttention loading={loading} now={now} />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
            <ActivityFeed loading={loading} now={now} />
            <BlockOccupancy loading={loading} />
          </div>
        </>
      )}
    </>
  );
}

function CollectionTrend({ data, loading }: { data: ReturnType<typeof collectionTrend>; loading: boolean }) {
  const t = useTranslations("home");
  const f = useFormat();
  const rows = data.map((d) => ({ ...d, label: f.monthShort(d.month) }));
  const last = data[data.length - 1];
  return (
    <Card className="xl:col-span-2" data-tour="trend">
      <CardHeader
        title={t("trend.title")}
        meta={t("trend.meta", { rate: f.pct(data.slice(0, -1).reduce((a, d) => a + d.rate, 0) / (data.length - 1)) })}
        action={
          <div className="flex items-center gap-3">
            <LegendItem color="var(--line-strong)" label={t("trend.billed")} />
            <LegendItem color="var(--brand)" label={t("trend.collected")} />
          </div>
        }
      />
      <div className="h-[260px] px-2 pb-3">
        {loading ? (
          <Sk className="mx-3 h-[230px]" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} barGap={2} barCategoryGap="28%" margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--line)" />
              <XAxis dataKey="label" {...axisProps} dy={6} />
              <YAxis {...axisProps} width={56} tickFormatter={(v) => f.inrCompact(v)} />
              <Tooltip
                cursor={{ fill: "var(--surface-2)", radius: 6 }}
                content={(p) => (
                  <ChartTooltip
                    {...(p as object)}
                    labelFormat={(l) => l}
                    rows={[
                      { key: "billed", name: t("trend.billed"), color: "var(--line-strong)", format: f.inr },
                      { key: "collected", name: t("trend.collected"), color: "var(--brand)", format: f.inr },
                      { key: "rate", name: t("trend.rate"), color: "transparent", format: (v) => f.pct(v) },
                    ]}
                  />
                )}
              />
              <Bar dataKey="billed" fill="var(--line-strong)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="collected" fill="var(--brand)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
      <p className="sr-only">{t("trend.summary", { month: f.month(last.month), rate: f.pct(last.rate) })}</p>
    </Card>
  );
}

function PresenceCard({ pres, hc, loading }: { pres: { inside: number; out: number; leave: number }; hc: ReturnType<typeof headcount>; loading: boolean }) {
  const t = useTranslations("home");
  const tm = useTranslations("meals");
  const total = pres.inside + pres.out + pres.leave;
  return (
    <Card className="xl:col-span-2">
      <CardHeader title={t("today.title")} meta={t("today.meta")} action={<Button variant="quiet" size="sm" asChild><Link href="/dashboard/gate/">{t("today.open")} <ArrowRight /></Link></Button>} />
      <div className="grid gap-6 px-5 pb-5 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-small font-medium text-fg-2">{t("today.presence")}</p>
          {loading ? <Sk className="h-3 w-full" /> : (
            <div className="flex h-3 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={t("today.presenceAria", { inside: pres.inside, out: pres.out, leave: pres.leave })}>
              <div className="h-full bg-brand" style={{ width: `${(pres.inside / total) * 100}%` }} />
              <div className="h-full border-l-2 border-surface bg-line-input" style={{ width: `${(pres.out / total) * 100}%` }} />
              <div className="h-full border-l-2 border-surface bg-warning" style={{ width: `${(pres.leave / total) * 100}%` }} />
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-4">
            <LegendItem color="var(--brand)" label={`${t("kpi.inside")} · ${pres.inside}`} />
            <LegendItem color="var(--line-input)" label={`${t("kpi.out")} · ${pres.out}`} />
            <LegendItem color="var(--warning)" label={`${t("kpi.onLeave")} · ${pres.leave}`} />
          </div>
        </div>
        <div>
          <p className="mb-2 text-small font-medium text-fg-2">{t("today.kitchen")}</p>
          <ul className="space-y-1.5">
            {hc.map((h) => (
              <li key={h.meal} className="flex items-center justify-between text-sm">
                <span className="text-fg-2">{tm(h.meal)}</span>
                <span className="font-medium text-fg tnum">{h.cooking} <span className="text-xs font-normal text-fg-3">/ {h.enrolled}</span></span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  );
}

function NeedsAttention({ loading, now }: { loading: boolean; now: number }) {
  const t = useTranslations("home.attention");
  const invoices = useDemo((s) => s.invoices);
  const complaints = useDemo((s) => s.complaints);
  const leaves = useDemo((s) => s.leaves);
  const beds = useDemo((s) => s.beds);
  const residents = useDemo((s) => s.residents);
  const gate = useDemo((s) => s.gate);
  const today = todayISO();
  const items = useMemo(() => {
    const ag = aging(invoices, today);
    const over30 = ag[2].count + ag[3].count;
    const over30Amt = ag[2].amount + ag[3].amount;
    const breached = complaints.filter((c) => c.status !== "resolved" && sla(c, now).state === "breached").length;
    const awaiting = leaves.filter((l) => l.status === "awaiting_parent").length;
    const arrivals = beds.filter((b) => b.status === "reserved" && b.reservation && b.reservation.from <= addDaysLocal(today, 7)).length;
    const cur = residents.filter((r) => r.status !== "checked_out");
    const kyc = cur.filter((r) => r.kyc.status === "pending").length;
    const police = cur.filter((r) => r.police.status === "pending").length;
    const yday = addDaysLocal(today, -1);
    const late = gate.filter((g) => g.late && (g.at.startsWith(yday) || g.at.startsWith(today))).length;
    const leaving = cur.filter((r) => r.status === "notice" && r.checkOutDate && r.checkOutDate <= `${today.slice(0, 7)}-31`).length;
    const overdueAll = overdueInvoices(invoices, today).length;
    return [
      { key: "overdue30", count: over30, tone: "danger", icon: AlarmClock, href: "/dashboard/rent/?bucket=b3", values: { amount: over30Amt } },
      { key: "sla", count: breached, tone: "danger", icon: MessageSquareWarning, href: "/dashboard/complaints/" },
      { key: "overdue", count: overdueAll, tone: "warning", icon: BellRing, href: "/dashboard/rent/?filter=overdue" },
      { key: "leaves", count: awaiting, tone: "warning", icon: ClipboardCheck, href: "/dashboard/gate/?tab=leaves" },
      { key: "late", count: late, tone: "warning", icon: DoorOpen, href: "/dashboard/gate/?tab=late" },
      { key: "kyc", count: kyc, tone: "warning", icon: ShieldAlert, href: "/dashboard/residents/?filter=kyc" },
      { key: "police", count: police, tone: "neutral", icon: FileWarning, href: "/dashboard/residents/?filter=police" },
      { key: "arrivals", count: arrivals, tone: "brand", icon: UserPlus, href: "/dashboard/rooms/" },
      { key: "leaving", count: leaving, tone: "neutral", icon: LogOut, href: "/dashboard/residents/?filter=notice" },
    ].filter((i) => i.count > 0);
  }, [invoices, complaints, leaves, beds, residents, gate, today, now]);
  const f = useFormat();
  const tone: Record<string, string> = { danger: "bg-danger-tint text-danger-fg", warning: "bg-warning-tint text-warning-fg", brand: "bg-brand-tint text-brand-tint-fg", neutral: "bg-surface-2 text-fg-2" };
  return (
    <Card data-tour="attention">
      <CardHeader title={t("title")} meta={loading ? undefined : t("meta", { count: items.length })} />
      {loading ? (
        <div className="space-y-3 px-5 pb-5">{Array.from({ length: 5 }).map((_, i) => <Sk key={i} className="h-9" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState icon={CheckCircle2} title={t("emptyTitle")} body={t("emptyBody")} />
      ) : (
        <ul className="px-2 pb-2">
          {items.map((i) => (
            <li key={i.key}>
              <Link href={i.href} className="group flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-surface-2">
                <span className={cn("grid size-8 shrink-0 place-items-center rounded-md", tone[i.tone])}>
                  <i.icon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1 text-sm text-fg">
                  {t(`items.${i.key}`, { count: i.count, amount: f.inrCompact((i.values?.amount as number) ?? 0) })}
                </span>
                <ArrowRight className="size-4 shrink-0 text-fg-3 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function addDaysLocal(d: string, n: number) {
  const x = new Date(new Date(`${d}T12:00:00+05:30`).getTime() + n * 86400000);
  return new Date(x.getTime() + 330 * 60000).toISOString().slice(0, 10);
}

const FEED_ICON: Record<Activity["kind"], React.ElementType> = {
  payment: IndianRupee, gate_in: LogIn, gate_out: LogOut, complaint: MessageSquareWarning, complaint_resolved: CheckCircle2, optout: Soup, visitor: Users,
  leave_request: CalendarClock, leave_approved: CheckCircle2, leave_rejected: CalendarClock, checkin: UserPlus, invoices_raised: IndianRupee, reminders_sent: MessageCircle, bed_moved: BedDouble,
};

export function ActivityFeed({ loading, now, limit = 9, className }: { loading: boolean; now: number; limit?: number; className?: string }) {
  const t = useTranslations("home.feed");
  const tm = useTranslations("meals");
  const tc = useTranslations("channel");
  const f = useFormat();
  const activity = useDemo((s) => s.activity);
  const residents = useDemo((s) => s.residents);
  const byId = useMemo(() => Object.fromEntries(residents.map((r) => [r.id, r])), [residents]);
  const items = activity.slice(0, limit);
  return (
    <Card className={cn("xl:col-span-2", className)} data-tour="feed">
      <CardHeader
        title={t("title")}
        action={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success-tint px-2 py-0.5 text-xs font-medium text-success-fg">
            <span className="live-dot size-1.5 rounded-full bg-success" aria-hidden /> {t("live")}
          </span>
        }
      />
      {loading ? (
        <div className="space-y-3 px-5 pb-5">{Array.from({ length: 6 }).map((_, i) => <Sk key={i} className="h-8" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState icon={BellRing} title={t("emptyTitle")} body={t("emptyBody")} />
      ) : (
        <ul className="px-5 pb-3" aria-live="polite">
          <AnimatePresence initial={false}>
            {items.map((a) => {
              const r = a.residentId ? byId[a.residentId] : undefined;
              const Icon = FEED_ICON[a.kind];
              const values = {
                name: r?.name ?? "", amount: a.amount ? f.inr(a.amount) : "", method: (a.method ?? "").toUpperCase(), channel: a.channel ? tc(a.channel) : "",
                meals: (a.meals ?? []).map((m) => tm(m)).join(", "), visitor: a.visitorName ?? "", count: a.count ?? 0, month: a.month ? f.month(a.month) : "", from: a.fromBed ?? "", to: a.toBed ?? "", bed: a.toBed ?? "",
              };
              return (
                <motion.li
                  key={a.id}
                  layout
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }}
                  className="flex items-center gap-3 border-b border-line py-2.5 last:border-0"
                >
                  {r ? <Avatar name={r.name} size={28} /> : <span className="grid size-7 place-items-center rounded-full bg-surface-2 text-fg-2"><Icon className="size-3.5" aria-hidden /></span>}
                  <p className="min-w-0 flex-1 truncate text-sm text-fg">{t(a.kind, values)}</p>
                  <Icon className="hidden size-3.5 shrink-0 text-fg-3 sm:block" aria-hidden />
                  <time dateTime={a.at} className="w-20 shrink-0 text-right text-xs text-fg-3 tnum">{f.relative(a.at, now)}</time>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </Card>
  );
}

function BlockOccupancy({ loading }: { loading: boolean }) {
  const t = useTranslations("home.blocks");
  const tb = useTranslations("bedStatus");
  const tg = useTranslations("blockGender");
  const beds = useDemo((s) => s.beds);
  const rows = useMemo(() => occupancyByBlock(beds), [beds]);
  const seg = [
    { key: "occupied", color: "var(--brand)" },
    { key: "reserved", color: "var(--warning)" },
    { key: "maintenance", color: "var(--line-input)" },
    { key: "vacant", color: "var(--surface-3)" },
  ] as const;
  return (
    <Card>
      <CardHeader title={t("title")} action={<Button variant="quiet" size="sm" asChild><Link href="/dashboard/rooms/">{t("open")} <ArrowRight /></Link></Button>} />
      <div className="space-y-4 px-5 pb-5">
        {rows.map((r) => (
          <div key={r.block}>
            <div className="mb-1.5 flex items-baseline justify-between text-sm">
              <span className="font-medium text-fg">{t("block", { block: r.block })} <span className="text-xs font-normal text-fg-3">· {tg(blockGender(r.block))}</span></span>
              <span className="text-fg-2 tnum">{loading ? "—" : `${Math.round(r.rate * 100)}% · ${r.occupied}/${r.total}`}</span>
            </div>
            {loading ? <Sk className="h-2.5" /> : (
              <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={seg.map((s) => `${tb(s.key)} ${r[s.key]}`).join(", ")}>
                {seg.map((s) => r[s.key] > 0 && <div key={s.key} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(r[s.key] / r.total) * 100}%`, background: s.color }} />)}
              </div>
            )}
          </div>
        ))}
        <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1">
          {seg.map((s) => <LegendItem key={s.key} color={s.color} label={tb(s.key)} />)}
        </div>
      </div>
    </Card>
  );
}
