"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  ArrowLeft, BedDouble, CalendarDays, Copy, Droplet, Eye, FileCheck2, FileText, Fingerprint, GraduationCap, Home, IdCard, LogIn, LogOut, MessageCircle,
  Phone, ShieldCheck, Soup, UserRound, UserX, Wallet, AlertTriangle,
} from "lucide-react";
import { Card, CardHeader } from "@/components/common/card";
import { EmptyState, ErrorState, Sk } from "@/components/common/states";
import { Avatar } from "@/components/common/avatar";
import { InvoiceChip, KycChip, LeaveChip, PoliceChip } from "@/components/common/chips";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DocumentViewer, type DocKind } from "./documents";
import { useDemo } from "@/lib/store";
import { useIsSample } from "@/lib/session";
import { useUI } from "@/components/shell/ui-store";
import { useFormat, useScreenState } from "@/lib/hooks";
import { roomById } from "@/lib/selectors";
import { todayISO } from "@/lib/clock";
import { brand } from "@/config/brand";
import { hostel } from "@/data";
import { cn } from "@/lib/utils";

export function ProfileScreen() {
  const t = useTranslations("profile");
  const tr = useTranslations("roomType");
  const trel = useTranslations("relation");
  const tm = useTranslations("method");
  const f = useFormat();
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const [tab, setTab] = useState(params.get("tab") ?? "overview");
  const [doc, setDoc] = useState<DocKind | null>(null);
  // real hostels: the office checks the original Aadhaar card and types the police station's reference number
  const sample = useIsSample();
  const [last4, setLast4] = useState("");
  const [seen, setSeen] = useState(false);
  const [policeRef, setPoliceRef] = useState("");
  const { loading, error, retry } = useScreenState(`profile-${id}`);
  const residents = useDemo((s) => s.residents);
  const invoices = useDemo((s) => s.invoices);
  const gate = useDemo((s) => s.gate);
  const leaves = useDemo((s) => s.leaves);
  const complaints = useDemo((s) => s.complaints);
  const whatsapp = useDemo((s) => s.whatsapp);
  const openWhatsApp = useDemo((s) => s.openWhatsApp);
  const submitPolice = useDemo((s) => s.submitPolice);
  const verifyKyc = useDemo((s) => s.verifyKyc);
  const openResident = useUI((s) => s.openResident);
  const r = residents.find((x) => x.id === id);
  const today = todayISO();
  const myInvoices = useMemo(() => invoices.filter((i) => i.residentId === id).sort((a, b) => b.month.localeCompare(a.month)), [invoices, id]);
  const myGate = useMemo(() => gate.filter((g) => g.residentId === id).slice(0, 30), [gate, id]);
  const myLeaves = useMemo(() => leaves.filter((l) => l.residentId === id), [leaves, id]);
  const myComplaints = useMemo(() => complaints.filter((c) => c.residentId === id), [complaints, id]);

  if (!loading && !r) {
    return (
      <Card className="mt-6">
        <EmptyState icon={UserX} title={t("notFound")} body={t("notFoundBody")} action={<Button variant="secondary" asChild><Link href="/dashboard/residents/">{t("back")}</Link></Button>} />
      </Card>
    );
  }
  const room = r ? roomById[r.bedId.split("-").slice(0, 2).join("-")] : null;
  const roommates = r ? residents.filter((x) => x.id !== r.id && x.status !== "checked_out" && x.bedId.startsWith(`${room?.id}-`)) : [];
  const paid = myInvoices.filter((i) => i.status === "paid").reduce((a, i) => a + i.total, 0);
  const due = myInvoices.filter((i) => i.status === "unpaid").reduce((a, i) => a + i.total, 0);
  const thread = r ? whatsapp.find((w) => w.residentId === r.id && w.role === "resident") : undefined;
  const upiLink = (amount: number, inv: string) => `upi://pay?pa=${hostel.upiId}&pn=${encodeURIComponent(hostel.name)}&am=${amount}&cu=INR&tn=${inv}`;

  return (
    <>
      <Link href="/dashboard/residents/" className="mb-4 inline-flex items-center gap-1.5 rounded-sm text-small font-medium text-fg-2 hover:text-fg">
        <ArrowLeft className="size-4" aria-hidden /> {t("back")}
      </Link>
      {loading || !r || !room ? (
        <div className="space-y-4"><Sk className="h-16 w-80" /><Sk className="h-10 w-full" /><Sk className="h-64 w-full" /></div>
      ) : error ? (
        <Card><ErrorState what={t("what")} onRetry={retry} /></Card>
      ) : (
        <>
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <Avatar name={r.name} size={56} />
              <div className="min-w-0">
                <h1 className="text-page font-semibold tracking-[-0.015em] text-fg">{r.name}</h1>
                <p className="text-sm text-fg-2">{r.institution}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="inline-flex h-[22px] items-center gap-1 rounded-full bg-brand-tint px-2 font-mono text-xs font-medium text-brand-tint-fg"><BedDouble className="size-3" aria-hidden />{r.bedId}</span>
                  <KycChip status={r.kyc.status} />
                  {r.status === "notice" && <Badge variant="warning" dot>{t("leavingOn", { date: f.day(r.checkOutDate ?? today) })}</Badge>}
                  {r.status === "checked_out" && <Badge variant="neutral">{t("checkedOut", { date: f.date(r.checkOutDate ?? today) })}</Badge>}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" asChild><a href={`tel:${r.phone.replace(/\s/g, "")}`}><Phone /> {t("call")}</a></Button>
              <Button variant="secondary" onClick={() => openWhatsApp(thread?.id ?? null)}><MessageCircle /> {t("whatsapp")}</Button>
              {r.status !== "checked_out" && <Button variant="quiet" onClick={() => openResident(r.id)}>{t("moveBed")}</Button>}
            </div>
          </div>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList variant="line" className="mb-5 w-full justify-start overflow-x-auto border-b border-line">
              {["overview", "kyc", "payments", "inout", "police"].map((k) => <TabsTrigger key={k} value={k}>{t(`tabs.${k}`)}</TabsTrigger>)}
            </TabsList>

            <TabsContent value="overview">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                  <CardHeader title={t("details")} />
                  <dl className="grid gap-x-8 px-5 pb-5 sm:grid-cols-2">
                    <Item icon={Phone} label={t("phone")} value={r.phone} />
                    <Item icon={CalendarDays} label={t("dob")} value={r.dob ? f.date(r.dob) : "—"} />
                    <Item icon={Droplet} label={t("blood")} value={r.bloodGroup} />
                    <Item icon={Home} label={t("hometown")} value={r.hometown} />
                    <Item icon={GraduationCap} label={t("occupation")} value={r.institution} />
                    <Item icon={LogIn} label={t("checkIn")} value={f.date(r.checkInDate)} />
                    <Item icon={Wallet} label={t("deposit")} value={f.inr(r.deposit)} />
                    <Item icon={Soup} label={t("mess")} value={r.messPlan ? t("messOn", { fee: f.inr(hostel.messFee) }) : t("messOff")} />
                  </dl>
                </Card>
                <div className="space-y-4">
                  <Card>
                    <CardHeader title={t("parent")} />
                    <div className="flex items-center gap-3 px-5 pb-5">
                      <Avatar name={r.parent.name} size={36} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-fg">{r.parent.name}</p>
                        <p className="text-xs text-fg-3">{trel(r.parent.relation)} · <span className="tnum">{r.parent.phone}</span></p>
                      </div>
                      <Button variant="quiet" size="icon" asChild aria-label={t("callParent")}><a href={`tel:${r.parent.phone.replace(/\s/g, "")}`}><Phone /></a></Button>
                    </div>
                  </Card>
                  <Card>
                    <CardHeader title={t("room", { room: room.id })} meta={`${tr(room.type)} · ${f.inr(room.rent)}`} />
                    <ul className="space-y-2 px-5 pb-5">
                      {roommates.length === 0 ? <li className="text-small text-fg-2">{t("noRoommates")}</li> : roommates.map((m) => (
                        <li key={m.id}>
                          <Link href={`/dashboard/residents/profile/?id=${m.id}`} className="flex items-center gap-2.5 rounded-sm text-sm hover:underline">
                            <Avatar name={m.name} size={24} /> <span className="flex-1 truncate">{m.name}</span> <span className="font-mono text-xs text-fg-3">{m.bedId}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </Card>
                </div>
                <Card className="lg:col-span-3">
                  <CardHeader title={t("complaints")} meta={t("complaintsMeta", { count: myComplaints.length })} />
                  {myComplaints.length === 0 ? <EmptyState icon={FileCheck2} title={t("noComplaints")} className="py-6" /> : (
                    <ul className="divide-y divide-line px-5 pb-2">
                      {myComplaints.slice(0, 5).map((c) => (
                        <li key={c.id} className="flex items-center gap-3 py-2.5 text-sm">
                          <span className="font-mono text-xs text-fg-3">{c.id}</span>
                          <span className="flex-1 truncate text-fg">{c.title}</span>
                          <Badge variant={c.status === "resolved" ? "success" : c.status === "in_progress" ? "brand" : "warning"} dot>{t(`complaintStatus.${c.status}`)}</Badge>
                          <span className="w-20 text-right text-xs text-fg-3 tnum">{f.day(c.createdAt)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="kyc">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <Card className="lg:col-span-1">
                  <div className="p-5">
                    <div className="flex items-center gap-3">
                      <span className={cn("grid size-10 place-items-center rounded-lg", r.kyc.status === "verified" ? "bg-success-tint text-success-fg" : "bg-warning-tint text-warning-fg")}>
                        {r.kyc.status === "verified" ? <ShieldCheck className="size-5" aria-hidden /> : <Fingerprint className="size-5" aria-hidden />}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-fg">{t("kyc.title")}</p>
                        <p className="text-xs text-fg-3">{r.kyc.status !== "verified" ? t("kyc.notChecked") : r.kyc.method === "digilocker" ? t("kyc.digilocker") : t("kyc.offline")}</p>
                      </div>
                    </div>
                    <dl className="mt-4 space-y-3 text-sm">
                      <div className="flex justify-between"><dt className="text-fg-2">{t("kyc.aadhaar")}</dt><dd className="font-mono text-fg">{r.kyc.aadhaarLast4 ? `XXXX XXXX ${r.kyc.aadhaarLast4}` : "—"}</dd></div>
                      <div className="flex justify-between"><dt className="text-fg-2">{t("kyc.status")}</dt><dd><KycChip status={r.kyc.status} /></dd></div>
                      {r.kyc.verifiedOn && <div className="flex justify-between"><dt className="text-fg-2">{t("kyc.on")}</dt><dd className="text-fg tnum">{f.date(r.kyc.verifiedOn)}</dd></div>}
                    </dl>
                    {r.kyc.status === "verified" ? (
                      <p className="mt-4 rounded-md bg-surface-2 p-3 text-xs text-fg-2">{r.kyc.method === "digilocker" ? t("kyc.matched") : t("kyc.matchedOffline")}</p>
                    ) : sample ? (
                      <Button variant="primary" className="mt-4 w-full" onClick={() => verifyKyc(r.id)}><Fingerprint /> {t("kyc.verifyNow")}</Button>
                    ) : (
                      <div className="mt-4 space-y-3 border-t border-line pt-4">
                        <div>
                          <label htmlFor="kyc-last4" className="text-xs text-fg-3">{t("kyc.last4")}</label>
                          <Input id="kyc-last4" value={last4 || r.kyc.aadhaarLast4} inputMode="numeric" maxLength={4} autoComplete="off" className="mt-1 font-mono tnum"
                            onChange={(e) => setLast4(e.target.value.replace(/\D/g, "").slice(0, 4))} />
                        </div>
                        <label htmlFor="kyc-seen" className="flex items-start gap-2.5 text-sm text-fg">
                          <Checkbox id="kyc-seen" checked={seen} onCheckedChange={(v) => setSeen(v === true)} className="mt-0.5" />
                          <span>{t("kyc.seen")}</span>
                        </label>
                        <Button variant="primary" className="w-full" disabled={!seen || !/^\d{4}$/.test(last4 || r.kyc.aadhaarLast4)}
                          onClick={() => { verifyKyc(r.id, { aadhaarLast4: last4 || r.kyc.aadhaarLast4 }); setSeen(false); setLast4(""); }}>
                          <ShieldCheck /> {t("kyc.markChecked")}
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
                <Card className="lg:col-span-2">
                  <CardHeader title={t("docs.title")} meta={t("docs.meta")} />
                  <ul className="divide-y divide-line px-2 pb-2">
                    {([
                      ["aadhaar", Fingerprint, r.kyc.status === "verified"],
                      ["id", IdCard, true],
                      ["agreement", FileText, true],
                      ["police", FileCheck2, true],
                    ] as [DocKind, React.ElementType, boolean][]).filter(([k]) => sample || k === "agreement" || k === "police").map(([k, Icon, ok]) => (
                      <li key={k} className="flex items-center gap-3 px-3 py-3">
                        <span className="grid size-9 place-items-center rounded-md bg-surface-2 text-fg-2"><Icon className="size-4" aria-hidden /></span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-fg">{t(`docs.${k}`)}</p>
                          <p className="text-xs text-fg-3">{t(!sample && k === "agreement" ? "docs.agreementPrint" : `docs.${k}Meta`, { date: f.date(r.checkInDate), brand: brand.name })}</p>
                        </div>
                        {ok ? <Button variant="quiet" size="sm" onClick={() => setDoc(k)}><Eye /> {t("docs.view")}</Button> : <Badge variant="warning">{t("docs.missing")}</Badge>}
                      </li>
                    ))}
                  </ul>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="payments">
              <div className="mb-4 grid gap-4 sm:grid-cols-3">
                <Stat label={t("pay.paid")} value={f.inr(paid)} />
                <Stat label={t("pay.due")} value={f.inr(due)} tone={due > 0 ? "danger" : undefined} />
                <Stat label={t("pay.monthly")} value={f.inr(room.rent + (r.messPlan ? hostel.messFee : 0))} />
              </div>
              <Card>
                <div className="scrollbar-thin relative overflow-x-auto">
                  <table className="w-full min-w-[720px] text-sm">
                    <thead><tr className="border-b border-line text-left text-xs text-fg-2">
                      <th className="py-2.5 pr-3 pl-5 font-medium">{t("pay.month")}</th><th className="px-3 font-medium">{t("pay.invoice")}</th>
                      <th className="px-3 text-right font-medium">{t("pay.amount")}</th><th className="px-3 font-medium">{t("pay.status")}</th>
                      <th className="px-3 font-medium">{t("pay.paidOn")}</th><th className="py-2.5 pr-5 pl-3 font-medium">{t("pay.ref")}</th>
                    </tr></thead>
                    <tbody>
                      {myInvoices.map((i) => (
                        <tr key={i.id} className="border-b border-line last:border-0">
                          <td className="py-2.5 pr-3 pl-5 text-fg">{f.month(i.month)}</td>
                          <td className="px-3 font-mono text-xs text-fg-2">{i.id}</td>
                          <td className="px-3 text-right text-fg tnum">{f.inr(i.total)}</td>
                          <td className="px-3"><InvoiceChip inv={i} today={today} /></td>
                          <td className="px-3 text-fg-2 tnum">{i.paidOn ? `${f.day(i.paidOn)} · ${tm(i.method ?? "upi")}` : "—"}</td>
                          <td className="py-2.5 pr-5 pl-3">
                            {i.status === "paid" ? <span className="font-mono text-xs text-fg-3">{i.utr ?? "—"}</span> : (
                              <Button variant="quiet" size="xs" onClick={() => { navigator.clipboard?.writeText(upiLink(i.total, i.id)); toast(t("pay.copied")); }}><Copy /> {t("pay.copy")}</Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="inout">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                  <CardHeader title={t("gate.title")} meta={t("gate.meta")} />
                  {myGate.length === 0 ? <EmptyState icon={LogIn} title={t("gate.empty")} /> : (
                    <ol className="px-5 pb-4">
                      {myGate.map((g) => (
                        <li key={g.id} className="flex items-center gap-3 border-b border-line py-2.5 text-sm last:border-0">
                          <span className={cn("grid size-7 place-items-center rounded-full", g.type === "in" ? "bg-success-tint text-success-fg" : "bg-surface-2 text-fg-2")}>
                            {g.type === "in" ? <LogIn className="size-3.5" aria-hidden /> : <LogOut className="size-3.5" aria-hidden />}
                          </span>
                          <span className="flex-1 text-fg">{g.type === "in" ? t("gate.in") : t("gate.out")} <span className="text-xs text-fg-3">· {g.method === "qr" ? "QR" : t("gate.manual")}</span></span>
                          {g.late && <Badge variant="danger"><AlertTriangle aria-hidden />{t("gate.late")}</Badge>}
                          <span className="w-36 text-right text-xs text-fg-2 tnum">{f.weekday(g.at)}, {f.time(g.at)}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </Card>
                <Card>
                  <CardHeader title={t("leaves")} />
                  {myLeaves.length === 0 ? <EmptyState icon={CalendarDays} title={t("noLeaves")} className="py-6" /> : (
                    <ul className="space-y-3 px-5 pb-5">
                      {myLeaves.map((l) => (
                        <li key={l.id} className="rounded-md border border-line p-3 text-sm">
                          <div className="flex items-center justify-between gap-2"><span className="font-medium text-fg">{l.destination}</span><LeaveChip status={l.status} /></div>
                          <p className="mt-1 text-xs text-fg-2 tnum">{f.day(l.from)}, {f.time(l.from)} → {f.day(l.to)}, {f.time(l.to)}</p>
                          <p className="mt-0.5 text-xs text-fg-3">{l.reason}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="police">
              <Card className="max-w-2xl">
                <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start">
                  <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-surface-2 text-fg-2"><FileCheck2 className="size-6" aria-hidden /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold text-fg">{t("police.title")}</p><PoliceChip status={r.police.status} /></div>
                    <p className="mt-1 text-small text-fg-2">{sample ? t("police.body") : t("police.bodyReal")}</p>
                    <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                      {sample && <div><dt className="text-xs text-fg-3">{t("police.station")}</dt><dd className="text-fg">Nadakkavu PS, Kozhikode City</dd></div>}
                      <div><dt className="text-xs text-fg-3">{t("police.ref")}</dt><dd className="font-mono text-fg">{r.police.refNo ?? "—"}</dd></div>
                      <div><dt className="text-xs text-fg-3">{t("police.submitted")}</dt><dd className="text-fg tnum">{r.police.submittedOn ? f.date(r.police.submittedOn) : "—"}</dd></div>
                      <div><dt className="text-xs text-fg-3">{t("police.autofill")}</dt><dd className="text-fg">{t("police.autofillValue")}</dd></div>
                    </dl>
                    <div className="mt-5 flex flex-wrap gap-2">
                      <Button variant={r.police.status === "pending" ? "secondary" : "primary"} onClick={() => setDoc("police")} data-tour="police-preview"><Eye /> {t("police.preview")}</Button>
                      {r.police.status === "pending" && (sample ? (
                        <Button variant="primary" onClick={() => submitPolice(r.id)}>{t("police.markSubmitted")}</Button>
                      ) : (
                        <form className="flex min-w-0 flex-1 basis-full gap-2 sm:basis-auto" onSubmit={(e) => { e.preventDefault(); submitPolice(r.id, policeRef); setPoliceRef(""); }}>
                          <Input value={policeRef} onChange={(e) => setPoliceRef(e.target.value)} placeholder={t("police.refPlaceholder")} aria-label={t("police.ref")} className="min-w-0 flex-1 font-mono" maxLength={60} />
                          <Button type="submit" variant="primary">{t("police.markSubmitted")}</Button>
                        </form>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            </TabsContent>
          </Tabs>
          {doc && <DocumentViewer open={!!doc} onOpenChange={(o) => !o && setDoc(null)} resident={r} kind={doc} />}
        </>
      )}
    </>
  );
}

function Item({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 border-b border-line py-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-fg-3" aria-hidden />
      <div className="min-w-0"><dt className="text-xs text-fg-3">{label}</dt><dd className="mt-0.5 text-sm text-fg tnum">{value}</dd></div>
    </div>
  );
}
function Stat({ label, value, tone }: { label: string; value: string; tone?: "danger" }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <p className="text-small text-fg-2">{label}</p>
      <p className={cn("mt-1 text-title font-semibold tnum", tone === "danger" ? "text-danger-fg" : "text-fg")}>{value}</p>
    </div>
  );
}
