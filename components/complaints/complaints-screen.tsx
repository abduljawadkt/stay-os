"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { CheckCircle2, CircleDot, Inbox, MessageCircle, MoreHorizontal, Plus, Star, Wrench, Search, Timer, UserRound } from "lucide-react";
import { Card, PageHeader } from "@/components/common/card";
import { EmptyState, ErrorState, Sk } from "@/components/common/states";
import { Avatar } from "@/components/common/avatar";
import { ChannelBadge, SlaChip } from "@/components/common/chips";
import { ComplaintPhoto } from "@/components/common/complaint-photo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useDemo } from "@/lib/store";
import { useFormat, useNow, useScreenState } from "@/lib/hooks";
import { sla, staffById } from "@/lib/selectors";
import { fmtDuration } from "@/lib/format";
import type { Channel, Complaint, ComplaintCategory, ComplaintStatus, Resident } from "@/data";
import { cn } from "@/lib/utils";

const COLUMNS: ComplaintStatus[] = ["new", "in_progress", "resolved"];
const CATS: ComplaintCategory[] = ["electrical", "plumbing", "wifi", "housekeeping", "mess", "furniture", "other"];
const Ctx = createContext<{ now: number; resById: Record<string, Resident>; open: (id: string) => void; move: (id: string, s: ComplaintStatus) => void }>(null as never);

export function ComplaintsScreen() {
  const t = useTranslations("complaints");
  const tc = useTranslations("category");
  const tch = useTranslations("channel");
  const now = useNow(10000);
  const { loading, error, retry } = useScreenState("complaints");
  const complaints = useDemo((s) => s.complaints);
  const residents = useDemo((s) => s.residents);
  const setStatus = useDemo((s) => s.setComplaintStatus);
  const [openId, setOpenId] = useState<string | null>(null);
  const [cat, setCat] = useState<string>("all");
  const [channel, setChannel] = useState<"all" | Channel>("all");
  const [q, setQ] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const resById = useMemo(() => Object.fromEntries(residents.map((r) => [r.id, r])), [residents]);

  const visible = useMemo(() => {
    const s = q.trim().toLowerCase();
    const weekAgo = now - 7 * 86400000;
    return complaints
      .filter((c) => c.status !== "resolved" || new Date(c.resolvedAt ?? c.createdAt).getTime() >= weekAgo)
      .filter((c) => cat === "all" || c.category === cat)
      .filter((c) => channel === "all" || c.channel === channel)
      .filter((c) => !s || c.title.toLowerCase().includes(s) || c.id.toLowerCase().includes(s) || c.roomId.toLowerCase().includes(s) || resById[c.residentId]?.name.toLowerCase().includes(s));
  }, [complaints, cat, channel, q, resById, now]);

  const stats = useMemo(() => {
    const month = complaints.filter((c) => c.createdAt.startsWith("2026-11") && c.resolvedAt);
    const avg = month.reduce((a, c) => a + (new Date(c.resolvedAt!).getTime() - new Date(c.createdAt).getTime()), 0) / Math.max(1, month.length);
    const met = month.filter((c) => sla(c, now).state === "met").length / Math.max(1, month.length);
    const rated = month.filter((c) => c.rating);
    const rating = rated.reduce((a, c) => a + (c.rating ?? 0), 0) / Math.max(1, rated.length);
    const wa = complaints.filter((c) => c.createdAt.startsWith("2026-11") && c.channel === "whatsapp").length / Math.max(1, complaints.filter((c) => c.createdAt.startsWith("2026-11")).length);
    return { avg, met, rating, wa };
  }, [complaints, now]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));
  const onDragEnd = (e: DragEndEvent) => {
    setDragId(null);
    if (!e.over) return;
    const to = e.over.id as ComplaintStatus;
    const c = complaints.find((x) => x.id === e.active.id);
    if (c && c.status !== to) setStatus(c.id, to);
  };
  const dragging = dragId ? complaints.find((c) => c.id === dragId) : null;

  return (
    <Ctx.Provider value={{ now, resById, open: setOpenId, move: setStatus }}>
      <PageHeader
        title={t("title")}
        description={loading ? " " : t("subtitle", { avg: fmtDuration(stats.avg), met: Math.round(stats.met * 100), rating: stats.rating.toFixed(1), wa: Math.round(stats.wa * 100) })}
        actions={<Button variant="primary" onClick={() => setLogOpen(true)}><Plus /> {t("log")}</Button>}
      />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-fg-3" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")} aria-label={t("search")} className="pl-8" />
        </div>
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="w-44" aria-label={t("category")}><SelectValue>{cat === "all" ? t("allCategories") : tc(cat)}</SelectValue></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allCategories")}</SelectItem>
            {CATS.map((c) => <SelectItem key={c} value={c}>{tc(c)}</SelectItem>)}
          </SelectContent>
        </Select>
        <div role="tablist" aria-label={t("channel")} className="no-scrollbar flex max-w-full gap-1 overflow-x-auto rounded-md bg-surface-2 p-0.5">
          {(["all", "whatsapp", "app", "walk_in"] as const).map((k) => (
            <button key={k} role="tab" aria-selected={channel === k} onClick={() => setChannel(k)} className={cn("h-7 shrink-0 rounded-sm px-2.5 text-small font-medium whitespace-nowrap transition-colors", channel === k ? "bg-surface text-fg shadow-sm dark:bg-surface-3" : "text-fg-2 hover:text-fg")}>
              {k === "all" ? t("allChannels") : tch(k)}
            </button>
          ))}
        </div>
      </div>

      {error ? <Card><ErrorState what={t("what")} onRetry={retry} /></Card> : (
        <DndContext sensors={sensors} onDragStart={(e) => setDragId(String(e.active.id))} onDragEnd={onDragEnd} onDragCancel={() => setDragId(null)}>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3" data-tour="kanban">
            {COLUMNS.map((col) => {
              const items = visible.filter((c) => c.status === col).sort((a, b) => (col === "resolved" ? (b.resolvedAt ?? "").localeCompare(a.resolvedAt ?? "") : sla(b, now).ratio - sla(a, now).ratio));
              return <Column key={col} status={col} items={items} loading={loading} />;
            })}
          </div>
          <DragOverlay dropAnimation={{ duration: 200, easing: "cubic-bezier(.2,0,0,1)" }}>
            {dragging ? <div className="scale-[1.02] shadow-lg"><CardBody c={dragging} /></div> : null}
          </DragOverlay>
        </DndContext>
      )}
      <ComplaintDrawer id={openId} onClose={() => setOpenId(null)} />
      <LogDialog open={logOpen} onOpenChange={setLogOpen} />
    </Ctx.Provider>
  );
}

