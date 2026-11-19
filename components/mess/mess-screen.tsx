"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CalendarDays, ChefHat, Leaf, Lock, PiggyBank, Send, Sparkles, Unlock, UtensilsCrossed, Pencil } from "lucide-react";
import { Card, CardHeader, PageHeader } from "@/components/common/card";
import { EmptyState, ErrorState, Sk } from "@/components/common/states";
import { Avatar } from "@/components/common/avatar";
import { CountUp } from "@/components/common/count-up";
import { ChannelBadge } from "@/components/common/chips";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useDemo } from "@/lib/store";
import { useFormat, useNow, useScreenState } from "@/lib/hooks";
import { useLocale } from "@/lib/i18n";
import { MEALS, headcount, menuFor, messEnrolled, rebates, wasteSaved, daysInMonth, prevMonth } from "@/lib/selectors";
import { todayISO, toIST } from "@/lib/clock";
import { demo } from "@/config/demo";
import { messMenu, type Meal, type MenuItem } from "@/data";
import { cn } from "@/lib/utils";

export function VegMark({ veg, className }: { veg: boolean; className?: string }) {
  return (
    <span role="img" aria-label={veg ? "Veg" : "Non-veg"} className={cn("inline-grid size-3.5 shrink-0 place-items-center rounded-[2px] border-[1.5px]", veg ? "border-[#1b7a3a]" : "border-[#8a3b12]", className)}>
      {veg ? <span className="size-1.5 rounded-full bg-[#1b7a3a]" /> : <span className="h-0 w-0 border-x-[3.5px] border-b-[6px] border-x-transparent border-b-[#8a3b12]" />}
    </span>
  );
}

