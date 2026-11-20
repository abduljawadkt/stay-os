"use client";

import { useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download, FileText, Loader2, Paperclip, Plus, ReceiptText, ScanLine, Upload, CalendarClock } from "lucide-react";
import { Card, CardHeader, PageHeader } from "@/components/common/card";
import { EmptyState, ErrorState, Sk, TableSkeleton } from "@/components/common/states";
import { OwnerOnly } from "@/components/common/owner-only";
import { ChartTooltip, LegendItem, axisProps } from "@/components/dashboard/chart-bits";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDemo } from "@/lib/store";
import { useFormat, useScreenState } from "@/lib/hooks";
import { EXPENSE_CATEGORIES, expensesByCategory, prevMonth } from "@/lib/selectors";
import { todayISO } from "@/lib/clock";
import { downloadCsv } from "@/lib/export";
import { demo } from "@/config/demo";
import { hostel, type Expense, type ExpenseCategory } from "@/data";
import { cn } from "@/lib/utils";

const COLOR: Record<ExpenseCategory, string> = { food: "var(--chart-1)", electricity: "var(--chart-2)", water: "var(--chart-3)", salaries: "var(--chart-4)", maintenance: "var(--chart-5)", internet: "var(--chart-6)" };

export function ExpensesScreen() {
  const role = useDemo((s) => s.role);
  if (role === "warden") return <OwnerOnly />;
  return <Expenses />;
}