function Column({ status, items, loading }: { status: ComplaintStatus; items: Complaint[]; loading: boolean }) {
  const t = useTranslations("complaints");
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const Icon = status === "new" ? Inbox : status === "in_progress" ? Wrench : CheckCircle2;
  return (
    <section ref={setNodeRef} aria-label={t(`col.${status}`)} data-tour={`col-${status}`} className={cn("flex min-h-[420px] flex-col rounded-lg border bg-surface-2/50 transition-colors", isOver ? "border-brand bg-brand-tint/30" : "border-line")}>
      <header className="flex items-center gap-2 px-4 pt-3.5 pb-2.5">
        <Icon className="size-4 text-fg-3" aria-hidden />
        <h2 className="text-sm font-semibold text-fg">{t(`col.${status}`)}</h2>
        <span className="rounded-full bg-surface-3 px-1.5 text-xs leading-5 text-fg-2 tnum">{loading ? "–" : items.length}</span>
        {status === "resolved" && <span className="ml-auto text-xs text-fg-3">{t("lastWeek")}</span>}
      </header>
      <div className="flex flex-1 flex-col gap-2 px-2.5 pb-2.5">
        {loading ? Array.from({ length: 3 }).map((_, i) => <Sk key={i} className="h-28 rounded-lg" />) : items.length === 0 ? (
          <EmptyState icon={Icon} title={t(`empty.${status}`)} body={t(`emptyBody.${status}`)} className="py-8" />
        ) : (
          <AnimatePresence initial={false}>
            {items.map((c) => <DraggableCard key={c.id} c={c} />)}
          </AnimatePresence>
        )}
      </div>
    </section>
  );
}

function DraggableCard({ c }: { c: Complaint }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: c.id });
  const { open } = useContext(Ctx);
  return (
    <motion.div layout layoutId={c.id} initial={{ opacity: 0, y: -6 }} animate={{ opacity: isDragging ? 0.35 : 1, y: 0 }} exit={{ opacity: 0 }} transition={{ type: "spring", stiffness: 420, damping: 36 }}>
      <div ref={setNodeRef} {...attributes} {...listeners} onClick={() => open(c.id)} onKeyDown={(e) => { if (e.key === "Enter") open(c.id); }} className="cursor-grab touch-none rounded-lg active:cursor-grabbing" data-complaint={c.id}>
        <CardBody c={c} />
      </div>
    </motion.div>
  );
}

