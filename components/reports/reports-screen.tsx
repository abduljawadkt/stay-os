"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FileSpreadsheet, FileText, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardHeader, PageHeader } from "@/components/common/card";
import { ErrorState, Sk } from "@/components/common/states";
import { OwnerOnly } from "@/components/common/owner-only";
import { ChartTooltip, axisProps } from "@/components/dashboard/chart-bits";
import { Button } from "@/components/ui/button";
import { useDemo } from "@/lib/store";
import { useFormat, useScreenState } from "@/lib/hooks";
import { EXPENSE_CATEGORIES, collectionTrend, occupancy, occupancyTrend, pnl, prevMonth, monthSummary } from "@/lib/selectors";
import { downloadCsv } from "@/lib/export";
import { demo } from "@/config/demo";
import { hostel } from "@/data";
import { brand } from "@/config/brand";
import { cn } from "@/lib/utils";

export function ReportsScreen() {
  const role = useDemo((s) => s.role);
  if (role === "warden") return <OwnerOnly />;
  return <Reports />;
}

function Reports() {
  const t = useTranslations("reports");
  const tc = useTranslations("expenseCategory");
  const f = useFormat();
  const { loading, error, retry } = useScreenState("reports");
  const invoices = useDemo((s) => s.invoices);
  const expenses = useDemo((s) => s.expenses);
  const residents = useDemo((s) => s.residents);
  const beds = useDemo((s) => s.beds);
  const [month, setMonth] = useState<string>(demo.currentMonth);
  const cur = useMemo(() => pnl(invoices, expenses, month), [invoices, expenses, month]);
  const prev = useMemo(() => pnl(invoices, expenses, prevMonth(month)), [invoices, expenses, month]);
  const occ = useMemo(() => occupancyTrend(residents, hostel.months, occupancy(beds).rate).map((x) => ({ ...x, label: f.monthShort(x.month), pct: Math.round(x.rate * 1000) / 10 })), [residents, beds, f]);
  const coll = useMemo(() => collectionTrend(invoices, hostel.months).map((x) => ({ ...x, label: f.monthShort(x.month), pct: Math.round(x.rate * 1000) / 10 })), [invoices, f]);
  const sum = monthSummary(invoices, month);
  const hasPrev = hostel.months.includes(prevMonth(month));

  const rows: { label: string; cur: number; prev: number; kind?: "head" | "total" | "net" | "neg" }[] = [
    { label: t("revenue"), cur: 0, prev: 0, kind: "head" },
    { label: t("rent"), cur: cur.revenue.rent, prev: prev.revenue.rent },
    { label: t("mess"), cur: cur.revenue.mess, prev: prev.revenue.mess },
    { label: t("rebates"), cur: cur.revenue.rebate, prev: prev.revenue.rebate, kind: "neg" },
    { label: t("totalRevenue"), cur: cur.revenue.total, prev: prev.revenue.total, kind: "total" },
    { label: t("expenses"), cur: 0, prev: 0, kind: "head" },
    ...EXPENSE_CATEGORIES.map((c) => ({ label: tc(c), cur: cur.expenses.byCategory[c], prev: prev.expenses.byCategory[c] })),
    { label: t("totalExpenses"), cur: cur.expenses.total, prev: prev.expenses.total, kind: "total" as const },
    { label: t("net"), cur: cur.net, prev: prev.net, kind: "net" as const },
  ];

  const exportExcel = () => {
    downloadCsv(`${hostel.name.replace(/\s+/g, "_")}_PnL_${month}.csv`, [
      [`${hostel.name} · Profit & loss · ${f.month(month)}`], [],
      ["Line", f.month(month), f.month(prevMonth(month)), "Change"],
      ...rows.filter((r) => r.kind !== "head").map((r) => [r.label, r.cur, r.prev, r.prev ? `${(((r.cur - r.prev) / Math.abs(r.prev)) * 100).toFixed(1)}%` : ""]),
      [], ["Occupancy", ...occ.map((o) => `${f.monthShort(o.month)} ${o.pct}%`)],
      ["Collection rate", ...coll.map((o) => `${f.monthShort(o.month)} ${o.pct}%`)],
    ]);
    toast(t("exported"), { description: t("exportedSub") });
  };

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("subtitle", { hostel: hostel.name })}
        actions={
          <>
            <Button variant="secondary" onClick={exportExcel}><FileSpreadsheet /> {t("excel")}</Button>
            <Button variant="primary" onClick={() => { document.title = `${hostel.name} P&L ${month}`; window.print(); }}><FileText /> {t("pdf")}</Button>
          </>
        }
      />
      <div role="tablist" aria-label={t("month")} className="no-scrollbar mb-4 flex gap-1 overflow-x-auto">
        {hostel.months.map((m) => <button key={m} role="tab" aria-selected={month === m} onClick={() => setMonth(m)} className={cn("h-8 shrink-0 rounded-md px-3 text-small font-medium", month === m ? "bg-surface text-fg shadow-sm ring-1 ring-line" : "text-fg-2 hover:bg-surface-2 hover:text-fg")}>{f.month(m)}</button>)}
      </div>
      {error ? <Card><ErrorState what={t("what")} onRetry={retry} /></Card> : (
        <div className="grid gap-4 xl:grid-cols-5">
          <Card className="print-area xl:col-span-3">
            <CardHeader title={t("pnlTitle", { month: f.month(month) })} meta={month === demo.currentMonth ? t("pnlMetaMtd") : t("pnlMeta")} />
            {loading ? <div className="space-y-2 px-5 pb-5">{Array.from({ length: 12 }).map((_, i) => <Sk key={i} className="h-6" />)}</div> : (
              <table className="w-full text-sm">
                <thead><tr className="border-y border-line text-xs text-fg-2"><th className="py-2 pl-5 text-left font-medium" /><th className="px-3 text-right font-medium">{f.monthShort(month)}</th><th className="px-3 text-right font-medium">{hasPrev ? f.monthShort(prevMonth(month)) : "—"}</th><th className="py-2 pr-5 pl-3 text-right font-medium">{t("change")}</th></tr></thead>
                <tbody>
                  {rows.map((r) => {
                    if (r.kind === "head") return <tr key={r.label}><td colSpan={4} className="px-5 pt-4 pb-1 text-xs font-medium text-fg-3">{r.label}</td></tr>;
                    const ch = hasPrev && r.prev ? (r.cur - r.prev) / Math.abs(r.prev) : null;
                    const good = ch === null ? null : r.kind === "neg" || EXPENSE_CATEGORIES.some((c) => tc(c) === r.label) || r.label === t("totalExpenses") ? ch <= 0 : ch >= 0;
                    return (
                      <tr key={r.label} className={cn(r.kind === "total" && "border-t border-line font-medium", r.kind === "net" && "border-t-2 border-fg/80 text-base font-semibold")}>
                        <td className={cn("py-1.5 pr-3 pl-5", r.kind ? "text-fg" : "pl-8 text-fg-2")}>{r.label}</td>
                        <td className={cn("px-3 text-right tnum", r.kind === "net" ? (r.cur >= 0 ? "text-success-fg" : "text-danger-fg") : "text-fg")}>{f.inr(r.cur)}</td>
                        <td className="px-3 text-right text-fg-3 tnum">{hasPrev ? f.inr(r.prev) : "—"}</td>
                        <td className="py-1.5 pr-5 pl-3 text-right text-xs tnum">{ch === null ? "—" : <span className={cn("inline-flex items-center gap-0.5", good ? "text-success-fg" : "text-danger-fg")}>{ch >= 0 ? <TrendingUp className="size-3" aria-hidden /> : <TrendingDown className="size-3" aria-hidden />}{f.pct(Math.abs(ch))}</span>}</td>
                      </tr>
                    );
                  })}
                  <tr><td colSpan={4} className="px-5 pt-3 pb-4 text-xs text-fg-3">{t("margin", { margin: f.pct(cur.margin), pending: f.inr(sum.pending), brand: brand.name })}</td></tr>
                </tbody>
              </table>
            )}
          </Card>
          <div className="space-y-4 xl:col-span-2">
            <Card>
              <CardHeader title={t("occupancy")} meta={t("occupancyMeta", { now: `${occ[occ.length - 1].pct}%`, from: `${occ[0].pct}%` })} />
              <div className="h-[180px] px-2 pb-3">
                {loading ? <Sk className="mx-3 h-[160px]" /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={occ} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                      <defs><linearGradient id="occFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--brand)" stopOpacity={0.12} /><stop offset="1" stopColor="var(--brand)" stopOpacity={0} /></linearGradient></defs>
                      <CartesianGrid vertical={false} stroke="var(--line)" />
                      <XAxis dataKey="label" {...axisProps} />
                      <YAxis {...axisProps} width={40} domain={[70, 100]} tickFormatter={(v) => `${v}%`} />
                      <Tooltip cursor={{ stroke: "var(--line-strong)" }} content={(p) => <ChartTooltip {...(p as object)} rows={[{ key: "pct", name: t("occupancy"), color: "var(--brand)", format: (v) => `${v}%` }, { key: "count", name: t("beds"), color: "transparent", format: (v) => `${v} / 300` }]} />} />
                      <Area type="monotone" dataKey="pct" stroke="var(--brand)" strokeWidth={2} fill="url(#occFill)" dot={{ r: 3, fill: "var(--brand)", strokeWidth: 0 }} activeDot={{ r: 5, stroke: "var(--surface)", strokeWidth: 2 }} isAnimationActive={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>
            <Card>
              <CardHeader title={t("collection")} meta={t("collectionMeta")} />
              <div className="h-[180px] px-2 pb-3">
                {loading ? <Sk className="mx-3 h-[160px]" /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={coll} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="var(--line)" />
                      <XAxis dataKey="label" {...axisProps} />
                      <YAxis {...axisProps} width={40} domain={[80, 100]} tickFormatter={(v) => `${v}%`} />
                      <Tooltip cursor={{ stroke: "var(--line-strong)" }} content={(p) => <ChartTooltip {...(p as object)} rows={[{ key: "pct", name: t("collection"), color: "var(--brand)", format: (v) => `${v}%` }, { key: "collected", name: t("collected"), color: "transparent", format: f.inr }]} />} />
                      <Line type="monotone" dataKey="pct" stroke="var(--brand)" strokeWidth={2} dot={{ r: 3, fill: "var(--brand)", strokeWidth: 0 }} activeDot={{ r: 5, stroke: "var(--surface)", strokeWidth: 2 }} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
