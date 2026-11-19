"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { AlertTriangle, CalendarClock, DoorOpen, LogIn, LogOut, MessageCircle, QrCode, Search, UserPlus, Users, BellRing, ShieldCheck } from "lucide-react";
import { Card, CardHeader, PageHeader } from "@/components/common/card";
import { EmptyState, ErrorState, Sk, TableSkeleton } from "@/components/common/states";
import { Avatar } from "@/components/common/avatar";
import { LeaveChip } from "@/components/common/chips";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDemo } from "@/lib/store";
import { useFormat, useNow, useScreenState } from "@/lib/hooks";
import { presence } from "@/lib/selectors";
import { toIST, todayISO } from "@/lib/clock";
import { simulateGateScan } from "@/lib/demo-actions";
import { hostel } from "@/data";
import { cn } from "@/lib/utils";

export function GateScreen() {
  const t = useTranslations("gate");
  const f = useFormat();
  const params = useSearchParams();
  const now = useNow(15000);
  const { loading, error, retry } = useScreenState("gate");
  const gate = useDemo((s) => s.gate);
  const residents = useDemo((s) => s.residents);
  const leaves = useDemo((s) => s.leaves);
  const visitors = useDemo((s) => s.visitors);
  const beds = useDemo((s) => s.beds);
  const checkoutVisitor = useDemo((s) => s.checkoutVisitor);
  const [tab, setTab] = useState(params.get("tab") ?? "log");
  const [dir, setDir] = useState<"all" | "in" | "out">("all");
  const [q, setQ] = useState("");
  const [visitorOpen, setVisitorOpen] = useState(false);
  const resById = useMemo(() => Object.fromEntries(residents.map((r) => [r.id, r])), [residents]);
  const pres = useMemo(() => presence(gate, residents, leaves, toIST(now)), [gate, residents, leaves, now]);
  const today = todayISO();
  const yday = new Date(new Date(`${today}T12:00:00+05:30`).getTime() - 86400000 + 330 * 60000).toISOString().slice(0, 10);
  const late = useMemo(() => gate.filter((g) => g.late).sort((a, b) => b.at.localeCompare(a.at)), [gate]);
  const lateLastNight = late.filter((g) => g.at.startsWith(yday) || g.at.startsWith(today)).length;
  const log = useMemo(() => {
    const s = q.trim().toLowerCase();
    return gate
      .filter((g) => g.at >= `${yday}T00:00`)
      .filter((g) => dir === "all" || g.type === dir)
      .filter((g) => !s || resById[g.residentId]?.name.toLowerCase().includes(s) || resById[g.residentId]?.bedId.toLowerCase().includes(s))
      .slice(0, 80);
  }, [gate, dir, q, resById, yday]);
  const blockOf = (id: string) => beds.find((b) => b.id === resById[id]?.bedId)?.block ?? "A";

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("subtitle", { curfew: "10:00 PM", curfewC: "9:30 PM" })}
        actions={
          <>
            <Button variant="secondary" onClick={() => simulateGateScan()}><QrCode /> {t("scan")}</Button>
            <Button variant="primary" onClick={() => setVisitorOpen(true)}><UserPlus /> {t("logVisitor")}</Button>
          </>
        }
      />
      {error ? <Card><ErrorState what={t("what")} onRetry={retry} /></Card> : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              { k: "inside", v: pres.inside, icon: LogIn },
              { k: "out", v: pres.out, icon: LogOut },
              { k: "leave", v: pres.leave, icon: CalendarClock },
              { k: "late", v: lateLastNight, icon: AlertTriangle },
            ].map((s) => (
              <div key={s.k} className="rounded-lg border border-line bg-surface p-4">
                <p className="flex items-center gap-1.5 text-small font-medium text-fg-2"><s.icon className="size-4 text-fg-3" aria-hidden />{t(`stat.${s.k}`)}</p>
                {loading ? <Sk className="mt-2 h-7 w-12" /> : <p className={cn("mt-1 text-[26px] leading-8 font-semibold tracking-[-0.02em] tnum", s.k === "late" && s.v > 0 ? "text-danger-fg" : "text-fg")}>{s.v}</p>}
              </div>
            ))}
          </div>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList variant="line" className="mb-4 w-full justify-start overflow-x-auto border-b border-line">
              <TabsTrigger value="log">{t("tabs.log")}</TabsTrigger>
              <TabsTrigger value="leaves">{t("tabs.leaves")} {leaves.filter((l) => l.status === "awaiting_parent").length > 0 && <Badge variant="warning" className="ml-1">{leaves.filter((l) => l.status === "awaiting_parent").length}</Badge>}</TabsTrigger>
              <TabsTrigger value="late">{t("tabs.late")}</TabsTrigger>
              <TabsTrigger value="visitors">{t("tabs.visitors")}</TabsTrigger>
            </TabsList>

            <TabsContent value="log">
              <Card>
                <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-success-tint px-2 py-0.5 text-xs font-medium text-success-fg"><span className="live-dot size-1.5 rounded-full bg-success" aria-hidden />{t("live")}</span>
                  <div role="tablist" aria-label={t("direction")} className="flex gap-1">
                    {(["all", "in", "out"] as const).map((k) => <button key={k} role="tab" aria-selected={dir === k} onClick={() => setDir(k)} className={cn("h-8 rounded-md px-2.5 text-small font-medium", dir === k ? "bg-surface-2 text-fg" : "text-fg-2 hover:text-fg")}>{t(`dir.${k}`)}</button>)}
                  </div>
                  <div className="relative sm:ml-auto sm:w-64">
                    <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-fg-3" aria-hidden />
                    <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")} aria-label={t("search")} className="pl-8" />
                  </div>
                </div>
                {loading ? <TableSkeleton rows={8} cols={4} /> : log.length === 0 ? <EmptyState icon={DoorOpen} title={t("emptyLog")} /> : (
                  <ul aria-live="polite">
                    <AnimatePresence initial={false}>
                      {log.map((g) => {
                        const r = resById[g.residentId];
                        return (
                          <motion.li key={g.id} layout initial={{ opacity: 0, backgroundColor: "var(--brand-tint)" }} animate={{ opacity: 1, backgroundColor: "rgba(0,0,0,0)" }} transition={{ duration: 1.2 }} className="flex items-center gap-3 border-b border-line px-5 py-2.5 text-sm last:border-0">
                            <span className={cn("grid size-7 place-items-center rounded-full", g.type === "in" ? "bg-success-tint text-success-fg" : "bg-surface-2 text-fg-2")}>{g.type === "in" ? <LogIn className="size-3.5" aria-hidden /> : <LogOut className="size-3.5" aria-hidden />}</span>
                            <span className="min-w-0 flex-1 truncate"><span className="font-medium text-fg">{r?.name}</span> <span className="font-mono text-xs text-fg-3">{r?.bedId}</span></span>
                            {g.passId && <Badge variant="brand">{t("onPass")}</Badge>}
                            {g.late && <Badge variant="danger"><AlertTriangle aria-hidden />{t("lateBadge")}</Badge>}
                            <span className="hidden w-14 text-xs text-fg-3 sm:block">{g.method === "qr" ? "QR" : t("manual")}</span>
                            <span className="w-32 text-right text-xs text-fg-2 tnum">{g.at.startsWith(today) ? t("today") : t("yesterday")}, {f.time(g.at)}</span>
                          </motion.li>
                        );
                      })}
                    </AnimatePresence>
                  </ul>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="leaves">
              <Card>
                <CardHeader title={t("leaves.title")} meta={t("leaves.meta")} />
                {leaves.length === 0 ? <EmptyState icon={CalendarClock} title={t("leaves.empty")} /> : (
                  <div className="scrollbar-thin overflow-x-auto">
                    <table className="w-full min-w-[860px] text-sm">
                      <thead><tr className="border-y border-line text-left text-xs text-fg-2">
                        <th className="py-2.5 pr-3 pl-5 font-medium">{t("leaves.resident")}</th><th className="px-3 font-medium">{t("leaves.when")}</th>
                        <th className="px-3 font-medium">{t("leaves.where")}</th><th className="px-3 font-medium">{t("leaves.status")}</th><th className="py-2.5 pr-5 pl-3 font-medium"><span className="sr-only">{t("leaves.actions")}</span></th>
                      </tr></thead>
                      <tbody>
                        {leaves.map((l) => {
                          const r = resById[l.residentId];
                          return (
                            <tr key={l.id} className="border-b border-line last:border-0">
                              <td className="py-2.5 pr-3 pl-5"><div className="flex items-center gap-2.5"><Avatar name={r?.name ?? ""} size={26} /><div><p className="font-medium text-fg">{r?.name}</p><p className="text-xs text-fg-3">{t("leaves.parent", { name: r?.parent.name ?? "" })}</p></div></div></td>
                              <td className="px-3 text-fg-2 tnum">{f.day(l.from)}, {f.time(l.from)} → {f.day(l.to)}, {f.time(l.to)}</td>
                              <td className="px-3"><p className="text-fg">{l.destination}</p><p className="max-w-56 truncate text-xs text-fg-3">{l.reason}</p></td>
                              <td className="px-3"><LeaveChip status={l.status} />{l.parentDecisionAt && <p className="mt-0.5 text-xs text-fg-3 tnum">{t("leaves.decided", { time: `${f.day(l.parentDecisionAt)}, ${f.time(l.parentDecisionAt)}` })}</p>}</td>
                              <td className="py-2.5 pr-5 pl-3 text-right">{l.status === "awaiting_parent" && <Button variant="quiet" size="sm" onClick={() => toast(t("leaves.nudged", { name: r?.parent.name ?? "" }))}><BellRing /> {t("leaves.nudge")}</Button>}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="late">
              <Card>
                <CardHeader title={t("late.title")} meta={t("late.meta")} />
                {late.length === 0 ? <EmptyState icon={ShieldCheck} title={t("late.empty")} /> : (
                  <ul>
                    {late.slice(0, 30).map((g) => {
                      const r = resById[g.residentId];
                      const curfew = blockOf(g.residentId) === "C" ? 21 * 60 + 30 : 22 * 60;
                      const mins = Number(g.at.slice(11, 13)) * 60 + Number(g.at.slice(14, 16)) - curfew;
                      return (
                        <li key={g.id} className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3 text-sm last:border-0">
                          <Avatar name={r?.name ?? ""} size={28} />
                          <span className="min-w-40 flex-1"><span className="font-medium text-fg">{r?.name}</span> <span className="font-mono text-xs text-fg-3">{r?.bedId}</span></span>
                          <Badge variant="danger">{t("late.after", { mins })}</Badge>
                          <span className="inline-flex items-center gap-1 text-xs text-fg-2"><MessageCircle className="size-3.5 fill-whatsapp text-whatsapp" aria-hidden />{t("late.notified")}</span>
                          <span className="w-32 text-right text-xs text-fg-2 tnum">{f.weekday(g.at)}, {f.time(g.at)}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="visitors">
              <Card>
                <CardHeader title={t("visitors.title")} meta={t("visitors.meta", { count: visitors.filter((v) => !v.outAt).length })} />
                {visitors.length === 0 ? <EmptyState icon={Users} title={t("visitors.empty")} /> : (
                  <div className="scrollbar-thin overflow-x-auto">
                    <table className="w-full min-w-[860px] text-sm">
                      <thead><tr className="border-y border-line text-left text-xs text-fg-2">
                        <th className="py-2.5 pr-3 pl-5 font-medium">{t("visitors.visitor")}</th><th className="px-3 font-medium">{t("visitors.visiting")}</th>
                        <th className="px-3 font-medium">{t("visitors.id")}</th><th className="px-3 font-medium">{t("visitors.in")}</th><th className="py-2.5 pr-5 pl-3 font-medium">{t("visitors.out")}</th>
                      </tr></thead>
                      <tbody>
                        {visitors.map((v) => {
                          const r = resById[v.residentId];
                          return (
                            <tr key={v.id} className="border-b border-line last:border-0">
                              <td className="py-2.5 pr-3 pl-5"><p className="font-medium text-fg">{v.name}</p><p className="text-xs text-fg-3">{v.relation} · {v.purpose}</p></td>
                              <td className="px-3"><p className="text-fg">{r?.name}</p><p className="font-mono text-xs text-fg-3">{r?.bedId}</p></td>
                              <td className="px-3 text-xs text-fg-2">{v.idProof} · <span className="font-mono">••{v.idLast4}</span></td>
                              <td className="px-3 text-fg-2 tnum">{f.weekday(v.inAt)}, {f.time(v.inAt)}</td>
                              <td className="py-2.5 pr-5 pl-3">{v.outAt ? <span className="text-fg-2 tnum">{f.time(v.outAt)}</span> : <div className="flex items-center gap-2"><Badge variant="brand" dot>{t("visitors.inside")}</Badge><Button variant="quiet" size="xs" onClick={() => checkoutVisitor(v.id)}>{t("visitors.checkout")}</Button></div>}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
      <VisitorDialog open={visitorOpen} onOpenChange={setVisitorOpen} />
      <span className="sr-only">{hostel.name}</span>
    </>
  );
}

function VisitorDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useTranslations("gate.visitorDialog");
  const residents = useDemo((s) => s.residents);
  const addVisitor = useDemo((s) => s.addVisitor);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [relation, setRelation] = useState("Father");
  const [rq, setRq] = useState("");
  const [rid, setRid] = useState("");
  const [idProof, setIdProof] = useState("Aadhaar");
  const [last4, setLast4] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const matches = rq.length > 1 && !rid ? residents.filter((r) => r.status !== "checked_out" && (r.name.toLowerCase().includes(rq.toLowerCase()) || r.bedId.toLowerCase().includes(rq.toLowerCase()))).slice(0, 5) : [];
  const submit = () => {
    if (name.trim().length < 3) return setErr(t("errName"));
    if (!rid) return setErr(t("errResident"));
    if (!/^\d{4}$/.test(last4)) return setErr(t("errId"));
    addVisitor({ name: name.trim(), phone: phone.trim() || "—", relation, residentId: rid, purpose: t("visit"), idProof, idLast4: last4 });
    toast(t("logged", { name: name.trim() }), { description: t("loggedSub") });
    onOpenChange(false);
    setName(""); setPhone(""); setRq(""); setRid(""); setLast4(""); setErr(null);
  };
  const chosen = residents.find((r) => r.id === rid);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("title")}</DialogTitle><DialogDescription>{t("body")}</DialogDescription></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5 sm:col-span-2"><Label htmlFor="v-name">{t("name")}</Label><Input id="v-name" value={name} onChange={(e) => { setName(e.target.value); setErr(null); }} /></div>
          <div className="grid gap-1.5"><Label htmlFor="v-phone">{t("phone")}</Label><Input id="v-phone" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="+91 98470 12345" /></div>
          <div className="grid gap-1.5"><Label>{t("relation")}</Label>
            <Select value={relation} onValueChange={setRelation}><SelectTrigger className="w-full"><SelectValue>{relation}</SelectValue></SelectTrigger>
              <SelectContent>{["Father", "Mother", "Brother", "Sister", "Uncle", "Cousin", "Friend"].map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="grid gap-1.5 sm:col-span-2"><Label htmlFor="v-res">{t("visiting")}</Label>
            {chosen ? <div className="flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm"><span className="flex-1">{chosen.name} · <span className="font-mono text-xs">{chosen.bedId}</span></span><Button variant="quiet" size="xs" onClick={() => setRid("")}>{t("change")}</Button></div> : (
              <>
                <Input id="v-res" value={rq} onChange={(e) => { setRq(e.target.value); setErr(null); }} placeholder={t("visitingPlaceholder")} autoComplete="off" />
                {matches.length > 0 && <ul className="rounded-md border border-line">{matches.map((r) => <li key={r.id}><button className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-2" onClick={() => setRid(r.id)}><Avatar name={r.name} size={22} />{r.name}<span className="ml-auto font-mono text-xs text-fg-3">{r.bedId}</span></button></li>)}</ul>}
              </>
            )}
          </div>
          <div className="grid gap-1.5"><Label>{t("idType")}</Label>
            <Select value={idProof} onValueChange={setIdProof}><SelectTrigger className="w-full"><SelectValue>{idProof}</SelectValue></SelectTrigger>
              <SelectContent>{["Aadhaar", "Driving licence", "Voter ID", "Passport"].map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="grid gap-1.5"><Label htmlFor="v-id">{t("last4")}</Label><Input id="v-id" value={last4} onChange={(e) => { setLast4(e.target.value.replace(/\D/g, "").slice(0, 4)); setErr(null); }} inputMode="numeric" className="font-mono" /></div>
          {err && <p className="text-xs text-danger-fg sm:col-span-2" role="alert">{err}</p>}
        </div>
        <DialogFooter><Button variant="quiet" onClick={() => onOpenChange(false)}>{t("cancel")}</Button><Button variant="primary" onClick={submit}>{t("submit")}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