export function MessScreen() {
  const t = useTranslations("mess");
  const tm = useTranslations("meals");
  const f = useFormat();
  const { locale } = useLocale();
  const now = useNow(30000);
  const { loading, error, retry } = useScreenState("mess");
  const residents = useDemo((s) => s.residents);
  const optOuts = useDemo((s) => s.optOuts);
  const invoices = useDemo((s) => s.invoices);
  const today = todayISO();
  const month = demo.currentMonth;
  const [date, setDate] = useState(today);
  const [edits, setEdits] = useState<Record<string, string>>({});

  const hc = useMemo(() => headcount(residents, optOuts, today), [residents, optOuts, today]);
  const waste = useMemo(() => wasteSaved(optOuts, month, today), [optOuts, month, today]);
  const wasteYear = Math.round((waste.amount / Number(today.slice(8))) * 365);
  const rb = useMemo(() => rebates(optOuts, month), [optOuts, month]);
  const enrolled = messEnrolled(residents, today).length;
  const resById = useMemo(() => Object.fromEntries(residents.map((r) => [r.id, r])), [residents]);
  const nowHM = toIST(now).slice(11, 16);
  const cutoffPassed = (m: Meal) => m === "breakfast" || nowHM >= ({ lunch: "10:00", snacks: "14:00", dinner: "16:00" } as Record<string, string>)[m];
  const decRaised = invoices.some((i) => i.month === demo.nextMonth);

  const label = (item: MenuItem) => (locale === "ml" ? item.ml : item.en);

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("subtitle", { count: enrolled })}
        actions={<Button variant="primary" onClick={() => toast(t("sentToKitchen", { name: "Kunhimoideen" }), { description: hc.map((h) => `${tm(h.meal)} ${h.cooking}`).join(" · ") })}><Send /> {t("sendKitchen")}</Button>}
      />
      {error ? <Card><ErrorState what={t("what")} onRetry={retry} /></Card> : (
        <>
          <div className="grid gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2" data-tour="headcount">
              <CardHeader title={t("headcount.title", { date: f.weekday(today) })} meta={t("headcount.meta")} />
              <div className="grid grid-cols-2 gap-px overflow-hidden border-t border-line bg-line md:grid-cols-4">
                {hc.map((h) => {
                  const locked = cutoffPassed(h.meal);
                  return (
                    <div key={h.meal} className="bg-surface p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-small font-medium text-fg-2">{tm(h.meal)}</p>
                        <span className={cn("inline-flex items-center gap-1 text-xs", locked ? "text-fg-3" : "text-brand-text")}>
                          {locked ? <Lock className="size-3" aria-hidden /> : <Unlock className="size-3" aria-hidden />}{locked ? t("headcount.locked") : t("headcount.open", { time: messMenu.cutoffs[h.meal] })}
                        </span>
                      </div>
                      {loading ? <Sk className="mt-2 h-8 w-16" /> : <p className="mt-1 text-kpi font-semibold tracking-[-0.02em] text-fg tnum"><CountUp id={`hc-${h.meal}`} value={h.cooking} format={(v) => f.num(v)} /></p>}
                      <p className="text-xs text-fg-3 tnum">{t("headcount.of", { enrolled: h.enrolled, skipped: h.skipped })}</p>
                      <p className="mt-2 truncate text-xs text-fg-2" title={label(menuFor(today)[h.meal])}><VegMark veg={menuFor(today)[h.meal].veg} className="mr-1 align-[-2px]" />{label(menuFor(today)[h.meal])}</p>
                      <p className="text-xs text-fg-3">{messMenu.servingTimes[h.meal]}</p>
                    </div>
                  );
                })}
              </div>
            </Card>
            <Card data-tour="waste">
              <div className="p-5">
                <div className="flex items-center gap-1.5 text-small font-medium text-fg-2"><PiggyBank className="size-4 text-fg-3" aria-hidden /> {t("waste.title", { month: f.monthShort(month) })}</div>
                {loading ? <Sk className="mt-3 h-10 w-36" /> : <p className="mt-2 text-kpi font-semibold tracking-[-0.02em] text-success-fg tnum"><CountUp id="waste" value={waste.amount} format={f.inr} /></p>}
                <p className="mt-1 text-small text-fg-2">{t("waste.meals", { count: f.num(waste.meals) })}</p>
                <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-success-tint px-2 py-0.5 text-xs font-medium text-success-fg tnum">{t("waste.year", { amount: f.inrCompact(wasteYear) })}</p>
                <p className="mt-4 border-t border-line pt-3 text-xs text-fg-3">{t("waste.how", { b: f.inr(messMenu.plateCost.breakfast), l: f.inr(messMenu.plateCost.lunch), d: f.inr(messMenu.plateCost.dinner) })}</p>
              </div>
            </Card>
          </div>

          <Tabs defaultValue="week" className="mt-6">
            <TabsList variant="line" className="mb-4 w-full justify-start overflow-x-auto border-b border-line">
              <TabsTrigger value="week">{t("tabs.week")}</TabsTrigger>
              <TabsTrigger value="calendar">{t("tabs.calendar")}</TabsTrigger>
              <TabsTrigger value="optouts">{t("tabs.optouts")}</TabsTrigger>
              <TabsTrigger value="rebates">{t("tabs.rebates")}</TabsTrigger>
            </TabsList>

            <TabsContent value="week">
              <Card>
                <CardHeader title={t("week.title")} meta={t("week.meta")} />
                <div className="scrollbar-thin overflow-x-auto px-5 pb-5">
                  <table className="w-full min-w-[920px] table-fixed border-separate border-spacing-1 text-small">
                    <thead><tr>
                      <th className="w-24" />
                      {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                        const isToday = new Date(`${today}T12:00:00+05:30`).getDay() === d;
                        return <th key={d} scope="col" className={cn("rounded-md py-1.5 text-xs font-medium", isToday ? "bg-brand-tint text-brand-tint-fg" : "text-fg-2")}>{f.weekdayLong(dayDate(today, d)).slice(0, locale === "ml" ? 20 : 3)}{isToday && ` · ${t("week.today")}`}</th>;
                      })}
                    </tr></thead>
                    <tbody>
                      {MEALS.map((m) => (
                        <tr key={m}>
                          <th scope="row" className="pr-2 text-left align-top text-xs font-medium text-fg-2">{tm(m)}<span className="block font-normal text-fg-3">{messMenu.servingTimes[m]}</span></th>
                          {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                            const item = messMenu.menu.find((x) => x.day === d)![m];
                            const key = `${d}-${m}`;
                            const isToday = new Date(`${today}T12:00:00+05:30`).getDay() === d;
                            return (
                              <td key={d} className={cn("rounded-md border p-2 align-top", isToday ? "border-brand/40 bg-brand-tint/40" : "border-line")}>
                                <MenuCell value={edits[key] ?? label(item)} veg={item.veg} onSave={(v) => { setEdits({ ...edits, [key]: v }); toast(t("week.saved")); }} />
                                {m === "lunch" && d === 0 && messMenu.menu[0].special && <Badge variant="brand" className="mt-1.5"><Sparkles aria-hidden />{label(messMenu.menu[0].special)}</Badge>}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="calendar">
              <div className="grid gap-4 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                  <CardHeader title={f.month(month)} meta={t("cal.meta")} />
                  <MonthGrid month={month} today={today} selected={date} onSelect={setDate} optOuts={optOuts} />
                </Card>
                <DayPanel date={date} />
              </div>
            </TabsContent>

            <TabsContent value="optouts">
              <OptOutList date={date} setDate={setDate} resById={resById} />
            </TabsContent>

            <TabsContent value="rebates">
              <Card>
                <CardHeader title={t("rebates.title")} meta={t("rebates.rule", { amount: f.inr(messMenu.rebatePerDay), days: messMenu.rebateMinDays })} />
                {rb.length === 0 ? <EmptyState icon={PiggyBank} title={t("rebates.empty")} /> : (
                  <div className="scrollbar-thin overflow-x-auto">
                    <table className="w-full min-w-[640px] text-sm">
                      <thead><tr className="border-y border-line text-left text-xs text-fg-2">
                        <th className="py-2.5 pr-3 pl-5 font-medium">{t("rebates.resident")}</th><th className="px-3 font-medium">{t("rebates.away")}</th>
                        <th className="px-3 text-right font-medium">{t("rebates.amount")}</th><th className="py-2.5 pr-5 pl-3 font-medium">{t("rebates.status")}</th>
                      </tr></thead>
                      <tbody>
                        {rb.map((x) => (
                          <tr key={x.residentId} className="border-b border-line last:border-0">
                            <td className="py-2.5 pr-3 pl-5"><div className="flex items-center gap-2.5"><Avatar name={resById[x.residentId]?.name ?? ""} size={26} /><span className="font-medium text-fg">{resById[x.residentId]?.name}</span></div></td>
                            <td className="px-3 text-fg-2 tnum">{t("rebates.days", { count: x.days })} · {f.day(x.from)}–{f.day(x.to)}</td>
                            <td className="px-3 text-right font-medium text-success-fg tnum">−{f.inr(x.amount)}</td>
                            <td className="py-2.5 pr-5 pl-3">{decRaised ? <Badge variant="success">{t("rebates.applied")}</Badge> : <Badge variant="neutral">{t("rebates.willApply", { date: f.day(`${demo.nextMonth}-01`) })}</Badge>}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot><tr className="border-t border-line"><td className="py-2.5 pr-3 pl-5 text-small font-medium text-fg" colSpan={2}>{t("rebates.total", { count: rb.length })}</td><td className="px-3 text-right font-semibold text-success-fg tnum">−{f.inr(rb.reduce((a, x) => a + x.amount, 0))}</td><td /></tr></tfoot>
                    </table>
                  </div>
                )}
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </>
  );
}

function dayDate(today: string, dow: number) {
  const d = new Date(`${today}T12:00:00+05:30`);
  const diff = ((dow + 7 - d.getDay()) % 7) - (d.getDay() === 0 ? 0 : 0);
  return new Date(d.getTime() + diff * 86400000);
}

function MenuCell({ value, veg, onSave }: { value: string; veg: boolean; onSave: (v: string) => void }) {
  const t = useTranslations("mess.week");
  const [v, setV] = useState(value);
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setV(value); }}>
      <PopoverTrigger asChild>
        <button className="group flex w-full items-start gap-1.5 rounded-sm text-left text-fg">
          <VegMark veg={veg} className="mt-0.5" />
          <span className="flex-1 leading-snug">{value}</span>
          <Pencil className="mt-0.5 size-3 shrink-0 text-fg-3 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-label={t("edit")} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="start">
        <form onSubmit={(e) => { e.preventDefault(); if (v.trim()) { onSave(v.trim()); setOpen(false); } }} className="space-y-2">
          <label className="text-xs font-medium text-fg-2" htmlFor="dish">{t("dish")}</label>
          <Input id="dish" value={v} onChange={(e) => setV(e.target.value)} autoFocus />
          <div className="flex justify-end gap-2"><Button type="button" variant="quiet" size="sm" onClick={() => setOpen(false)}>{t("cancel")}</Button><Button type="submit" variant="primary" size="sm">{t("save")}</Button></div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

function MonthGrid({ month, today, selected, onSelect, optOuts }: { month: string; today: string; selected: string; onSelect: (d: string) => void; optOuts: ReturnType<typeof useDemo.getState>["optOuts"] }) {
  const t = useTranslations("mess.cal");
  const { locale } = useLocale();
  const f = useFormat();
  const days = daysInMonth(month);
  const first = new Date(`${month}-01T12:00:00+05:30`).getDay();
  const lead = (first + 6) % 7; // Monday first
  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const o of optOuts) if (o.date.startsWith(month)) m[o.date] = (m[o.date] ?? 0) + o.meals.length;
    return m;
  }, [optOuts, month]);
  const max = Math.max(...Object.values(counts), 1);
  const specials = Object.fromEntries(messMenu.specials.map((s) => [s.date, s]));
  return (
    <div className="px-5 pb-5">
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-fg-3">
        {[1, 2, 3, 4, 5, 6, 0].map((d) => <div key={d} className="py-1">{f.weekdayLong(dayDate(today, d)).slice(0, locale === "ml" ? 3 : 3)}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: lead }).map((_, i) => <div key={`l${i}`} />)}
        {Array.from({ length: days }).map((_, i) => {
          const d = `${month}-${String(i + 1).padStart(2, "0")}`;
          const c = counts[d] ?? 0;
          const sp = specials[d];
          const isToday = d === today;
          const future = d > today;
          return (
            <button
              key={d}
              onClick={() => onSelect(d)}
              aria-pressed={selected === d}
              aria-label={t("dayAria", { date: f.date(d), count: c })}
              className={cn("relative flex h-16 flex-col items-start rounded-md border p-1.5 text-left transition-colors sm:h-20", selected === d ? "border-brand ring-1 ring-brand" : "border-line hover:border-line-strong", isToday && "bg-brand-tint/40")}
            >
              <span className={cn("text-xs font-medium tnum", isToday ? "text-brand-text" : future ? "text-fg-3" : "text-fg")}>{i + 1}</span>
              {c > 0 && <span className="mt-auto inline-flex items-center gap-1 text-[11px] text-fg-2 tnum"><span className="size-1.5 rounded-full bg-chart-1" style={{ opacity: 0.35 + (c / max) * 0.65 }} aria-hidden />{c}</span>}
              {sp && <Sparkles className="absolute top-1.5 right-1.5 size-3 text-brand-text" aria-hidden />}
            </button>
          );
        })}
      </div>
      <p className="mt-3 flex flex-wrap items-center gap-4 text-xs text-fg-3">
        <span className="inline-flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-chart-1" aria-hidden /> {t("legendSkips")}</span>
        <span className="inline-flex items-center gap-1.5"><Sparkles className="size-3 text-brand-text" aria-hidden /> {t("legendSpecial")}</span>
      </p>
    </div>
  );
}

function DayPanel({ date }: { date: string }) {
  const t = useTranslations("mess.cal");
  const tm = useTranslations("meals");
  const f = useFormat();
  const { locale } = useLocale();
  const residents = useDemo((s) => s.residents);
  const optOuts = useDemo((s) => s.optOuts);
  const hc = useMemo(() => headcount(residents, optOuts, date), [residents, optOuts, date]);
  const menu = menuFor(date);
  const sp = messMenu.specials.find((s) => s.date === date);
  return (
    <Card>
      <CardHeader title={f.weekday(date)} meta={sp ? (locale === "ml" ? sp.ml : sp.en) : t("regular")} />
      <ul className="divide-y divide-line px-5 pb-4">
        {hc.map((h) => (
          <li key={h.meal} className="py-2.5">
            <div className="flex items-baseline justify-between text-sm"><span className="font-medium text-fg">{tm(h.meal)}</span><span className="text-fg tnum">{h.cooking}<span className="text-xs text-fg-3"> / {h.enrolled}</span></span></div>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-fg-2"><VegMark veg={menu[h.meal].veg} />{locale === "ml" ? menu[h.meal].ml : menu[h.meal].en}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function OptOutList({ date, setDate, resById }: { date: string; setDate: (d: string) => void; resById: Record<string, { name: string; bedId: string }> }) {
  const t = useTranslations("mess.optouts");
  const tm = useTranslations("meals");
  const f = useFormat();
  const optOuts = useDemo((s) => s.optOuts);
  const list = useMemo(() => optOuts.filter((o) => o.date === date).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [optOuts, date]);
  const today = todayISO();
  const days = [-2, -1, 0, 1, 2].map((n) => {
    const d = new Date(new Date(`${today}T12:00:00+05:30`).getTime() + n * 86400000);
    return new Date(d.getTime() + 330 * 60000).toISOString().slice(0, 10);
  });
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
        <CalendarDays className="size-4 text-fg-3" aria-hidden />
        <div role="tablist" aria-label={t("day")} className="flex gap-1">
          {days.map((d) => (
            <button key={d} role="tab" aria-selected={date === d} onClick={() => setDate(d)} className={cn("h-8 rounded-md px-2.5 text-small font-medium tnum transition-colors", date === d ? "bg-surface-2 text-fg" : "text-fg-2 hover:text-fg")}>
              {d === today ? t("today") : f.weekday(d)}
            </button>
          ))}
        </div>
        <span className="ml-auto text-small text-fg-2 tnum">{t("count", { count: list.length, meals: list.reduce((a, o) => a + o.meals.length, 0) })}</span>
      </div>
      {list.length === 0 ? <EmptyState icon={UtensilsCrossed} title={t("emptyTitle")} body={t("emptyBody")} /> : (
        <ul className="divide-y divide-line">
          {list.slice(0, 60).map((o) => (
            <li key={o.id} className="flex flex-wrap items-center gap-3 px-5 py-2.5 text-sm">
              <Avatar name={resById[o.residentId]?.name ?? ""} size={26} />
              <span className="min-w-40 flex-1 truncate font-medium text-fg">{resById[o.residentId]?.name} <span className="font-mono text-xs font-normal text-fg-3">{resById[o.residentId]?.bedId}</span></span>
              <span className="flex gap-1">{o.meals.map((m) => <Badge key={m} variant="neutral">{tm(m)}</Badge>)}</span>
              <span className="hidden w-48 truncate text-xs text-fg-2 md:block">{o.reason}</span>
              {o.source === "whatsapp" ? <ChannelBadge channel="whatsapp" /> : <ChannelBadge channel="app" />}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export const MessIcons = { ChefHat, Leaf };
