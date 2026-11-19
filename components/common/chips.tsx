"use client";

import { Check, Clock, MessageCircle, Smartphone, UserRound, ShieldCheck, ShieldAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { invoiceState, sla } from "@/lib/selectors";
import { useFormat } from "@/lib/hooks";
import type { Channel, Complaint, Invoice, LeaveRequest, Resident } from "@/data";

export function InvoiceChip({ inv, today }: { inv: Invoice; today: string }) {
  const t = useTranslations("invoiceState");
  const { state, days } = invoiceState(inv, today);
  if (state === "paid") return <Badge variant="success"><Check aria-hidden />{t("paid")}</Badge>;
  if (state === "overdue") return <Badge variant="danger" dot>{t("overdue", { days })}</Badge>;
  if (state === "due_today") return <Badge variant="warning" dot>{t("due_today")}</Badge>;
  return <Badge variant="neutral" dot>{t("due", { days })}</Badge>;
}

export function KycChip({ status }: { status: Resident["kyc"]["status"] }) {
  const t = useTranslations("kyc");
  if (status === "verified") return <Badge variant="success"><ShieldCheck aria-hidden />{t("verified")}</Badge>;
  if (status === "manual") return <Badge variant="neutral">{t("manual")}</Badge>;
  return <Badge variant="warning"><ShieldAlert aria-hidden />{t("pending")}</Badge>;
}

export function PoliceChip({ status }: { status: Resident["police"]["status"] }) {
  const t = useTranslations("police");
  return <Badge variant={status === "approved" ? "success" : status === "submitted" ? "brand" : "warning"} dot>{t(status)}</Badge>;
}

export function ChannelBadge({ channel, compact }: { channel: Channel; compact?: boolean }) {
  const t = useTranslations("channel");
  if (channel === "whatsapp")
    return (
      <Badge variant="neutral" className="gap-1">
        <MessageCircle className="!size-3 fill-whatsapp text-whatsapp" aria-hidden />
        {!compact && t("whatsapp")}
        {compact && <span className="sr-only">{t("whatsapp")}</span>}
      </Badge>
    );
  const Icon = channel === "app" ? Smartphone : UserRound;
  return <Badge variant="neutral"><Icon aria-hidden />{t(channel)}</Badge>;
}

export function LeaveChip({ status }: { status: LeaveRequest["status"] }) {
  const t = useTranslations("leaveStatus");
  const v = status === "approved" ? "success" : status === "rejected" ? "danger" : status === "awaiting_parent" ? "warning" : "neutral";
  return <Badge variant={v} dot>{t(status)}</Badge>;
}

export function SlaChip({ c, now }: { c: Complaint; now: number }) {
  const t = useTranslations("complaints");
  const f = useFormat();
  const s = sla(c, now);
  if (s.state === "met") return <Badge variant="success"><Check aria-hidden />{t("slaMet", { time: f.duration(s.elapsed) })}</Badge>;
  if (s.state === "missed") return <Badge variant="neutral">{t("slaMissed", { time: f.duration(s.elapsed) })}</Badge>;
  if (s.state === "breached") return <Badge variant="danger"><Clock aria-hidden /><span className="tnum">{t("slaBreached", { time: f.duration(-s.remaining) })}</span></Badge>;
  return <Badge variant={s.state === "risk" ? "warning" : "neutral"}><Clock aria-hidden /><span className="tnum">{t("slaLeft", { time: f.duration(s.remaining) })}</span></Badge>;
}
