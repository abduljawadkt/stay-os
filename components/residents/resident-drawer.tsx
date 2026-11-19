"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { BedDouble, CalendarDays, Clock, Home, MessageCircle, Phone, Soup, UserRound, Wrench, ArrowRight, Plus, Users } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar } from "@/components/common/avatar";
import { InvoiceChip, KycChip } from "@/components/common/chips";
import { useUI } from "@/components/shell/ui-store";
import { useDemo } from "@/lib/store";
import { useFormat } from "@/lib/hooks";
import { roomById } from "@/lib/selectors";
import { todayISO } from "@/lib/clock";

function Row({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-fg-3" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-fg-3">{label}</p>
        <div className="mt-0.5 text-sm text-fg">{children}</div>
      </div>
    </div>
  );
}

export function ResidentDrawer() {
  const t = useTranslations("drawer");
  const tr = useTranslations("roomType");
  const trel = useTranslations("relation");
  const f = useFormat();
  const id = useUI((s) => s.residentId);
  const close = useUI((s) => s.openResident);
  const residents = useDemo((s) => s.residents);
  const beds = useDemo((s) => s.beds);
  const invoices = useDemo((s) => s.invoices);
  const whatsapp = useDemo((s) => s.whatsapp);
  const openWhatsApp = useDemo((s) => s.openWhatsApp);
  const moveResident = useDemo((s) => s.moveResident);
  const [moveTo, setMoveTo] = useState<string>("");
  const r = residents.find((x) => x.id === id);
  const today = todayISO();
  const room = r ? roomById[r.bedId.split("-").slice(0, 2).join("-")] : null;
  const roommates = useMemo(() => (r ? residents.filter((x) => x.id !== r.id && x.status !== "checked_out" && x.bedId.startsWith(`${room?.id}-`)) : []), [r, residents, room]);
  const latest = r ? invoices.filter((i) => i.residentId === r.id).sort((a, b) => b.month.localeCompare(a.month))[0] : undefined;
  const vacant = useMemo(() => (r ? beds.filter((b) => b.status === "vacant" && (b.block === "C") === (r.gender === "F")) : []), [beds, r]);
  const thread = r ? whatsapp.find((w) => w.residentId === r.id && w.role === "resident") : undefined;

  return (
    <Sheet open={!!r} onOpenChange={(o) => !o && close(null)}>
      <SheetContent className="flex flex-col p-0">
        {r && room && (
          <>
            <div className="border-b border-line px-6 pt-6 pb-5">
              <div className="flex items-start gap-3 pr-8">
                <Avatar name={r.name} size={44} />
                <div className="min-w-0">
                  <SheetTitle>{r.name}</SheetTitle>
                  <SheetDescription className="mt-0.5 text-small text-fg-2">{r.institution}</SheetDescription>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="inline-flex h-[22px] items-center gap-1 rounded-full bg-brand-tint px-2 font-mono text-xs font-medium text-brand-tint-fg"><BedDouble className="size-3" aria-hidden />{r.bedId}</span>
                <KycChip status={r.kyc.status} />
                {latest && <InvoiceChip inv={latest} today={today} />}
              </div>
            </div>
            <div className="scrollbar-thin flex-1 overflow-y-auto px-6 py-2">
              <div className="divide-y divide-line">
                <Row icon={Phone} label={t("phone")}><a href={`tel:${r.phone.replace(/\s/g, "")}`} className="tnum hover:underline">{r.phone}</a></Row>
                <Row icon={UserRound} label={t("parent", { relation: trel(r.parent.relation) })}>{r.parent.name} · <a href={`tel:${r.parent.phone.replace(/\s/g, "")}`} className="tnum hover:underline">{r.parent.phone}</a></Row>
                <Row icon={Home} label={t("hometown")}>{r.hometown}</Row>
                <Row icon={CalendarDays} label={t("checkedIn")}>{f.date(r.checkInDate)}{r.status === "notice" && r.checkOutDate ? ` · ${t("leaving", { date: f.date(r.checkOutDate) })}` : ""}</Row>
                <Row icon={BedDouble} label={t("room")}>{t("roomValue", { type: tr(room.type), rent: f.inr(room.rent) })}</Row>
                <Row icon={Soup} label={t("mess")}>{r.messPlan ? t("messOn") : t("messOff")}</Row>
                {latest && (
                  <Row icon={Clock} label={t("latestInvoice", { month: f.month(latest.month) })}>
                    <span className="tnum">{f.inr(latest.total)}</span> <span className="font-mono text-xs text-fg-3">{latest.id}</span>
                  </Row>
                )}
              </div>
              <div className="mt-4">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-fg-3"><Users className="size-3.5" aria-hidden /> {t("roommates")}</p>
                {roommates.length === 0 ? <p className="text-small text-fg-2">{t("noRoommates")}</p> : (
                  <ul className="space-y-2">
                    {roommates.map((m) => (
                      <li key={m.id} className="flex items-center gap-2.5 text-sm">
                        <Avatar name={m.name} size={24} /> <span className="flex-1 truncate">{m.name}</span> <span className="font-mono text-xs text-fg-3">{m.bedId}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="mt-6 rounded-lg border border-line p-4">
                <p className="text-sm font-medium text-fg">{t("moveTitle")}</p>
                <p className="mt-0.5 text-small text-fg-2">{t("moveBody")}</p>
                <div className="mt-3 flex gap-2">
                  <Select value={moveTo} onValueChange={setMoveTo}>
                    <SelectTrigger className="flex-1" aria-label={t("moveTitle")}><SelectValue placeholder={t("movePlaceholder")} /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      {vacant.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          <span className="font-mono">{b.id}</span> · {tr(roomById[b.roomId].type)} · {f.inr(roomById[b.roomId].rent)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="secondary" disabled={!moveTo} onClick={() => { moveResident(r.id, moveTo); setMoveTo(""); }}>{t("move")}</Button>
                </div>
              </div>
            </div>
            <div className="flex gap-2 border-t border-line px-6 py-4">
              <Button variant="secondary" asChild className="flex-1">
                <Link href={`/dashboard/residents/profile/?id=${r.id}`} onClick={() => close(null)}>{t("profile")} <ArrowRight /></Link>
              </Button>
              <Button variant="quiet" onClick={() => { openWhatsApp(thread?.id ?? null); close(null); }}>
                <MessageCircle /> {t("whatsapp")}
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function BedDrawer() {
  const t = useTranslations("drawer");
  const tr = useTranslations("roomType");
  const tb = useTranslations("bedStatus");
  const f = useFormat();
  const bedId = useUI((s) => s.bedId);
  const close = useUI((s) => s.openBed);
  const openCheckIn = useUI((s) => s.openCheckIn);
  const beds = useDemo((s) => s.beds);
  const residents = useDemo((s) => s.residents);
  const markBedReady = useDemo((s) => s.markBedReady);
  const bed = beds.find((b) => b.id === bedId);
  const room = bed ? roomById[bed.roomId] : null;
  const occupants = bed ? residents.filter((r) => r.status !== "checked_out" && r.bedId.startsWith(`${bed.roomId}-`)) : [];
  return (
    <Sheet open={!!bed} onOpenChange={(o) => !o && close(null)}>
      <SheetContent className="flex flex-col p-0">
        {bed && room && (
          <>
            <div className="border-b border-line px-6 pt-6 pb-5 pr-14">
              <SheetTitle>{t(`bedTitle.${bed.status === "occupied" ? "vacant" : bed.status}`, { bed: `${bed.roomId} · ${t("bedN", { n: bed.label })}` })}</SheetTitle>
              <SheetDescription className="mt-1 text-small text-fg-2">{t("roomValue", { type: tr(room.type), rent: f.inr(room.rent) })} · {room.bath === "attached" ? t("attachedBath") : t("commonBath")}</SheetDescription>
            </div>
            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
              {bed.status === "reserved" && bed.reservation && (
                <div className="rounded-lg bg-warning-tint p-4 text-warning-fg">
                  <p className="flex items-center gap-1.5 text-sm font-medium"><Clock className="size-4" aria-hidden /> {t("reservedFor", { name: bed.reservation.name })}</p>
                  <p className="mt-1 text-small">{t("arriving", { date: f.date(bed.reservation.from), amount: f.inr(bed.reservation.advance) })}</p>
                  <p className="mt-1 text-small tnum">{bed.reservation.phone}</p>
                </div>
              )}
              {bed.status === "maintenance" && (
                <div className="rounded-lg bg-surface-2 p-4">
                  <p className="flex items-center gap-1.5 text-sm font-medium text-fg"><Wrench className="size-4" aria-hidden /> {tb("maintenance")}</p>
                  <p className="mt-1 text-small text-fg-2">{bed.maintenanceNote}</p>
                </div>
              )}
              <div>
                <p className="mb-2 text-xs font-medium text-fg-3">{t("inThisRoom", { count: occupants.length, capacity: room.capacity })}</p>
                {occupants.length === 0 ? <p className="text-small text-fg-2">{t("emptyRoom")}</p> : (
                  <ul className="space-y-2">
                    {occupants.map((m) => (
                      <li key={m.id} className="flex items-center gap-2.5 text-sm"><Avatar name={m.name} size={24} /> <span className="flex-1 truncate">{m.name}</span><span className="truncate text-xs text-fg-3">{m.institution.split(" · ")[0]}</span></li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <div className="flex gap-2 border-t border-line px-6 py-4">
              {bed.status === "maintenance" ? (
                <Button variant="primary" className="flex-1" onClick={() => { markBedReady(bed.id); close(null); }}>{t("markReady")}</Button>
              ) : (
                <Button variant="primary" className="flex-1" onClick={() => openCheckIn(bed.id)}><Plus /> {bed.status === "reserved" && bed.reservation ? t("checkInName", { name: bed.reservation.name }) : t("checkInHere")}</Button>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
