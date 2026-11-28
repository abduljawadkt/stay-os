"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import {
  Bath, BedDouble, Bell, BookOpen, Camera, Check, CheckCircle2, ChevronRight, Clock, Copy, DoorOpen, Droplets, Lamp, Lock, MessageCircle, MessageSquareWarning,
  Phone, Plug, Shirt, Soup, Wifi, Wrench, X, CalendarClock, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { clockMode } from "@/lib/clock";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar } from "@/components/common/avatar";
import { LeaveChip } from "@/components/common/chips";
import { VegMark } from "@/components/mess/mess-screen";
import { AppHeader, MCard, SectionTitle } from "./shell";
import { BackButton, BellLink, NoticesList, ProfileButton } from "./common";
import { useDemo } from "@/lib/store";
import { useFormat, useNow, useNowISO } from "@/lib/hooks";
import { useLocale } from "@/lib/i18n";
import { haptic } from "@/lib/native";
import { MEALS, cutoffParts, cutoffPassed, invoiceState, isPlaceMeal, mealPlace, menuFor, rebates, roomById, sla, addDays as addDaysSel, curfewLabel } from "@/lib/selectors";
import { MealPlacePicker, usePlaceLabel } from "./meal-place";
import { todayISO } from "@/lib/clock";
import { demo } from "@/config/demo";
import { hostel, messMenu, type ComplaintCategory, type Meal } from "@/data";
import { cn } from "@/lib/utils";

function usePersona() {
  const residents = useDemo((s) => s.residents);
  return residents.find((r) => r.id === demo.residentId)!;
}