function CardBody({ c }: { c: Complaint }) {
  const t = useTranslations("complaints");
  const { now, resById, move } = useContext(Ctx);
  const r = resById[c.residentId];
  const assignee = c.assignedTo ? staffById[c.assignedTo] : null;
  const pr = c.priority === "high" ? "bg-danger" : c.priority === "medium" ? "bg-warning" : "bg-fg-3";
  return (
    <article className="rounded-lg border border-line bg-surface p-3 transition-colors hover:border-line-strong">
      <div className="flex items-center gap-2">
        <span className={cn("size-1.5 rounded-full", pr)} aria-label={t(`priority.${c.priority}`)} role="img" />
        <span className="font-mono text-xs text-fg-3">{c.id}</span>
        {c.channel === "whatsapp" && <ChannelBadge channel="whatsapp" />}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="quiet" size="icon-xs" className="ml-auto" aria-label={t("moveTo")} onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}><MoreHorizontal /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            {COLUMNS.filter((s) => s !== c.status).map((s) => <DropdownMenuItem key={s} onSelect={() => move(c.id, s)}>{t("moveToCol", { col: t(`col.${s}`) })}</DropdownMenuItem>)}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <p className="mt-1.5 text-sm font-medium text-fg">{c.title}</p>
      <p className="mt-0.5 truncate text-xs text-fg-3">{r?.name} · <span className="font-mono">{c.roomId}</span></p>
      <div className="mt-2.5 flex items-center gap-2">
        <SlaChip c={c} now={now} />
        {c.rating && <span className="inline-flex items-center gap-0.5 text-xs text-fg-2 tnum"><Star className="size-3 fill-warning text-warning" aria-hidden />{c.rating}</span>}
        <span className="ml-auto">{assignee ? <Avatar name={assignee.name} size={22} /> : <span className="text-xs text-fg-3">{t("unassigned")}</span>}</span>
      </div>
    </article>
  );
}

function ComplaintDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const t = useTranslations("complaints");
  const tc = useTranslations("category");
  const tch = useTranslations("channel");
  const f = useFormat();
  const now = useNow(10000);
  const complaints = useDemo((s) => s.complaints);
  const residents = useDemo((s) => s.residents);
  const whatsapp = useDemo((s) => s.whatsapp);
  const setStatus = useDemo((s) => s.setComplaintStatus);
  const openWhatsApp = useDemo((s) => s.openWhatsApp);
  const c = complaints.find((x) => x.id === id);
  const r = c ? residents.find((x) => x.id === c.residentId) : null;
  const thread = r ? whatsapp.find((w) => w.residentId === r.id && w.role === "resident") : undefined;
  return (
    <Sheet open={!!c} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex flex-col p-0" data-tour="complaint-drawer">
        {c && r && (
          <>
            <div className="border-b border-line px-6 pt-6 pb-5 pr-14">
              <p className="font-mono text-xs text-fg-3">{c.id} · {tc(c.category)}</p>
              <SheetTitle className="mt-1">{c.title}</SheetTitle>
              <SheetDescription className="mt-1 text-small text-fg-2">{r.name} · <span className="font-mono">{c.roomId}</span> · {f.weekday(c.createdAt)}, {f.time(c.createdAt)}</SheetDescription>
              <div className="mt-3 flex flex-wrap gap-2"><SlaChip c={c} now={now} /><ChannelBadge channel={c.channel} /><Badge variant={c.priority === "high" ? "danger" : c.priority === "medium" ? "warning" : "neutral"} dot>{t(`priority.${c.priority}`)}</Badge></div>
            </div>
            <div className="scrollbar-thin flex-1 space-y-5 overflow-y-auto px-6 py-5">
              <div>
                <p className="mb-1.5 text-xs font-medium text-fg-3">{c.channel === "whatsapp" ? t("message") : t("description")}</p>
                <blockquote className="rounded-lg border border-line bg-surface-2 p-3 text-sm text-fg">{c.description}</blockquote>
                {c.photo && <div className="mt-2 overflow-hidden rounded-lg border border-line">{c.photo.startsWith("data:") ? <img src={c.photo} alt={t("photo")} className="max-h-60 w-full object-cover" /> : <ComplaintPhoto kind={c.photo} className="h-48 w-full" />}</div>}
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-fg-3">{t("timeline")}</p>
                <ol className="relative space-y-4 border-l border-line pl-5">
                  {c.updates.map((u, i) => (
                    <li key={i} className="relative">
                      <span className={cn("absolute top-1 -left-[25px] grid size-2.5 place-items-center rounded-full ring-4 ring-surface", u.kind === "resolved" ? "bg-success" : u.kind === "created" ? "bg-brand" : "bg-fg-3")} aria-hidden />
                      <p className="text-sm text-fg">{t(`event.${u.kind}`, { channel: u.kind === "created" ? tch(u.by as Channel) : "", name: staffById[u.by]?.name ?? u.by })}</p>
                      <p className="text-xs text-fg-3 tnum">{f.weekday(u.at)}, {f.time(u.at)}</p>
                    </li>
                  ))}
                  {c.rating && <li className="relative"><span className="absolute top-1 -left-[25px] size-2.5 rounded-full bg-warning ring-4 ring-surface" aria-hidden /><p className="text-sm text-fg">{t("rated", { rating: c.rating })}</p></li>}
                </ol>
              </div>
              {c.channel !== "walk_in" && <p className="flex items-start gap-2 rounded-md bg-brand-tint/60 p-3 text-small text-brand-tint-fg"><MessageCircle className="mt-0.5 size-4 shrink-0" aria-hidden />{t("autoUpdates")}</p>}
            </div>
            <div className="flex flex-wrap gap-2 border-t border-line px-6 py-4">
              {c.status === "new" && <Button variant="primary" className="flex-1" onClick={() => setStatus(c.id, "in_progress")} data-tour="complaint-start"><Wrench /> {t("start")}</Button>}
              {c.status === "in_progress" && <Button variant="primary" className="flex-1" onClick={() => setStatus(c.id, "resolved")} data-tour="complaint-resolve"><CheckCircle2 /> {t("resolve")}</Button>}
              {c.status === "resolved" && <Button variant="secondary" className="flex-1" onClick={() => setStatus(c.id, "in_progress")}><CircleDot /> {t("reopen")}</Button>}
              <Button variant="quiet" onClick={() => { openWhatsApp(thread?.id ?? null); onClose(); }}><MessageCircle /> {t("openChat")}</Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function LogDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useTranslations("complaints.logDialog");
  const tc = useTranslations("category");
  const residents = useDemo((s) => s.residents);
  const addComplaint = useDemo((s) => s.addComplaint);
  const [residentQ, setResidentQ] = useState("");
  const [residentId, setResidentId] = useState("");
  const [category, setCategory] = useState<ComplaintCategory>("electrical");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const matches = residentQ.length > 1 ? residents.filter((r) => r.status !== "checked_out" && (r.name.toLowerCase().includes(residentQ.toLowerCase()) || r.bedId.toLowerCase().includes(residentQ.toLowerCase()))).slice(0, 5) : [];
  const chosen = residents.find((r) => r.id === residentId);
  const submit = () => {
    if (!residentId) return setErr(t("errResident"));
    if (title.trim().length < 3) return setErr(t("errTitle"));
    addComplaint({ residentId, category, title: title.trim(), description: desc.trim() || title.trim(), channel: "walk_in" });
    onOpenChange(false);
    setResidentId(""); setResidentQ(""); setTitle(""); setDesc(""); setErr(null);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("title")}</DialogTitle><DialogDescription>{t("body")}</DialogDescription></DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="lg-res">{t("resident")}</Label>
            {chosen ? (
              <div className="flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm"><UserRound className="size-4 text-fg-3" aria-hidden /><span className="flex-1">{chosen.name} · <span className="font-mono text-xs">{chosen.bedId}</span></span><Button variant="quiet" size="xs" onClick={() => setResidentId("")}>{t("change")}</Button></div>
            ) : (
              <>
                <Input id="lg-res" value={residentQ} onChange={(e) => { setResidentQ(e.target.value); setErr(null); }} placeholder={t("residentPlaceholder")} autoComplete="off" />
                {matches.length > 0 && (
                  <ul className="rounded-md border border-line">
                    {matches.map((r) => <li key={r.id}><button className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-2" onClick={() => setResidentId(r.id)}><Avatar name={r.name} size={22} />{r.name}<span className="ml-auto font-mono text-xs text-fg-3">{r.bedId}</span></button></li>)}
                  </ul>
                )}
              </>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label>{t("category")}</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as ComplaintCategory)}>
              <SelectTrigger className="w-full"><SelectValue>{tc(category)}</SelectValue></SelectTrigger>
              <SelectContent>{CATS.map((c) => <SelectItem key={c} value={c}>{tc(c)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5"><Label htmlFor="lg-title">{t("what")}</Label><Input id="lg-title" value={title} onChange={(e) => { setTitle(e.target.value); setErr(null); }} placeholder={t("whatPlaceholder")} /></div>
          <div className="grid gap-1.5"><Label htmlFor="lg-desc">{t("details")}</Label><Textarea id="lg-desc" value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} /></div>
          {err && <p className="text-xs text-danger-fg" role="alert">{err}</p>}
        </div>
        <DialogFooter><Button variant="quiet" onClick={() => onOpenChange(false)}>{t("cancel")}</Button><Button variant="primary" onClick={submit}>{t("submit")}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export const _icons = { Timer };
