"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import {
  Check, CheckCircle2, ChevronLeft, ChevronRight, Copy, FileText, IndianRupee, MessageCircle, MoreHorizontal, Receipt, Search, SearchX, Send, Banknote, Zap,
} from "lucide-react";
import { Card, PageHeader } from "@/components/common/card";
import { EmptyState, ErrorState, Sk, TableSkeleton } from "@/components/common/states";
import { Avatar } from "@/components/common/avatar";
import { CountUp } from "@/components/common/count-up";
import { InvoiceChip } from "@/components/common/chips";
import { Bubble } from "@/components/whatsapp/bubble";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useDemo } from "@/lib/store";
import { useFormat, useScreenState } from "@/lib/hooks";
import { aging, invoiceState, monthSummary, overdueInvoices, rebates, roomById, type AgingId } from "@/lib/selectors";
import { todayISO, nowISO } from "@/lib/clock";
import { payLink, upiUri } from "@/lib/upi";
import { simulatePayment } from "@/lib/demo-actions";
import { demo } from "@/config/demo";
import { hostel, type Invoice } from "@/data";
import { cn } from "@/lib/utils";

type Filter = "all" | "unpaid" | "overdue" | "paid";
const PAGE = 25;

export function RentScreen() {
  const t = useTranslations("rent");
  const tm = useTranslations("method");
  const f = useFormat();
  const params = useSearchParams();
  const { loading, error, retry } = useScreenState("rent");
  const invoices = useDemo((s) => s.invoices);
  const residents = useDemo((s) => s.residents);
  const optOuts = useDemo((s) => s.optOuts);
  const flash = useDemo((s) => s.flash);
  const tourActive = useDemo((s) => s.tourActive);
  const raiseInvoices = useDemo((s) => s.raiseInvoices);
  const sendReminders = useDemo((s) => s.sendReminders);
  const payInvoice = useDemo((s) => s.payInvoice);
  const openWhatsApp = useDemo((s) => s.openWhatsApp);
  const today = todayISO();
  const months = useMemo(() => [...new Set([...hostel.months, ...invoices.map((i) => i.month)])].sort(), [invoices]);
  const [month, setMonth] = useState<string>(demo.currentMonth);
  const [filter, setFilter] = useState<Filter>((params.get("filter") as Filter) || "all");
  const [bucket, setBucket] = useState<AgingId | null>((params.get("bucket") as AgingId) || null);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [raiseOpen, setRaiseOpen] = useState(false);
  const [remindOpen, setRemindOpen] = useState(false);
  const [linkFor, setLinkFor] = useState<Invoice | null>(null);
  const [viewInv, setViewInv] = useState<Invoice | null>(null);
  useEffect(() => setPage(0), [month, filter, bucket, q]);

  const resById = useMemo(() => Object.fromEntries(residents.map((r) => [r.id, r])), [residents]);
  const sum = useMemo(() => monthSummary(invoices, month), [invoices, month]);
  const ag = useMemo(() => aging(invoices, today), [invoices, today]);
  const overdue = useMemo(() => overdueInvoices(invoices, today), [invoices, today]);
  const nextRaised = invoices.some((i) => i.month === demo.nextMonth);

  // Keep row order stable while payments land, so rows flip in place instead of jumping.
  const invById = useMemo(() => Object.fromEntries(invoices.map((i) => [i.id, i])), [invoices]);
  const snapshot = useRef(invoices);
  const orderKey = `${month}|${filter}|${bucket}|${q}`;
  const order = useMemo(() => {
    snapshot.current = invoices;
    const bucketIds = bucket ? new Set(ag.find((b) => b.id === bucket)?.invoices.map((i) => i.id)) : null;
    const s = q.trim().toLowerCase();
    const rank = (i: Invoice) => {
      const st = invoiceState(i, today);
      return st.state === "overdue" ? -st.days - 1000 : st.state === "due_today" ? -500 : st.state === "due" ? -100 : 0;
    };
    return invoices
      .filter((i) => (bucketIds ? bucketIds.has(i.id) : i.month === month))
      .filter((i) => filter === "all" || (filter === "paid" ? i.status === "paid" : filter === "unpaid" ? i.status === "unpaid" : invoiceState(i, today).state === "overdue"))
      .filter((i) => !s || i.id.toLowerCase().includes(s) || resById[i.residentId]?.name.toLowerCase().includes(s) || resById[i.residentId]?.bedId.toLowerCase().includes(s))
      .sort((a, b) => rank(a) - rank(b) || (b.paidOn ?? "").localeCompare(a.paidOn ?? "") || a.id.localeCompare(b.id))
      .map((i) => i.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderKey, invoices.length, ag.length]);
  const pageIds = order.slice(page * PAGE, page * PAGE + PAGE);

  const nextPreview = useMemo(() => {
    const active = residents.filter((r) => r.status !== "checked_out" && (!r.checkOutDate || r.checkOutDate >= `${demo.nextMonth}-01`));
    const rb = rebates(optOuts, demo.currentMonth);
    const rbTotal = rb.reduce((a, r) => a + r.amount, 0);
    let total = 0;
    for (const r of active) total += roomById[r.bedId.split("-").slice(0, 2).join("-")].rent + (r.messPlan ? hostel.messFee : 0);
    return { count: active.length, total: total - rbTotal, rebates: rbTotal, rebateCount: rb.length };
  }, [residents, optOuts]);

  return (
    <>
      <PageHeader
        title={t("title")}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success-tint px-2 py-0.5 text-xs font-medium text-success-fg">
              <span className="live-dot size-1.5 rounded-full bg-success" aria-hidden />{t("reconciling", { bank: hostel.bank.split(" · ")[0] })}
            </span>
            <span className="text-fg-2">{t("upiId", { id: hostel.upiId })}</span>
          </span>
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => setRemindOpen(true)} disabled={loading || overdue.length === 0} data-tour="remind-button">
              <MessageCircle /> {t("remind", { count: overdue.length })}
            </Button>
            {nextRaised ? (
              <Button variant="secondary" onClick={() => setMonth(demo.nextMonth)}><Check /> {t("raised", { month: f.month(demo.nextMonth) })}</Button>
            ) : (
              <Button variant="primary" onClick={() => setRaiseOpen(true)} disabled={loading} data-tour="raise-button"><Zap /> {t("raise", { month: f.monthShort(demo.nextMonth) })}</Button>
            )}
          </>
        }
      />

      {error ? <Card><ErrorState what={t("what")} onRetry={retry} /></Card> : (
        <>
          <div role="tablist" aria-label={t("months")} className="no-scrollbar mb-4 flex gap-1 overflow-x-auto">
            {months.map((m) => (
              <button key={m} role="tab" aria-selected={month === m && !bucket} onClick={() => { setMonth(m); setBucket(null); }} className={cn("h-8 shrink-0 rounded-md px-3 text-small font-medium transition-colors", month === m && !bucket ? "bg-surface text-fg shadow-sm ring-1 ring-line" : "text-fg-2 hover:bg-surface-2 hover:text-fg")}>
                {f.month(m)}
              </button>
            ))}
          </div>

          <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" data-tour="rent-summary">
            {loading ? Array.from({ length: 4 }).map((_, i) => <Sk key={i} className="h-[104px] rounded-lg" />) : (
              <>
                <Stat label={t("billed")} value={<CountUp id={`rent-billed-${month}`} value={sum.billed} format={f.inr} />} sub={t("invoices", { count: sum.count })} />
                <Stat label={t("collected")} value={<CountUp id={`rent-coll-${month}`} value={sum.collected} format={f.inr} />} sub={<Progress value={sum.rate * 100} className="mt-2 h-1.5" aria-label={t("rate")} />} />
                <Stat label={t("pending")} value={<CountUp id={`rent-pend-${month}`} value={sum.pending} format={f.inr} />} sub={t("unpaid", { count: sum.unpaidCount })} tone={sum.pending > 0 ? "danger" : undefined} />
                <Stat label={t("rate")} value={<CountUp id={`rent-rate-${month}`} value={sum.rate * 100} format={(v) => `${v.toFixed(1)}%`} />} sub={t("rateSub")} />
              </>
            )}
          </div>

          <Card className="mb-4" data-tour="aging">
            <div className="flex items-center justify-between px-5 pt-4 pb-3">
              <h2 className="text-sm font-semibold text-fg">{t("aging.title")}</h2>
              {bucket && <Button variant="quiet" size="sm" onClick={() => setBucket(null)}>{t("aging.clear")}</Button>}
            </div>
            <div className="grid gap-px overflow-hidden border-t border-line bg-line sm:grid-cols-4">
              {ag.map((b, i) => {
                const max = Math.max(...ag.map((x) => x.amount), 1);
                const active = bucket === b.id;
                return (
                  <button key={b.id} onClick={() => setBucket(active ? null : b.id)} aria-pressed={active} className={cn("bg-surface p-4 text-left transition-colors hover:bg-surface-2", active && "bg-brand-tint/60 hover:bg-brand-tint/60")}>
                    <p className="text-xs font-medium text-fg-2">{t(`aging.${b.id}`)}</p>
                    <p className="mt-1 text-title font-semibold text-fg tnum">{loading ? "—" : f.inr(b.amount)}</p>
                    <p className="text-xs text-fg-3 tnum">{t("aging.count", { count: b.count })}</p>
                    <div className="mt-3 h-1.5 rounded-full bg-surface-2"><div className={cn("h-full rounded-full", i < 1 ? "bg-warning" : "bg-danger")} style={{ width: `${(b.amount / max) * 100}%`, opacity: 0.55 + i * 0.15 }} /></div>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card data-tour="invoice-table">
            <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center">
              <div role="tablist" aria-label={t("filter.label")} className="flex gap-1">
                {(["all", "unpaid", "overdue", "paid"] as Filter[]).map((k) => (
                  <button key={k} role="tab" aria-selected={filter === k} onClick={() => setFilter(k)} className={cn("h-8 rounded-md px-2.5 text-small font-medium transition-colors", filter === k ? "bg-surface-2 text-fg" : "text-fg-2 hover:text-fg")}>{t(`filter.${k}`)}</button>
                ))}
              </div>
              {bucket && <span className="text-small text-fg-2">{t("aging.showing", { bucket: t(`aging.${bucket}`) })}</span>}
              <div className="relative sm:ml-auto sm:w-72">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-fg-3" aria-hidden />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")} aria-label={t("search")} className="pl-8" data-tour="invoice-search" />
              </div>
            </div>
            {loading ? <TableSkeleton rows={10} cols={6} /> : order.length === 0 ? (
              <EmptyState icon={filter === "overdue" ? CheckCircle2 : SearchX} title={filter === "overdue" ? t("empty.overdueTitle", { month: f.month(month) }) : t("empty.title")} body={filter === "overdue" ? t("empty.overdueBody") : t("empty.body")} />
            ) : (
              <>
                <div className="scrollbar-thin relative overflow-x-auto">
                  <table className="w-full min-w-[900px] text-sm">
                    <thead><tr className="border-b border-line text-left text-xs text-fg-2">
                      <th className="py-2.5 pr-3 pl-5 font-medium">{t("col.resident")}</th>
                      <th className="px-3 font-medium">{t("col.invoice")}</th>
                      <th className="px-3 text-right font-medium">{t("col.amount")}</th>
                      <th className="px-3 font-medium">{t("col.due")}</th>
                      <th className="px-3 font-medium">{t("col.status")}</th>
                      <th className="px-3 font-medium">{t("col.paid")}</th>
                      <th className="w-12 py-2.5 pr-5 pl-3"><span className="sr-only">{t("col.actions")}</span></th>
                    </tr></thead>
                    <tbody>
                      {pageIds.map((id) => {
                        const inv = invById[id];
                        if (!inv) return null;
                        const r = resById[inv.residentId];
                        const flashed = flash[id] && Date.now() - flash[id] < 2500;
                        return (
                          <tr key={`${id}-${flash[id] ?? 0}`} className={cn("border-b border-line last:border-0 hover:bg-surface-2/60", flashed && "flash-paid")} data-invoice={id}>
                            <td className="py-2 pr-3 pl-5">
                              <div className="flex items-center gap-3">
                                <Avatar name={r?.name ?? "?"} size={28} />
                                <div className="min-w-0"><p className="truncate font-medium text-fg">{r?.name}</p><p className="font-mono text-xs text-fg-3">{r?.bedId}</p></div>
                              </div>
                            </td>
                            <td className="px-3 font-mono text-xs text-fg-2">{inv.id}</td>
                            <td className="px-3 text-right font-medium text-fg tnum">{f.inr(inv.total)}</td>
                            <td className="px-3 text-fg-2 tnum">{f.day(inv.dueOn)}</td>
                            <td className="px-3">
                              <AnimatePresence mode="wait" initial={false}>
                                <motion.span key={inv.status} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.25 }} className="inline-flex">
                                  <InvoiceChip inv={inv} today={today} />
                                </motion.span>
                              </AnimatePresence>
                            </td>
                            <td className="px-3 text-xs text-fg-2 tnum">
                              {inv.paidOn ? (
                                <span>{tm(inv.method ?? "upi")}{inv.paidVia === "whatsapp_link" ? ` · ${t("viaWa")}` : inv.paidVia === "app" ? ` · ${t("viaApp")}` : ""}<span className="block text-fg-3">{f.day(inv.paidOn)}, {f.time(inv.paidOn)}</span></span>
                              ) : inv.remindersSent > 0 ? <span className="text-fg-3">{t("reminded", { count: inv.remindersSent })}</span> : <span className="text-fg-3">—</span>}
                            </td>
                            <td className="py-2 pr-5 pl-3 text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild><Button variant="quiet" size="icon-sm" aria-label={t("actions", { id: inv.id })}><MoreHorizontal /></Button></DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56">
                                  <DropdownMenuItem onSelect={() => setViewInv(inv)}><FileText /> {t("act.view")}</DropdownMenuItem>
                                  {inv.status === "unpaid" && (
                                    <>
                                      <DropdownMenuItem onSelect={() => setLinkFor(inv)}><IndianRupee /> {t("act.link")}</DropdownMenuItem>
                                      <DropdownMenuItem onSelect={() => { sendReminders([inv.id]); }}><Send /> {t("act.send")}</DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem onSelect={() => payInvoice(inv.id, { method: "cash" })}><Banknote /> {t("act.cash")}</DropdownMenuItem>
                                    </>
                                  )}
                                  {inv.status === "paid" && <DropdownMenuItem onSelect={() => setViewInv(inv)}><Receipt /> {t("act.receipt")}</DropdownMenuItem>}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between border-t border-line px-5 py-3 text-small text-fg-2">
                  <span className="tnum">{t("range", { from: page * PAGE + 1, to: Math.min(order.length, (page + 1) * PAGE), total: order.length })}</span>
                  <div className="flex gap-1">
                    <Button variant="quiet" size="icon-sm" aria-label={t("prev")} disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft /></Button>
                    <Button variant="quiet" size="icon-sm" aria-label={t("next")} disabled={(page + 1) * PAGE >= order.length} onClick={() => setPage(page + 1)}><ChevronRight /></Button>
                  </div>
                </div>
              </>
            )}
          </Card>
        </>
      )}

      <RaiseDialog open={raiseOpen} onOpenChange={setRaiseOpen} preview={nextPreview} onRaise={() => raiseInvoices(demo.nextMonth)} onDone={() => setMonth(demo.nextMonth)} />
      <RemindDialog
        open={remindOpen}
        onOpenChange={setRemindOpen}
        overdue={overdue}
        onSend={() => {
          const ids = overdue.map((i) => i.id);
          sendReminders(ids);
          setFilter("overdue");
          setBucket(null);
          setMonth(demo.currentMonth);
          const persona = useDemo.getState().whatsapp.find((w) => w.residentId === demo.residentId && w.role === "resident");
          openWhatsApp(persona?.id ?? null);
          // a resident pays from the reminder a few seconds later: auto-reconciled, no data entry
          if (!tourActive) setTimeout(() => simulatePayment(), 6500);
        }}
      />
      {linkFor && <PayLinkDialog inv={linkFor} name={resById[linkFor.residentId]?.name ?? ""} onClose={() => setLinkFor(null)} onSend={() => { sendReminders([linkFor.id]); setLinkFor(null); }} />}
      {viewInv && <InvoiceDialog inv={invById[viewInv.id] ?? viewInv} name={resById[viewInv.residentId]?.name ?? ""} bed={resById[viewInv.residentId]?.bedId ?? ""} onClose={() => setViewInv(null)} />}
    </>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: "danger" }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-5">
      <p className="text-small font-medium text-fg-2">{label}</p>
      <p className={cn("mt-1.5 text-[26px] leading-8 font-semibold tracking-[-0.02em] tnum", tone === "danger" ? "text-danger-fg" : "text-fg")}>{value}</p>
      <div className="mt-1 text-xs text-fg-3">{sub}</div>
    </div>
  );
}

function RaiseDialog({ open, onOpenChange, preview, onRaise, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; preview: { count: number; total: number; rebates: number; rebateCount: number }; onRaise: () => number; onDone: () => void }) {
  const t = useTranslations("rent.raiseDialog");
  const f = useFormat();
  const [phase, setPhase] = useState<"confirm" | "raising" | "done">("confirm");
  const [progress, setProgress] = useState(0);
  const [created, setCreated] = useState(0);
  useEffect(() => {
    if (open) { setPhase("confirm"); setProgress(0); }
  }, [open]);
  const start = () => {
    setPhase("raising");
    const n = onRaise();
    setCreated(n);
    const t0 = performance.now();
    const tick = () => {
      const p = Math.min(1, (performance.now() - t0) / 1400);
      setProgress(p);
      if (p < 1) requestAnimationFrame(tick);
      else setPhase("done");
    };
    requestAnimationFrame(tick);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-tour="raise-dialog">
        <DialogHeader>
          <DialogTitle>{phase === "done" ? t("doneTitle", { count: created, month: f.month(demo.nextMonth) }) : t("title", { month: f.month(demo.nextMonth) })}</DialogTitle>
          <DialogDescription>{phase === "done" ? t("doneBody") : t("body", { count: preview.count, amount: f.inr(preview.total) })}</DialogDescription>
        </DialogHeader>
        {phase === "confirm" && (
          <dl className="divide-y divide-line rounded-lg border border-line text-sm">
            <div className="flex justify-between px-4 py-2.5"><dt className="text-fg-2">{t("residents")}</dt><dd className="text-fg tnum">{preview.count}</dd></div>
            <div className="flex justify-between px-4 py-2.5"><dt className="text-fg-2">{t("rebates", { count: preview.rebateCount })}</dt><dd className="text-success-fg tnum">−{f.inr(preview.rebates)}</dd></div>
            <div className="flex justify-between px-4 py-2.5"><dt className="text-fg-2">{t("due")}</dt><dd className="text-fg tnum">{f.date(`${demo.nextMonth}-07`)}</dd></div>
            <div className="flex justify-between px-4 py-2.5 font-medium"><dt className="text-fg">{t("total")}</dt><dd className="text-fg tnum">{f.inr(preview.total)}</dd></div>
          </dl>
        )}
        {phase !== "confirm" && (
          <div className="py-2">
            <div className="mb-2 flex justify-between text-small text-fg-2 tnum"><span>{phase === "done" ? t("sent") : t("raising")}</span><span>{Math.round(progress * created)} / {created}</span></div>
            <Progress value={progress * 100} className="h-2" />
            {phase === "done" && (
              <ul className="mt-4 space-y-1.5 text-small text-fg-2">
                <li className="flex items-center gap-2"><CheckCircle2 className="size-4 text-success" aria-hidden /> {t("check1")}</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="size-4 text-success" aria-hidden /> {t("check2")}</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="size-4 text-success" aria-hidden /> {t("check3")}</li>
              </ul>
            )}
          </div>
        )}
        <DialogFooter>
          {phase === "confirm" && <><Button variant="quiet" onClick={() => onOpenChange(false)}>{t("cancel")}</Button><Button variant="primary" onClick={start} data-tour="raise-confirm"><Zap /> {t("confirm")}</Button></>}
          {phase === "done" && <Button variant="primary" onClick={() => { onDone(); onOpenChange(false); }} data-tour="raise-view">{t("view")}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RemindDialog({ open, onOpenChange, overdue, onSend }: { open: boolean; onOpenChange: (o: boolean) => void; overdue: Invoice[]; onSend: () => void }) {
  const t = useTranslations("rent.remindDialog");
  const f = useFormat();
  const residents = useDemo((s) => s.residents);
  const first = overdue.find((i) => i.residentId === demo.residentId) ?? overdue[0];
  const r = first ? residents.find((x) => x.id === first.residentId) : null;
  const days = first ? invoiceState(first, todayISO()).days : 0;
  const total = overdue.reduce((a, i) => a + i.total, 0);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]" data-tour="remind-dialog">
        <DialogHeader>
          <DialogTitle>{t("title", { count: overdue.length })}</DialogTitle>
          <DialogDescription>{t("body", { amount: f.inr(total) })}</DialogDescription>
        </DialogHeader>
        {first && r && (
          <div className="wa-scope overflow-hidden rounded-lg border border-line">
            <div className="flex items-center gap-2 bg-[var(--wa-header)] px-3 py-2 text-[13px] text-[var(--wa-text)]">
              <MessageCircle className="size-4 fill-whatsapp text-whatsapp" aria-hidden />
              <span className="font-medium">{t("preview", { name: r.name })}</span>
            </div>
            <div className="wa-wallpaper p-3">
              <Bubble lang="en" m={{ id: "preview", from: "hostel", at: nowISO(), kind: "template", template: "reminder_overdue", data: { name: r.name.split(" ")[0], amount: first.total, days, invoiceId: first.id }, status: "sent" }} />
            </div>
          </div>
        )}
        <p className="text-xs text-fg-3">{t("note")}</p>
        <DialogFooter>
          <Button variant="quiet" onClick={() => onOpenChange(false)}>{t("cancel")}</Button>
          <Button variant="primary" onClick={() => { onSend(); onOpenChange(false); }} data-tour="remind-send"><Send /> {t("send", { count: overdue.length })}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PayLinkDialog({ inv, name, onClose, onSend }: { inv: Invoice; name: string; onClose: () => void; onSend: () => void }) {
  const t = useTranslations("rent.linkDialog");
  const f = useFormat();
  const link = payLink(inv.id);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{t("title", { amount: f.inr(inv.total) })}</DialogTitle>
          <DialogDescription>{t("body", { name, id: inv.id })}</DialogDescription>
        </DialogHeader>
        <div className="mx-auto rounded-lg border border-line bg-white p-4">
          <QRCodeSVG value={upiUri(inv.total, inv.id)} size={176} level="M" />
        </div>
        <p className="text-center text-xs text-fg-3">{t("scan", { upi: hostel.upiId })}</p>
        <div className="flex items-center gap-2 rounded-md border border-line bg-surface-2 px-3 py-2">
          <span className="flex-1 truncate font-mono text-small text-fg">{link}</span>
          <Button variant="quiet" size="sm" onClick={() => { navigator.clipboard?.writeText(`https://${link}`); toast(t("copied")); }}><Copy /> {t("copy")}</Button>
        </div>
        <DialogFooter>
          <Button variant="primary" onClick={onSend}><MessageCircle /> {t("send")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InvoiceDialog({ inv, name, bed, onClose }: { inv: Invoice; name: string; bed: string; onClose: () => void }) {
  const t = useTranslations("rent.invoiceDialog");
  const tm = useTranslations("method");
  const f = useFormat();
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <div className="print-area space-y-4">
        <DialogHeader>
          <DialogTitle className="font-mono">{inv.id}</DialogTitle>
          <DialogDescription>{t("for", { name, bed, month: f.month(inv.month) })}</DialogDescription>
        </DialogHeader>
        <dl className="divide-y divide-line rounded-lg border border-line text-sm">
          {inv.lines.map((l) => (
            <div key={l.label} className="flex justify-between gap-4 px-4 py-2.5"><dt className="text-fg-2">{l.label}</dt><dd className={cn("tnum", l.amount < 0 ? "text-success-fg" : "text-fg")}>{f.inr(l.amount)}</dd></div>
          ))}
          <div className="flex justify-between px-4 py-2.5 font-semibold"><dt className="text-fg">{t("total")}</dt><dd className="text-fg tnum">{f.inr(inv.total)}</dd></div>
        </dl>
        <div className="grid grid-cols-2 gap-3 text-small">
          <div><p className="text-xs text-fg-3">{t("issued")}</p><p className="text-fg tnum">{f.date(inv.issuedOn)}</p></div>
          <div><p className="text-xs text-fg-3">{t("due")}</p><p className="text-fg tnum">{f.date(inv.dueOn)}</p></div>
          {inv.paidOn && <div><p className="text-xs text-fg-3">{t("paid")}</p><p className="text-fg tnum">{f.date(inv.paidOn)}, {f.time(inv.paidOn)} · {tm(inv.method ?? "upi")}</p></div>}
          {inv.utr && <div><p className="text-xs text-fg-3">{t("utr")}</p><p className="font-mono text-fg">{inv.utr}</p></div>}
        </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => { document.title = inv.id; window.print(); }}><FileText /> {t("pdf")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