function Expenses() {
  const t = useTranslations("expenses");
  const tc = useTranslations("expenseCategory");
  const tm = useTranslations("method");
  const f = useFormat();
  const { loading, error, retry } = useScreenState("expenses");
  const expenses = useDemo((s) => s.expenses);
  const [month, setMonth] = useState<string>(demo.currentMonth);
  const [cat, setCat] = useState<string>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [receipt, setReceipt] = useState<Expense | null>(null);
  const cur = useMemo(() => expensesByCategory(expenses, month), [expenses, month]);
  const prev = useMemo(() => expensesByCategory(expenses, prevMonth(month)), [expenses, month]);
  const delta = prev.total ? (cur.total - prev.total) / prev.total : 0;
  const donut = EXPENSE_CATEGORIES.map((c) => ({ key: c, name: tc(c), value: cur.byCategory[c] }));
  const compare = EXPENSE_CATEGORIES.map((c) => ({ key: c, name: tc(c), current: cur.byCategory[c], previous: prev.byCategory[c] }));
  const list = useMemo(() => expenses.filter((e) => e.date.startsWith(month) && (cat === "all" || e.category === cat)).sort((a, b) => b.date.localeCompare(a.date)), [expenses, month, cat]);
  const missing = list.filter((e) => !e.receipt && e.category !== "salaries").length;

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("subtitle", { amount: f.inr(cur.total), month: f.month(month), delta: `${delta >= 0 ? "+" : "−"}${f.pct(Math.abs(delta))}`, prev: f.monthShort(prevMonth(month)) })}
        actions={
          <>
            <Button variant="secondary" onClick={() => downloadCsv(`expenses_${month}.csv`, [["Date", "Vendor", "Description", "Category", "Amount", "Mode", "Receipt", "Status"], ...list.map((e) => [e.date, e.vendor, e.description, e.category, e.amount, e.mode, e.receipt?.fileName ?? "", e.status])])}><Download /> {t("export")}</Button>
            <Button variant="primary" onClick={() => setAddOpen(true)}><Plus /> {t("add")}</Button>
          </>
        }
      />
      <div role="tablist" aria-label={t("month")} className="no-scrollbar mb-4 flex gap-1 overflow-x-auto">
        {hostel.months.map((m) => <button key={m} role="tab" aria-selected={month === m} onClick={() => setMonth(m)} className={cn("h-8 shrink-0 rounded-md px-3 text-small font-medium", month === m ? "bg-surface text-fg shadow-sm ring-1 ring-line" : "text-fg-2 hover:bg-surface-2 hover:text-fg")}>{f.month(m)}</button>)}
      </div>
      {error ? <Card><ErrorState what={t("what")} onRetry={retry} /></Card> : (
        <>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
            <Card className="xl:col-span-2">
              <CardHeader title={t("byCategory")} meta={t("byCategoryMeta")} />
              <div className="flex flex-col items-center gap-4 px-5 pb-5 sm:flex-row">
                <div className="relative size-[200px] shrink-0">
                  {loading ? <Sk className="size-full rounded-full" /> : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={donut} dataKey="value" nameKey="name" innerRadius="70%" outerRadius="100%" paddingAngle={1} stroke="var(--surface)" strokeWidth={2} isAnimationActive={false}>
                          {donut.map((d) => <Cell key={d.key} fill={COLOR[d.key]} />)}
                        </Pie>
                        <Tooltip content={(p) => <ChartTooltip {...(p as object)} labelFormat={() => ""} rows={[{ key: "value", name: String((p as unknown as { payload?: readonly { name?: string }[] }).payload?.[0]?.name ?? ""), color: "transparent", format: f.inr }]} />} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                  <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                    <div><p className="text-xs text-fg-3">{t("total")}</p><p className="text-title font-semibold text-fg tnum">{f.inrCompact(cur.total)}</p></div>
                  </div>
                </div>
                <ul className="w-full space-y-2">
                  {donut.map((d) => (
                    <li key={d.key} className="flex items-center gap-2 text-sm">
                      <span className="size-2.5 shrink-0 rounded-xs" style={{ background: COLOR[d.key] }} aria-hidden />
                      <span className="flex-1 truncate text-fg-2">{d.name}</span>
                      <span className="text-fg tnum">{f.inrCompact(d.value)}</span>
                      <span className="w-11 text-right text-xs text-fg-3 tnum">{cur.total ? f.pct(d.value / cur.total, 0) : "0%"}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Card>
            <Card className="xl:col-span-3">
              <CardHeader title={t("compare", { month: f.monthShort(month), prev: f.monthShort(prevMonth(month)) })} action={<div className="flex gap-3"><LegendItem color="var(--line-strong)" label={f.monthShort(prevMonth(month))} /><LegendItem color="var(--brand)" label={f.monthShort(month)} /></div>} />
              <div className="h-[240px] px-2 pb-3">
                {loading ? <Sk className="mx-3 h-[220px]" /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={compare} barGap={2} barCategoryGap="26%" margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="var(--line)" />
                      <XAxis dataKey="name" {...axisProps} interval={0} tick={{ fill: "var(--text-3)", fontSize: 11 }} />
                      <YAxis {...axisProps} width={52} tickFormatter={(v) => f.inrCompact(v)} />
                      <Tooltip cursor={{ fill: "var(--surface-2)", radius: 6 }} content={(p) => <ChartTooltip {...(p as object)} rows={[{ key: "previous", name: f.monthShort(prevMonth(month)), color: "var(--line-strong)", format: f.inr }, { key: "current", name: f.monthShort(month), color: "var(--brand)", format: f.inr }]} />} />
                      <Bar dataKey="previous" fill="var(--line-strong)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                      <Bar dataKey="current" fill="var(--brand)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>
          </div>

          <Card className="mt-4">
            <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center">
              <h2 className="text-sm font-semibold text-fg">{t("entries")}</h2>
              {missing > 0 && <Badge variant="warning">{t("missing", { count: missing })}</Badge>}
              <Select value={cat} onValueChange={setCat}>
                <SelectTrigger className="w-48 sm:ml-auto" aria-label={t("category")}><SelectValue>{cat === "all" ? t("allCategories") : tc(cat)}</SelectValue></SelectTrigger>
                <SelectContent><SelectItem value="all">{t("allCategories")}</SelectItem>{EXPENSE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{tc(c)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {loading ? <TableSkeleton rows={8} cols={5} /> : list.length === 0 ? <EmptyState icon={ReceiptText} title={t("empty")} body={t("emptyBody")} action={<Button variant="secondary" onClick={() => setAddOpen(true)}><Plus /> {t("add")}</Button>} /> : (
              <>
              <ul className="divide-y divide-line border-t border-line md:hidden">
                {list.map((e) => (
                  <li key={e.id}>
                    <button type="button" onClick={() => e.receipt && setReceipt(e)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-surface-2">
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2"><span className="size-2.5 rounded-full" style={{ background: COLOR[e.category] }} aria-hidden /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-medium text-fg">{e.vendor}</span>
                        <span className="block truncate text-[13px] text-fg-3">{f.day(e.date)} · {tc(e.category)}{e.receipt ? "" : e.category === "salaries" ? "" : ` · ${t("noReceipt")}`}</span>
                      </span>
                      <span className="shrink-0 text-[15px] font-semibold text-fg tnum">{f.inr(e.amount)}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="scrollbar-thin relative hidden overflow-x-auto md:block">
                <table className="w-full min-w-[820px] text-sm">
                  <thead><tr className="border-b border-line text-left text-xs text-fg-2">
                    <th className="py-2.5 pr-3 pl-5 font-medium">{t("col.date")}</th><th className="px-3 font-medium">{t("col.vendor")}</th><th className="px-3 font-medium">{t("col.category")}</th>
                    <th className="px-3 text-right font-medium">{t("col.amount")}</th><th className="px-3 font-medium">{t("col.mode")}</th><th className="py-2.5 pr-5 pl-3 font-medium">{t("col.receipt")}</th>
                  </tr></thead>
                  <tbody>
                    {list.map((e) => (
                      <tr key={e.id} className="border-b border-line last:border-0">
                        <td className="py-2.5 pr-3 pl-5 text-fg-2 tnum">{f.day(e.date)}</td>
                        <td className="px-3"><p className="font-medium text-fg">{e.vendor}</p><p className="max-w-[340px] truncate text-xs text-fg-3">{e.description}</p></td>
                        <td className="px-3"><span className="inline-flex items-center gap-1.5 text-fg-2"><span className="size-2 rounded-full" style={{ background: COLOR[e.category] }} aria-hidden />{tc(e.category)}</span></td>
                        <td className="px-3 text-right font-medium text-fg tnum">{f.inr(e.amount)}</td>
                        <td className="px-3 text-fg-2">{e.status === "scheduled" ? <Badge variant="neutral"><CalendarClock aria-hidden />{t("scheduled", { date: f.day(e.date) })}</Badge> : tm(e.mode)}</td>
                        <td className="py-2.5 pr-5 pl-3">
                          {e.receipt ? <Button variant="quiet" size="xs" onClick={() => setReceipt(e)}><Paperclip /> {t("view")}</Button> : e.category === "salaries" ? <span className="text-xs text-fg-3">{t("payroll")}</span> : <Badge variant="warning">{t("noReceipt")}</Badge>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </>
            )}
          </Card>
        </>
      )}
      <AddExpenseDialog open={addOpen} onOpenChange={setAddOpen} />
      {receipt && <ReceiptDialog e={receipt} onClose={() => setReceipt(null)} />}
    </>
  );
}

function guessFromFile(name: string): { vendor: string; category: ExpenseCategory; amount: number; description: string } {
  const n = name.toLowerCase();
  if (/kseb|electric|power/.test(n)) return { vendor: "KSEB · Kozhikode Town section", category: "electricity", amount: 44280, description: "Electricity bill" };
  if (/water|kwa|tanker/.test(n)) return { vendor: "Kerala Water Authority", category: "water", amount: 20640, description: "Water charges" };
  if (/bsnl|wifi|internet|broadband/.test(n)) return { vendor: "BSNL FTTH Business", category: "internet", amount: 11800, description: "Fibre broadband" };
  if (/plumb|repair|paint|electrical|carpent/.test(n)) return { vendor: "Rafeeq & Sons Plumbing", category: "maintenance", amount: 7850, description: "Repairs" };
  return { vendor: "Palayam Vegetable Market · Kader & Sons", category: "food", amount: 4860, description: "Vegetables" };
}

function AddExpenseDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useTranslations("expenses.addDialog");
  const tc = useTranslations("expenseCategory");
  const addExpense = useDemo((s) => s.addExpense);
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; url: string; image: boolean } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [filled, setFilled] = useState(false);
  const [form, setForm] = useState({ vendor: "", description: "", amount: "", category: "food" as ExpenseCategory, date: todayISO(), mode: "upi" as Expense["mode"] });
  const [err, setErr] = useState<string | null>(null);
  const reset = () => { setFile(null); setScanning(false); setFilled(false); setErr(null); setForm({ vendor: "", description: "", amount: "", category: "food", date: todayISO(), mode: "upi" }); };
  const onFile = (fl: File | undefined) => {
    if (!fl) return;
    if (fl.size > 10 * 1024 * 1024) return setErr(t("tooBig"));
    setFile({ name: fl.name, url: URL.createObjectURL(fl), image: fl.type.startsWith("image/") });
    setScanning(true);
    setTimeout(() => {
      const g = guessFromFile(fl.name);
      setForm((x) => ({ ...x, vendor: g.vendor, description: g.description, amount: String(g.amount), category: g.category }));
      setScanning(false);
      setFilled(true);
    }, 1300);
  };
  const save = () => {
    const amount = Number(form.amount.replace(/[^\d.]/g, ""));
    if (!form.vendor.trim()) return setErr(t("errVendor"));
    if (!amount || amount <= 0) return setErr(t("errAmount"));
    addExpense({ date: form.date, category: form.category, vendor: form.vendor.trim(), description: form.description.trim() || form.vendor.trim(), amount: Math.round(amount), mode: form.mode, receipt: file ? { fileName: file.name, pages: 1 } : null });
    onOpenChange(false);
    reset();
  };
  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader><DialogTitle>{t("title")}</DialogTitle><DialogDescription>{t("body")}</DialogDescription></DialogHeader>
        <input ref={fileRef} type="file" accept="image/*,application/pdf" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} aria-label={t("upload")} />
        {!file ? (
          <button onClick={() => fileRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files?.[0]); }} className="flex flex-col items-center gap-2 rounded-lg border-[1.5px] border-dashed border-line-input px-6 py-8 text-center transition-colors hover:border-brand hover:bg-brand-tint/30">
            <Upload className="size-5 text-fg-2" aria-hidden />
            <span className="text-sm font-medium text-fg">{t("upload")}</span>
            <span className="text-xs text-fg-3">{t("uploadHint")}</span>
          </button>
        ) : (
          <div className="flex items-center gap-3 rounded-lg border border-line p-3">
            {file.image ? <img src={file.url} alt={t("preview")} className="size-14 rounded-md object-cover ring-1 ring-line" /> : <span className="grid size-14 place-items-center rounded-md bg-surface-2"><FileText className="size-6 text-fg-2" aria-hidden /></span>}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-fg">{file.name}</p>
              <p className="flex items-center gap-1.5 text-xs text-fg-3">{scanning ? <><Loader2 className="size-3 animate-spin" aria-hidden />{t("scanning")}</> : <><ScanLine className="size-3" aria-hidden />{t("filled")}</>}</p>
            </div>
            <Button variant="quiet" size="sm" onClick={() => { setFile(null); setFilled(false); }}>{t("replace")}</Button>
          </div>
        )}
        <div className={cn("grid gap-4 transition-opacity sm:grid-cols-2", scanning && "opacity-50")}>
          <div className="grid gap-1.5 sm:col-span-2"><Label htmlFor="ex-vendor">{t("vendor")}</Label><Input id="ex-vendor" value={form.vendor} onChange={(e) => { setForm({ ...form, vendor: e.target.value }); setErr(null); }} className={cn(filled && "bg-brand-tint/30")} /></div>
          <div className="grid gap-1.5"><Label htmlFor="ex-amount">{t("amount")}</Label><Input id="ex-amount" value={form.amount} onChange={(e) => { setForm({ ...form, amount: e.target.value }); setErr(null); }} inputMode="decimal" className={cn("tnum", filled && "bg-brand-tint/30")} placeholder="₹" /></div>
          <div className="grid gap-1.5"><Label htmlFor="ex-date">{t("date")}</Label><Input id="ex-date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="tnum" /></div>
          <div className="grid gap-1.5"><Label>{t("category")}</Label>
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as ExpenseCategory })}><SelectTrigger className={cn("w-full", filled && "bg-brand-tint/30")}><SelectValue>{tc(form.category)}</SelectValue></SelectTrigger>
              <SelectContent>{EXPENSE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{tc(c)}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="grid gap-1.5"><Label>{t("mode")}</Label>
            <Select value={form.mode} onValueChange={(v) => setForm({ ...form, mode: v as Expense["mode"] })}><SelectTrigger className="w-full"><SelectValue>{form.mode.toUpperCase() === "UPI" ? "UPI" : form.mode === "bank" ? t("bank") : t("cash")}</SelectValue></SelectTrigger>
              <SelectContent><SelectItem value="upi">UPI</SelectItem><SelectItem value="bank">{t("bank")}</SelectItem><SelectItem value="cash">{t("cash")}</SelectItem></SelectContent></Select>
          </div>
          <div className="grid gap-1.5 sm:col-span-2"><Label htmlFor="ex-desc">{t("description")}</Label><Input id="ex-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        </div>
        {filled && <p className="text-xs text-brand-text">{t("checkHint")}</p>}
        {err && <p className="text-xs text-danger-fg" role="alert">{err}</p>}
        <DialogFooter><Button variant="quiet" onClick={() => onOpenChange(false)}>{t("cancel")}</Button><Button variant="primary" onClick={save} disabled={scanning}>{t("save")}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReceiptDialog({ e, onClose }: { e: Expense; onClose: () => void }) {
  const t = useTranslations("expenses");
  const f = useFormat();
  const gst = Math.round(e.amount * (e.category === "food" ? 0 : 0.18) / 1.18);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader><DialogTitle className="truncate text-sm font-medium tracking-normal">{e.receipt?.fileName}</DialogTitle><DialogDescription>{t("receiptMeta", { date: f.date(e.date) })}</DialogDescription></DialogHeader>
        <div className="print-area rounded-md border border-line bg-white p-5 font-mono text-[12px] text-[#1a1a1a]">
          <p className="text-center text-[13px] font-semibold">{e.vendor}</p>
          <p className="text-center text-[11px] text-[#6b6a64]">Kozhikode · GSTIN 32AAB{e.id.slice(-4)}C1Z{e.id.slice(-1)}</p>
          <div className="my-3 border-t border-dashed border-[#bdbab2]" />
          <div className="flex justify-between"><span>Bill no.</span><span>{e.id.replace("EXP", "B")}</span></div>
          <div className="flex justify-between"><span>Date</span><span>{f.date(e.date)}</span></div>
          <div className="flex justify-between"><span>Billed to</span><span>{hostel.name}</span></div>
          <div className="my-3 border-t border-dashed border-[#bdbab2]" />
          <div className="flex justify-between gap-3"><span className="truncate">{e.description}</span><span>{f.inr(e.amount - gst)}</span></div>
          {gst > 0 && <div className="flex justify-between"><span>GST 18%</span><span>{f.inr(gst)}</span></div>}
          <div className="my-3 border-t border-dashed border-[#bdbab2]" />
          <div className="flex justify-between text-[13px] font-semibold"><span>TOTAL</span><span>{f.inr(e.amount)}</span></div>
          <p className="mt-3 text-center text-[11px] text-[#6b6a64]">Paid by {e.mode === "upi" ? "UPI" : e.mode === "bank" ? "bank transfer" : "cash"} · Thank you</p>
        </div>
        <DialogFooter><Button variant="secondary" onClick={() => window.print()}><Download /> {t("downloadReceipt")}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
