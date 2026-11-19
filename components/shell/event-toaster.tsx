"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CheckCircle2, IndianRupee, MessageCircle, RotateCcw } from "lucide-react";
import { useDemo } from "@/lib/store";
import { useFormat } from "@/lib/hooks";

/** Turns store events into short, specific toasts. */
export function EventToaster() {
  const t = useTranslations("toasts");
  const tm = useTranslations("meals");
  const f = useFormat();
  const router = useRouter();
  const ev = useDemo((s) => s.lastEvent);
  const seen = useRef<number | null>(null);
  useEffect(() => {
    if (!ev || seen.current === ev.id) return;
    const first = seen.current === null;
    seen.current = ev.id;
    if (first && ev.type !== "reset") return;
    const s = useDemo.getState();
    const name = (id: string) => s.residents.find((r) => r.id === id)?.name ?? "";
    const inDashboard = s.role === "owner" || s.role === "warden";
    switch (ev.type) {
      case "payment":
        toast(t("payment", { amount: f.inr(ev.amount), name: name(ev.residentId) }), {
          description: t("paymentSub", { method: ev.method.toUpperCase(), invoice: ev.invoiceId }),
          icon: <IndianRupee className="size-4" />,
          action: inDashboard ? { label: t("view"), onClick: () => router.push("/dashboard/rent/") } : undefined,
        });
        break;
      case "invoices_raised":
        toast(t("invoicesRaised", { count: ev.count, month: f.month(ev.month) }), { description: t("invoicesRaisedSub", { amount: f.inrCompact(ev.amount) }), icon: <CheckCircle2 className="size-4" /> });
        break;
      case "reminders_sent":
        toast(t("remindersSent", { count: ev.count }), { description: t("remindersSentSub"), icon: <MessageCircle className="size-4" /> });
        break;
      case "bed_moved":
        toast(t("bedMoved", { name: name(ev.residentId), bed: ev.to }), { icon: <CheckCircle2 className="size-4" /> });
        break;
      case "checkin":
        toast(t("checkin", { name: name(ev.residentId), bed: ev.bedId }), { icon: <CheckCircle2 className="size-4" /> });
        break;
      case "complaint":
        if (ev.channel === "whatsapp" && inDashboard) {
          const c = s.complaints.find((x) => x.id === ev.complaintId);
          toast(t("complaintWhatsApp", { id: ev.complaintId }), {
            description: c ? `${c.title} · ${c.roomId}` : undefined,
            icon: <MessageCircle className="size-4" />,
            action: { label: t("view"), onClick: () => router.push("/dashboard/complaints/") },
          });
        } else toast(t("complaintLogged", { id: ev.complaintId }), { icon: <CheckCircle2 className="size-4" /> });
        break;
      case "complaint_status":
        if (ev.status === "resolved") toast(t("complaintResolved", { id: ev.complaintId }), { description: t("residentUpdated"), icon: <CheckCircle2 className="size-4" /> });
        else if (ev.status === "in_progress") toast(t("complaintStarted", { id: ev.complaintId }), { description: t("residentUpdated") });
        break;
      case "optout":
        toast(ev.on ? t("mealSkipped", { meal: tm(ev.meal), date: f.day(ev.date) }) : t("mealRestored", { meal: tm(ev.meal), date: f.day(ev.date) }), { description: t("headcountUpdated") });
        break;
      case "leave":
        toast(ev.status === "approved" ? t("leaveApproved") : t("leaveRejected"), { description: t("leaveSub") });
        break;
      case "leave_requested":
        toast(t("leaveRequested"), { description: t("leaveRequestedSub") });
        break;
      case "expense":
        toast(t("expenseSaved"), { icon: <CheckCircle2 className="size-4" /> });
        break;
      case "gate":
        toast(ev.direction === "in" ? t("gateIn", { name: name(ev.residentId) }) : t("gateOut", { name: name(ev.residentId) }));
        break;
      case "reset":
        if (!first) toast(t("reset"), { icon: <RotateCcw className="size-4" /> });
        break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ev]);
  return null;
}