// ---------------- Home ----------------
export function ResidentHome() {
  const t = useTranslations("mobile.home");
  const tm = useTranslations("meals");
  const f = useFormat();
  const { locale } = useLocale();
  const r = usePersona();
  const invoices = useDemo((s) => s.invoices);
  const leaves = useDemo((s) => s.leaves);
  const notices = useDemo((s) => s.notices);
  const optOuts = useDemo((s) => s.optOuts);
  const toggleOptOut = useDemo((s) => s.toggleOptOut);
  const today = todayISO();
  const due = invoices.filter((i) => i.residentId === r.id && i.status === "unpaid").sort((a, b) => a.dueOn.localeCompare(b.dueOn));
  const total = due.reduce((a, i) => a + i.total, 0);
  const first = due[0];
  const st = first ? invoiceState(first, today) : null;
  const nowIso = useNowISO();
  const leave = leaves.find((l) => l.residentId === r.id && (l.status === "awaiting_parent" || (l.status === "approved" && l.to >= nowIso)));
  const menu = menuFor(today);
  const mine = optOuts.find((o) => o.residentId === r.id && o.date === today);
  const placeLabel = usePlaceLabel();
  const locked = (m: Meal) => cutoffPassed(m, today, nowIso);
  const unreadNotices = notices.filter((n) => n.postedAt.startsWith(today)).length;

  return (
    <>
      <AppHeader
        title={t("hi", { name: r.name.split(" ")[0] })}
        subtitle={t("where", { bed: r.bedId, hostel: hostel.name })}
        left={<ProfileButton name={r.name} subtitle={`${r.bedId} · ${r.institution.split(" · ")[1] ?? ""}`} />}
        right={<BellLink href="/resident/notices/" count={unreadNotices} />}
      />
      <MCard className={cn(first && st?.state === "overdue" && "border-danger/30")} data-tour="resident-dues">
        {first && st ? (
          <>
            <p className={cn("text-small font-medium", st.state === "overdue" ? "text-danger-fg" : "text-fg-2")}>
              {st.state === "overdue" ? t("overdue", { month: f.month(first.month), days: st.days }) : t("due", { month: f.month(first.month), date: f.day(first.dueOn) })}
            </p>
            <p className="mt-1 text-hero font-semibold tracking-[-0.025em] text-fg tnum">{f.inr(total)}</p>
            <p className="mt-0.5 text-small text-fg-3">{first.lines.filter((l) => l.kind !== "deposit").map((l) => `${l.kind === "rent" ? t("rent") : l.kind === "mess" ? t("mess") : t("rebate")} ${f.inr(l.amount)}`).join(" · ")}</p>
            <Button asChild variant="primary" size="xl" className="mt-4 w-full" data-tour="resident-pay">
              <Link href={`/resident/pay/?invoice=${first.id}`} onClick={() => haptic()}>{t("pay", { amount: f.inr(total) })}</Link>
            </Button>
            <p className="mt-2 text-center text-xs text-fg-3">{t("payHint")}</p>
          </>
        ) : (
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-full bg-success-tint text-success-fg"><CheckCircle2 className="size-6" aria-hidden /></span>
            <div><p className="text-base font-semibold text-fg">{t("allPaid")}</p><p className="text-small text-fg-2">{t("nextInvoice", { date: f.day(`${demo.nextMonth}-01`) })}</p></div>
          </div>
        )}
      </MCard>

      <div className="mx-4 mt-4 grid grid-cols-4 gap-2">
        {[
          { href: "/resident/gate/", icon: DoorOpen, label: t("q.gate") },
          { href: "/resident/mess/", icon: Soup, label: t("q.skip") },
          { href: "/resident/help/new/", icon: MessageSquareWarning, label: t("q.complaint") },
          { href: "/resident/notices/", icon: Bell, label: t("q.notices") },
        ].map((q) => (
          <Link key={q.href} href={q.href} onClick={() => haptic()} className="flex flex-col items-center gap-1.5 rounded-xl border border-line bg-surface px-1 py-3 text-center active:bg-surface-2">
            <span className="grid size-10 place-items-center rounded-full bg-brand-tint text-brand-tint-fg"><q.icon className="size-5" aria-hidden /></span>
            <span className="text-xs leading-tight font-medium text-fg">{q.label}</span>
          </Link>
        ))}
      </div>

      {leave && (
        <Link href="/resident/gate/" className="mx-4 mt-4 flex items-center gap-3 rounded-xl border border-line bg-surface p-4 active:bg-surface-2">
          <span className={cn("grid size-10 place-items-center rounded-full", leave.status === "approved" ? "bg-success-tint text-success-fg" : "bg-warning-tint text-warning-fg")}><CalendarClock className="size-5" aria-hidden /></span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-fg">{leave.status === "approved" ? t("passReady") : t("passWaiting", { parent: t(`rel.${r.parent.relation}`) })}</p>
            <p className="truncate text-xs text-fg-3">{leave.destination} · {f.day(leave.from)}, {f.time(leave.from)}</p>
          </div>
          <ChevronRight className="size-4 text-fg-3" aria-hidden />
        </Link>
      )}

      <SectionTitle action={<Link href="/resident/mess/" className="text-sm text-brand-text">{t("weekMenu")}</Link>}>{t("todayMenu")}</SectionTitle>
      <ul className="mx-4 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface" data-tour="resident-menu">
        {MEALS.map((m) => {
          const skipped = !!mine?.meals.includes(m);
          return (
            <li key={m} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-fg-3">
                  {tm(m)} · {messMenu.servingTimes[m]}
                  {isPlaceMeal(m) && !skipped && <> · <span className="font-medium text-fg-2">{placeLabel(mealPlace(mine, m), r.bedId)}</span></>}
                </p>
                <p className={cn("mt-0.5 flex items-center gap-1.5 truncate text-sm", skipped ? "text-fg-3 line-through" : "text-fg")}><VegMark veg={menu[m].veg} />{locale === "ml" ? menu[m].ml : menu[m].en}</p>
              </div>
              {locked(m) ? <span className="flex items-center gap-1 text-xs text-fg-3"><Lock className="size-3" aria-hidden />{skipped ? t("skipped") : t("locked")}</span> : (
                <Switch size="lg" checked={!skipped} onCheckedChange={() => { toggleOptOut(r.id, today, m); haptic(); }} aria-label={t("eatingAria", { meal: tm(m) })} data-tour={`resident-meal-${m}`} />
              )}
            </li>
          );
        })}
      </ul>
      <p className="mx-4 mt-2 text-xs text-fg-3">{t("skipHint")}</p>
    </>
  );
}

// ---------------- Room ----------------
export function ResidentRoom() {
  const t = useTranslations("mobile.room");
  const tr = useTranslations("roomType");
  const f = useFormat();
  const r = usePersona();
  const residents = useDemo((s) => s.residents);
  const room = roomById[r.bedId.split("-").slice(0, 2).join("-")];
  const mates = residents.filter((x) => x.id !== r.id && x.status !== "checked_out" && x.bedId.startsWith(`${room.id}-`));
  const block = r.bedId[0];
  const amenities = [
    { icon: Bath, label: room.bath === "attached" ? t("bathAttached") : t("bathCommon") },
    { icon: Wifi, label: t("wifiSpeed") },
    { icon: Lamp, label: t("studyTable") },
    { icon: Shirt, label: t("cupboard") },
    { icon: Droplets, label: t("hotWater") },
    { icon: Plug, label: t("sockets") },
  ];
  return (
    <>
      <AppHeader title={t("title", { room: room.id })} subtitle={t("subtitle", { type: tr(room.type), bed: r.bedId.split("-")[2], floor: room.floor })} />
      <MCard>
        <div className="flex items-center justify-between">
          <div><p className="text-small text-fg-2">{t("rent")}</p><p className="text-title font-semibold text-fg tnum">{f.inr(room.rent)}<span className="text-sm font-normal text-fg-3">{t("perMonth")}</span></p></div>
          <div className="text-right"><p className="text-small text-fg-2">{t("since")}</p><p className="text-sm font-medium text-fg tnum">{f.date(r.checkInDate)}</p></div>
        </div>
        <div className="mt-4 flex gap-2" role="img" aria-label={t("bedsAria", { count: room.capacity })}>
          {Array.from({ length: room.capacity }).map((_, i) => {
            const me = r.bedId.endsWith(`-${i + 1}`);
            return <div key={i} className={cn("grid h-14 flex-1 place-items-center rounded-lg text-xs font-medium", me ? "bg-brand text-white" : "bg-surface-2 text-fg-2")}><BedDouble className="mb-0.5 size-4" aria-hidden />{me ? t("you") : t("bedN", { n: i + 1 })}</div>;
          })}
        </div>
      </MCard>
      <SectionTitle>{t("roommates")}</SectionTitle>
      <ul className="mx-4 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
        {mates.length === 0 ? <li className="p-4 text-sm text-fg-2">{t("noMates")}</li> : mates.map((m) => (
          <li key={m.id} className="flex items-center gap-3 px-4 py-3">
            <Avatar name={m.name} size={40} />
            <div className="min-w-0 flex-1"><p className="truncate text-base text-fg">{m.name}</p><p className="truncate text-small text-fg-3">{m.institution}</p></div>
            <a href={`tel:${m.phone.replace(/\s/g, "")}`} className="grid size-10 place-items-center rounded-full bg-surface-2 text-fg-2" aria-label={t("call", { name: m.name })}><Phone className="size-[18px]" aria-hidden /></a>
          </li>
        ))}
      </ul>
      {clockMode() === "demo" && (
        <>
      <SectionTitle>{t("wifi")}</SectionTitle>
        <MCard className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-lg bg-brand-tint text-brand-tint-fg"><Wifi className="size-5" aria-hidden /></span>
          <div className="flex-1"><p className="font-mono text-sm text-fg">AlNoor-{block}</p><p className="font-mono text-small text-fg-3">alnoor@{room.id.replace("-", "").toLowerCase()}</p></div>
          <Button variant="secondary" size="sm" onClick={() => { navigator.clipboard?.writeText(`alnoor@${room.id.replace("-", "").toLowerCase()}`); toast(t("copied")); haptic(); }}><Copy /> {t("copy")}</Button>
        </MCard>
        </>
      )}
      <SectionTitle>{t("amenities")}</SectionTitle>
      <div className="mx-4 grid grid-cols-2 gap-2">
        {amenities.map((a) => <div key={a.label} className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2.5 text-small text-fg"><a.icon className="size-4 text-fg-3" aria-hidden />{a.label}</div>)}
      </div>
      <SectionTitle>{t("rules")}</SectionTitle>
      <MCard>
        <ul className="space-y-2 text-sm text-fg-2">
          <li className="flex gap-2"><Clock className="mt-0.5 size-4 shrink-0 text-fg-3" aria-hidden />{t("rule1", { time: curfewLabel(block) })}</li>
          <li className="flex gap-2"><BookOpen className="mt-0.5 size-4 shrink-0 text-fg-3" aria-hidden />{t("rule2")}</li>
          <li className="flex gap-2"><MessageCircle className="mt-0.5 size-4 shrink-0 text-fg-3" aria-hidden />{t("rule3")}</li>
        </ul>
      </MCard>
      <div className="h-4" />
    </>
  );
}

// ---------------- Mess ----------------
export function ResidentMess() {
  const t = useTranslations("mobile.mess");
  const tm = useTranslations("meals");
  const f = useFormat();
  const { locale } = useLocale();
  const r = usePersona();
  const optOuts = useDemo((s) => s.optOuts);
  const toggleOptOut = useDemo((s) => s.toggleOptOut);
  const setMealAt = useDemo((s) => s.setMealAt);
  const placeLabel = usePlaceLabel();
  const today = todayISO();
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysSel(today, i)), [today]);
  const [day, setDay] = useState(today);
  const menu = menuFor(day);
  const mine = optOuts.find((o) => o.residentId === r.id && o.date === day);
  const nowIso = useNowISO();
  // the hostel's own cut-offs (Settings → Hostel setup), on the day or the evening before
  const mealLocked = (m: Meal) => cutoffPassed(m, day, nowIso);
  const monthSkips = optOuts.filter((o) => o.residentId === r.id && o.date.startsWith(today.slice(0, 7)) && o.date <= today).reduce((a, o) => a + o.meals.length, 0);
  const myRebate = rebates(optOuts, today.slice(0, 7)).find((x) => x.residentId === r.id);
  const sp = messMenu.specials.find((s) => s.date === day);

  const skipWholeDays = () => {
    for (const d of [addDaysSel(today, 1), addDaysSel(today, 2)]) {
      const cur = optOuts.find((o) => o.residentId === r.id && o.date === d);
      for (const m of MEALS) if (!cur?.meals.includes(m)) toggleOptOut(r.id, d, m);
    }
    haptic("success");
    toast(t("weekendSkipped"));
  };

  return (
    <>
      <AppHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-1" role="tablist" aria-label={t("day")}>
        {days.map((d) => (
          <button key={d} role="tab" aria-selected={day === d} onClick={() => { setDay(d); haptic(); }} className={cn("flex h-16 w-14 shrink-0 flex-col items-center justify-center rounded-xl border text-center", day === d ? "border-brand bg-brand text-white" : "border-line bg-surface text-fg")}>
            <span className="text-[11px] font-medium opacity-80">{d === today ? t("today") : f.weekdayLong(d).slice(0, 3)}</span>
            <span className="text-lg font-semibold tnum">{Number(d.slice(8))}</span>
          </button>
        ))}
      </div>
      {sp && <p className="mx-4 mt-3 flex items-center gap-1.5 rounded-lg bg-brand-tint px-3 py-2 text-small text-brand-tint-fg"><Sparkles className="size-4" aria-hidden />{locale === "ml" ? sp.ml : sp.en}</p>}
      <ul className="mx-4 mt-3 space-y-2">
        {MEALS.map((m) => {
          const skipped = !!mine?.meals.includes(m);
          const passed = mealLocked(m);
          return (
            <li key={m} className={cn("rounded-xl border bg-surface p-4 transition-colors", skipped ? "border-line bg-surface-2/60" : "border-line")}>
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-fg-3">{tm(m)} · {messMenu.servingTimes[m]}</p>
                  <p className={cn("mt-1 flex items-start gap-1.5 text-base", skipped ? "text-fg-3 line-through" : "text-fg")}><VegMark veg={menu[m].veg} className="mt-1" />{locale === "ml" ? menu[m].ml : menu[m].en}</p>
                  <p className="mt-1 text-xs text-fg-3">{passed ? t("cutoffPassed") : (({ time, dayBefore }) => t(dayBefore ? "cutoffPrev" : "cutoff", { time }))(cutoffParts(messMenu.cutoffs[m]))}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Switch size="lg" checked={!skipped} disabled={passed} onCheckedChange={() => { toggleOptOut(r.id, day, m); haptic(); }} aria-label={t("eatingAria", { meal: tm(m) })} />
                  <span className={cn("text-[11px] font-medium", skipped ? "text-fg-3" : "text-brand-text")}>{skipped ? t("skipping") : t("eating")}</span>
                </div>
              </div>
              {isPlaceMeal(m) && !skipped && (
                <MealPlacePicker meal={m} optOut={mine} bedId={r.bedId} disabled={passed} onChange={(place) => {
                  setMealAt(r.id, day, m, place);
                  haptic();
                  toast(t("placeSet", { meal: tm(m), place: placeLabel(place, r.bedId), day: day === today ? t("today") : f.weekdayLong(day) }));
                }} />
              )}
            </li>
          );
        })}
      </ul>
      <MCard className="mt-4">
        <p className="text-sm font-medium text-fg">{t("goingHome")}</p>
        <p className="mt-0.5 text-small text-fg-2">{t("goingHomeBody")}</p>
        <Button variant="secondary" className="mt-3 w-full" size="lg" onClick={skipWholeDays}>{t("skipWeekend")}</Button>
      </MCard>
      <MCard className="mt-3 mb-4 flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-full bg-success-tint text-success-fg"><Soup className="size-5" aria-hidden /></span>
        <div className="flex-1"><p className="text-sm text-fg">{t("monthSkips", { count: monthSkips })}</p><p className="text-xs text-fg-3">{myRebate ? t("rebateEarned", { amount: f.inr(myRebate.amount) }) : t("rebateRule", { amount: f.inr(messMenu.rebatePerDay) })}</p></div>
      </MCard>
    </>
  );
}

// ---------------- Gate pass ----------------
const REASONS = ["home", "medical", "family", "college", "other"] as const;
export function ResidentGate() {
  const t = useTranslations("mobile.gate");
  const f = useFormat();
  const r = usePersona();
  const leaves = useDemo((s) => s.leaves);
  const requestLeave = useDemo((s) => s.requestLeave);
  const now = useNowISO();
  const mine = leaves.filter((l) => l.residentId === r.id);
  const active = mine.find((l) => l.status === "approved" && l.to >= now);
  const waiting = mine.find((l) => l.status === "awaiting_parent");
  const [formOpen, setFormOpen] = useState(false);
  const today = todayISO();
  const [from, setFrom] = useState(`${addDaysSel(today, 1)}T17:00`);
  const [to, setTo] = useState(`${addDaysSel(today, 3)}T19:00`);
  const [dest, setDest] = useState(r.hometown);
  const [reason, setReason] = useState<(typeof REASONS)[number]>("home");
  const [err, setErr] = useState<string | null>(null);
  const submit = () => {
    if (!dest.trim()) return setErr(t("errDest"));
    if (to <= from) return setErr(t("errDates"));
    requestLeave(r.id, { from: `${from}:00+05:30`, to: `${to}:00+05:30`, destination: dest.trim(), reason: t(`reason.${reason}`) });
    haptic("success");
    setFormOpen(false);
  };
  const qr = active ? `STAYOS-GATEPASS|${active.id}|${r.id}|${active.from}|${active.to}` : "";
  return (
    <>
      <AppHeader title={t("title")} subtitle={t("subtitle", { time: curfewLabel(r.bedId.split("-")[0]) })} />
      {active ? (
        <MCard className="flex flex-col items-center text-center" data-tour="resident-qr">
          <Badge variant="success"><CheckCircle2 aria-hidden />{t("approved", { parent: t(`rel.${r.parent.relation}`) })}</Badge>
          <div className="mt-4 rounded-xl bg-white p-3 ring-1 ring-line"><QRCodeSVG value={qr} size={196} level="M" /></div>
          <p className="mt-3 text-sm font-medium text-fg">{t("showAtGate")}</p>
          <p className="mt-1 text-small text-fg-2 tnum">{f.weekday(active.from)}, {f.time(active.from)} → {f.weekday(active.to)}, {f.time(active.to)}</p>
          <p className="text-xs text-fg-3">{active.destination} · {active.id}</p>
        </MCard>
      ) : waiting ? (
        <MCard data-tour="resident-waiting">
          <div className="flex items-center gap-2"><LeaveChip status="awaiting_parent" /><span className="text-xs text-fg-3">{waiting.id}</span></div>
          <p className="mt-3 text-base font-semibold text-fg">{t("waitingTitle", { parent: r.parent.name.split(" ")[0] })}</p>
          <p className="mt-1 text-small text-fg-2">{t("waitingBody")}</p>
          <ol className="mt-4 space-y-3 border-l border-line pl-4">
            <li className="relative text-sm text-fg"><span className="absolute top-1.5 -left-[21px] size-2.5 rounded-full bg-brand ring-4 ring-surface" aria-hidden />{t("step1", { time: f.time(waiting.requestedAt) })}</li>
            <li className="relative text-sm text-fg"><span className="absolute top-1.5 -left-[21px] size-2.5 rounded-full bg-brand ring-4 ring-surface" aria-hidden />{t("step2")}</li>
            <li className="relative text-sm text-fg-3"><span className="absolute top-1.5 -left-[21px] size-2.5 animate-pulse rounded-full bg-warning ring-4 ring-surface" aria-hidden />{t("step3")}</li>
          </ol>
          <p className="mt-4 text-small text-fg-2 tnum">{waiting.destination} · {f.weekday(waiting.from)}, {f.time(waiting.from)} → {f.weekday(waiting.to)}</p>
        </MCard>
      ) : null}

      {!formOpen ? (
        <div className="mx-4 mt-4">
          <Button variant={active || waiting ? "secondary" : "primary"} size="xl" className="w-full" onClick={() => setFormOpen(true)}><DoorOpen /> {t("request")}</Button>
        </div>
      ) : (
        <MCard className="mt-4 space-y-4">
          <div className="flex items-center justify-between"><p className="text-base font-semibold text-fg">{t("newRequest")}</p><Button variant="quiet" size="icon-sm" aria-label={t("close")} onClick={() => setFormOpen(false)}><X /></Button></div>
          <div className="grid gap-1.5"><Label htmlFor="gp-from">{t("leaving")}</Label><Input id="gp-from" type="datetime-local" value={from} onChange={(e) => { setFrom(e.target.value); setErr(null); }} className="h-11" /></div>
          <div className="grid gap-1.5"><Label htmlFor="gp-to">{t("returning")}</Label><Input id="gp-to" type="datetime-local" value={to} onChange={(e) => { setTo(e.target.value); setErr(null); }} className="h-11" /></div>
          <div className="grid gap-1.5"><Label htmlFor="gp-dest">{t("destination")}</Label><Input id="gp-dest" value={dest} onChange={(e) => { setDest(e.target.value); setErr(null); }} className="h-11" /></div>
          <fieldset><legend className="mb-2 text-small font-medium text-fg">{t("why")}</legend>
            <div className="flex flex-wrap gap-2">{REASONS.map((x) => <button key={x} type="button" onClick={() => setReason(x)} aria-pressed={reason === x} className={cn("h-9 rounded-full border px-3 text-sm", reason === x ? "border-brand bg-brand-tint text-brand-tint-fg" : "border-line text-fg-2")}>{t(`reason.${x}`)}</button>)}</div>
          </fieldset>
          {err && <p className="text-xs text-danger-fg" role="alert">{err}</p>}
          <Button variant="primary" size="xl" className="w-full" onClick={submit}>{t("send", { parent: r.parent.name.split(" ")[0] })}</Button>
          <p className="text-xs text-fg-3">{t("sendHint")}</p>
        </MCard>
      )}

      <SectionTitle>{t("history")}</SectionTitle>
      <ul className="mx-4 mb-4 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
        {mine.length === 0 ? <li className="p-4 text-sm text-fg-2">{t("noHistory")}</li> : mine.map((l) => (
          <li key={l.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1"><p className="truncate text-sm text-fg">{l.destination}</p><p className="text-xs text-fg-3 tnum">{f.day(l.from)} → {f.day(l.to)}</p></div>
            <LeaveChip status={l.status} />
          </li>
        ))}
      </ul>
    </>
  );
}

// ---------------- Help (complaints) ----------------
export function ResidentHelp() {
  const t = useTranslations("mobile.help");
  const tc = useTranslations("category");
  const f = useFormat();
  const now = useNow(15000);
  const r = usePersona();
  const complaints = useDemo((s) => s.complaints);
  const mine = complaints.filter((c) => c.residentId === r.id);
  return (
    <>
      <AppHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="mx-4"><Button asChild variant="primary" size="xl" className="w-full"><Link href="/resident/help/new/"><MessageSquareWarning /> {t("raise")}</Link></Button></div>
      <SectionTitle>{t("mine")}</SectionTitle>
      {mine.length === 0 ? <MCard><p className="text-sm text-fg-2">{t("none")}</p></MCard> : (
        <ul className="mx-4 space-y-2">
          {mine.map((c) => {
            const s = sla(c, now);
            return (
              <li key={c.id} className="rounded-xl border border-line bg-surface p-4">
                <div className="flex items-center gap-2"><span className="font-mono text-xs text-fg-3">{c.id}</span><Badge variant={c.status === "resolved" ? "success" : c.status === "in_progress" ? "brand" : "warning"} dot>{t(`status.${c.status}`)}</Badge></div>
                <p className="mt-1.5 text-base font-medium text-fg">{c.title}</p>
                <p className="text-small text-fg-3">{tc(c.category)} · {f.weekday(c.createdAt)}, {f.time(c.createdAt)}</p>
                {c.status !== "resolved" && <p className="mt-2 text-xs text-fg-2">{s.remaining > 0 ? t("eta", { time: f.duration(s.remaining) }) : t("late")}</p>}
              </li>
            );
          })}
        </ul>
      )}
      <MCard className="mt-4 mb-4 flex items-center gap-3">
        <MessageCircle className="size-5 fill-whatsapp text-whatsapp" aria-hidden />
        <p className="text-small text-fg-2">{t("waTip", { number: hostel.whatsapp })}</p>
      </MCard>
    </>
  );
}

const CAT_ICONS: Record<ComplaintCategory, React.ElementType> = { electrical: Plug, plumbing: Droplets, wifi: Wifi, housekeeping: Sparkles, mess: Soup, furniture: Lamp, other: Wrench };

export function ResidentNewComplaint() {
  const t = useTranslations("mobile.help");
  const tc = useTranslations("category");
  const r = usePersona();
  const addComplaint = useDemo((s) => s.addComplaint);
  const complaints = useDemo((s) => s.complaints);
  const [cat, setCat] = useState<ComplaintCategory | null>(null);
  const [desc, setDesc] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const onPhoto = (file?: File) => {
    if (!file) return;
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      // downscale so the photo stays small in demo storage
      const scale = Math.min(1, 640 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      setPhoto(c.toDataURL("image/jpeg", 0.72));
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };
  const submit = () => {
    if (!cat) return setErr(t("errCat"));
    if (desc.trim().length < 5) return setErr(t("errDesc"));
    const id = addComplaint({ residentId: r.id, category: cat, title: desc.trim().split(/[.\n]/)[0].slice(0, 60), description: desc.trim(), channel: "app", photo: photo ?? undefined });
    setCreated(id);
    haptic("success");
  };
  const c = created ? complaints.find((x) => x.id === created) : null;
  if (c) {
    return (
      <div className="flex min-h-[600px] flex-col items-center px-6 pt-16 text-center">
        <span className="grid size-16 place-items-center rounded-full bg-success-tint text-success-fg"><Check className="size-8" aria-hidden /></span>
        <p className="mt-5 text-[22px] font-semibold text-fg">{t("sent", { id: c.id })}</p>
        <p className="mt-2 text-sm text-fg-2">{t("sentBody", { hours: c.slaHours })}</p>
        <div className="mt-8 grid w-full gap-2"><Button asChild variant="primary" size="xl"><Link href="/resident/help/">{t("done")}</Link></Button></div>
      </div>
    );
  }
  return (
    <>
      <AppHeader title={t("newTitle")} left={<BackButton href="/resident/help/" label={t("back")} />} />
      <p className="mx-4 mb-2 text-small font-medium text-fg">{t("what")}</p>
      <div className="mx-4 grid grid-cols-4 gap-2" role="radiogroup" aria-label={t("what")}>
        {(Object.keys(CAT_ICONS) as ComplaintCategory[]).map((k) => {
          const Icon = CAT_ICONS[k];
          return (
            <button key={k} role="radio" aria-checked={cat === k} onClick={() => { setCat(k); setErr(null); haptic(); }} className={cn("flex flex-col items-center gap-1.5 rounded-xl border px-1 py-3 text-center", cat === k ? "border-brand bg-brand-tint text-brand-tint-fg" : "border-line bg-surface text-fg")}>
              <Icon className="size-5" aria-hidden /><span className="text-[11px] leading-tight font-medium">{tc(k)}</span>
            </button>
          );
        })}
      </div>
      <div className="mx-4 mt-5 grid gap-1.5">
        <Label htmlFor="cm-desc">{t("describe")}</Label>
        <Textarea id="cm-desc" rows={4} value={desc} onChange={(e) => { setDesc(e.target.value); setErr(null); }} placeholder={t("describePlaceholder")} className="text-base" />
      </div>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => onPhoto(e.target.files?.[0])} aria-label={t("addPhoto")} />
      <div className="mx-4 mt-4">
        {photo ? (
          <div className="relative overflow-hidden rounded-xl border border-line">
            <img src={photo} alt={t("photoAlt")} className="max-h-56 w-full object-cover" />
            <Button variant="secondary" size="sm" className="absolute top-2 right-2" onClick={() => setPhoto(null)}><X /> {t("remove")}</Button>
          </div>
        ) : (
          <button onClick={() => fileRef.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-xl border-[1.5px] border-dashed border-line-input py-5 text-sm font-medium text-fg-2 active:bg-surface-2"><Camera className="size-5" aria-hidden />{t("addPhoto")}</button>
        )}
      </div>
      {err && <p className="mx-4 mt-3 text-xs text-danger-fg" role="alert">{err}</p>}
      <div className="mx-4 mt-6 mb-4"><Button variant="primary" size="xl" className="w-full" onClick={submit}>{t("submit")}</Button></div>
    </>
  );
}

export function ResidentNotices() {
  const t = useTranslations("mobile.notices");
  const r = usePersona();
  return (
    <>
      <AppHeader title={t("title")} left={<BackButton href="/resident/" label={t("back")} />} />
      <NoticesList audience={r.bedId[0]} />
      <div className="h-4" />
    </>
  );
}

