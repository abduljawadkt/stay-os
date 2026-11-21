"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "framer-motion";
import { Check, CheckCircle2, Lock, MessageCircle, ShieldCheck, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDemo } from "@/lib/store";
import { useFormat } from "@/lib/hooks";
import { haptic } from "@/lib/native";
import { invoiceState } from "@/lib/selectors";
import { todayISO } from "@/lib/clock";
import { demo } from "@/config/demo";
import { hostel } from "@/data";
import { QRCodeSVG } from "qrcode.react";
import { useSession } from "@/lib/session";
import { upiUri } from "@/lib/upi";
import { toast } from "sonner";
import { createPayLink, razorpayConnected } from "@/lib/payments";
import { AppHeader, MCard } from "./shell";
import { BackButton } from "./common";
import { cn } from "@/lib/utils";

const APPS = [
  { id: "gpay", name: "Google Pay", mark: "G", tint: "bg-[#e8f0fe] text-[#1a73e8]" },
  { id: "phonepe", name: "PhonePe", mark: "Pe", tint: "bg-[#efe7fb] text-[#5f259f]" },
  { id: "paytm", name: "Paytm", mark: "P", tint: "bg-[#e5f5fd] text-[#00a3e0]" },
  { id: "bhim", name: "BHIM UPI", mark: "B", tint: "bg-[#fdeee4] text-[#c2551b]" },
];

type Phase = "choose" | "pin" | "processing" | "redirecting" | "confirming" | "done";

/** UPI payment, as the resident (or parent) sees it. Success marks the invoice paid everywhere. */
export function PayFlow({ base }: { base: "/resident" | "/parent" }) {
  const t = useTranslations("mobile.pay");
  const f = useFormat();
  const router = useRouter();
  const params = useSearchParams();
  const invoices = useDemo((s) => s.invoices);
  const residents = useDemo((s) => s.residents);
  const payInvoice = useDemo((s) => s.payInvoice);
  const today = todayISO();
  // lock the invoice on first render so it stays on screen after it flips to paid
  const [invId] = useState(() => {
    const id = params.get("invoice");
    const all = useDemo.getState().invoices;
    return (all.find((i) => i.id === id) ?? all.filter((i) => i.residentId === demo.residentId && i.status === "unpaid").sort((a, b) => a.dueOn.localeCompare(b.dueOn))[0])?.id;
  });
  const inv = useMemo(() => invoices.find((i) => i.id === invId), [invoices, invId]);
  const [app, setApp] = useState(APPS[0].id);
  const returnedFromGateway = params.get("paid") === "1" || params.get("razorpay_payment_link_status") === "paid";
  const [phase, setPhase] = useState<Phase>(inv?.status === "paid" ? "done" : returnedFromGateway ? "confirming" : "choose");
  const [slow, setSlow] = useState(false);
  const [pin, setPin] = useState(0);
  const r = residents.find((x) => x.id === inv?.residentId);
  // Razorpay hostels pay through Razorpay; sample hostels run the test payment; others pay the hostel's UPI ID
  const org = useSession((s) => s.org);
  const sample = org?.settings.clock?.mode === "demo";
  const gateway = razorpayConnected(org);

  // back from Razorpay: wait for its confirmation (it reaches the app within a few seconds)
  useEffect(() => {
    if (phase === "confirming" && inv?.status === "paid") {
      haptic("success");
      setPhase("done");
    }
  }, [phase, inv?.status]);
  useEffect(() => {
    if (phase !== "confirming") return;
    const id = setTimeout(() => setSlow(true), 45000);
    return () => clearTimeout(id);
  }, [phase]);

  async function payWithGateway() {
    if (!org || !inv) return;
    setPhase("redirecting");
    try {
      const { url } = await createPayLink(org.id, inv.id, { via: "app", base });
      window.location.href = url;
    } catch (e) {
      setPhase("choose");
      toast.error(t("gatewayError"), { description: e instanceof Error ? e.message : String(e) });
    }
  }

  useEffect(() => {
    if (phase !== "pin") return;
    setPin(0);
    const timers = [1, 2, 3, 4, 5, 6].map((n) => setTimeout(() => { setPin(n); haptic(); }, 260 * n + 400));
    timers.push(setTimeout(() => setPhase("processing"), 260 * 6 + 800));
    return () => timers.forEach(clearTimeout);
  }, [phase]);
  useEffect(() => {
    if (phase !== "processing" || !inv) return;
    const tm = setTimeout(() => {
      payInvoice(inv.id, { method: "upi", via: "app" });
      haptic("success");
      setPhase("done");
    }, 1600);
    return () => clearTimeout(tm);
  }, [phase, inv, payInvoice]);

  if (!inv || !r) {
    return (
      <>
        <AppHeader title={t("nothingDue")} left={<BackButton href={`${base}/`} label={t("back")} />} />
        <MCard><p className="text-sm text-fg-2">{t("allPaid")}</p></MCard>
      </>
    );
  }
  const st = invoiceState(inv, today);
  const appName = APPS.find((a) => a.id === app)!.name;

  return (
    <div className="relative min-h-full">
      <AnimatePresence mode="wait" initial={false}>
        {phase === "choose" && (
          <motion.div key="choose" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <AppHeader title={t("title")} subtitle={base === "/parent" ? t("subtitleFor", { month: f.month(inv.month), name: r.name.split(" ")[0] }) : t("subtitle", { month: f.month(inv.month) })} left={<BackButton href={`${base}/`} label={t("back")} />} />
            <MCard>
              <p className="text-small text-fg-2">{st.state === "overdue" ? t("overdue", { days: st.days }) : t("dueOn", { date: f.date(inv.dueOn) })}</p>
              <p className="mt-1 text-hero font-semibold tracking-[-0.025em] text-fg tnum">{f.inr(inv.total)}</p>
              <dl className="mt-3 divide-y divide-line border-t border-line text-sm">
                {inv.lines.map((l) => <div key={l.label} className="flex justify-between py-2"><dt className="text-fg-2">{l.label}</dt><dd className={cn("tnum", l.amount < 0 ? "text-success-fg" : "text-fg")}>{f.inr(l.amount)}</dd></div>)}
              </dl>
              <p className="mt-2 font-mono text-xs text-fg-3">{inv.id} · {hostel.upiId}</p>
            </MCard>
            {gateway ? (
              <div className="mx-4 mt-6">
                <Button variant="primary" size="xl" className="h-[52px] w-full rounded-xl text-[17px]" onClick={payWithGateway} data-tour="pay-confirm">{t("pay", { amount: f.inr(inv.total) })}</Button>
                <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-fg-3"><ShieldCheck className="size-3.5" aria-hidden />{t("gatewayNote")}</p>
              </div>
            ) : !sample ? (
              <MCard className="mt-4 flex flex-col items-center text-center">
                <p className="text-base font-semibold text-fg">{t("realTitle")}</p>
                <p className="mt-1 text-sm text-fg-2">{t("realBody")}</p>
                <div className="mt-4 rounded-xl bg-white p-3"><QRCodeSVG value={upiUri(inv.total, inv.id)} size={176} level="M" /></div>
                <p className="mt-3 font-mono text-sm text-fg">{hostel.upiId}</p>
                <Button asChild variant="primary" size="xl" className="mt-4 h-[52px] w-full rounded-xl text-[17px]">
                  <a href={upiUri(inv.total, inv.id)}>{t("openApp", { amount: f.inr(inv.total) })}</a>
                </Button>
                <p className="mt-3 text-xs text-fg-3">{t("realNote")}</p>
              </MCard>
            ) : (
            <>
            <p className="mx-4 mt-6 mb-2 text-sm font-semibold text-fg">{t("payWith")}</p>
            <div role="radiogroup" aria-label={t("payWith")} className="mx-4 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
              {APPS.map((a) => (
                <button key={a.id} role="radio" aria-checked={app === a.id} onClick={() => { setApp(a.id); haptic(); }} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-surface-2">
                  <span className={cn("grid size-9 place-items-center rounded-full text-sm font-bold", a.tint)} aria-hidden>{a.mark}</span>
                  <span className="flex-1 text-base text-fg">{a.name}</span>
                  <span className={cn("grid size-5 place-items-center rounded-full border-2", app === a.id ? "border-brand bg-brand" : "border-line-input")}>{app === a.id && <Check className="size-3 text-white" strokeWidth={3} aria-hidden />}</span>
                </button>
              ))}
            </div>
            <p className="mx-4 mt-3 flex items-center gap-1.5 text-xs text-fg-3"><ShieldCheck className="size-3.5" aria-hidden />{t("secure")}</p>
            <div className="mx-4 mt-6">
              <Button variant="primary" size="xl" className="w-full" onClick={() => { haptic(); setPhase("pin"); }} data-tour="pay-confirm">{t("pay", { amount: f.inr(inv.total) })}</Button>
            </div>
            </>
            )}
          </motion.div>
        )}

        {(phase === "pin" || phase === "processing") && (
          <motion.div key="pin" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex min-h-[600px] flex-col items-center px-6 pt-16 text-center">
            <span className="grid size-14 place-items-center rounded-full bg-[#e8f0fe] text-xl font-bold text-[#1a73e8]" aria-hidden>{APPS.find((a) => a.id === app)!.mark}</span>
            <p className="mt-4 text-small text-fg-2">{t("paying", { app: appName })}</p>
            <p className="mt-1 text-base font-semibold text-fg">{hostel.name}</p>
            <p className="text-xs text-fg-3">{hostel.upiId}</p>
            <p className="mt-6 text-hero font-semibold tracking-[-0.025em] text-fg tnum">{f.inr(inv.total)}</p>
            {phase === "pin" ? (
              <>
                <p className="mt-10 flex items-center gap-1.5 text-sm text-fg-2"><Lock className="size-4" aria-hidden />{t("pin")}</p>
                <div className="mt-4 flex gap-3" aria-label={t("pinProgress", { n: pin })} role="img">
                  {Array.from({ length: 6 }).map((_, i) => <span key={i} className={cn("size-3.5 rounded-full border-2 transition-colors duration-150", i < pin ? "border-fg bg-fg" : "border-line-input")} />)}
                </div>
              </>
            ) : (
              <div className="mt-10 flex flex-col items-center gap-3" aria-live="polite">
                <span className="size-8 animate-spin rounded-full border-[3px] border-brand/25 border-t-brand" aria-hidden />
                <p className="text-sm text-fg-2">{t("processing")}</p>
              </div>
            )}
          </motion.div>
        )}

        {(phase === "redirecting" || phase === "confirming") && (
          <motion.div key="wait" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex min-h-[560px] flex-col items-center px-6 pt-24 text-center" aria-live="polite">
            <span className="size-10 animate-spin rounded-full border-[3px] border-brand/25 border-t-brand" aria-hidden />
            <p className="mt-6 text-lg font-semibold text-fg">{phase === "redirecting" ? t("opening") : t("confirming")}</p>
            <p className="mt-1 max-w-xs text-sm text-fg-2">{phase === "redirecting" ? t("openingBody") : slow ? t("slow") : t("confirmingBody")}</p>
            {phase === "confirming" && slow && <Button variant="secondary" className="mt-6" onClick={() => router.push(`${base}/`)}>{t("back")}</Button>}
          </motion.div>
        )}

        {phase === "done" && (
          <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex min-h-[620px] flex-col items-center px-6 pt-14 text-center" data-tour="pay-success">
            <motion.svg viewBox="0 0 80 80" className="size-20" initial="h" animate="s" aria-hidden>
              <motion.circle cx="40" cy="40" r="38" fill="var(--success)" variants={{ h: { scale: 0.5, opacity: 0 }, s: { scale: 1, opacity: 1 } }} transition={{ type: "spring", stiffness: 300, damping: 20 }} />
              <motion.path d="M24 41 l11 11 l22 -24" fill="none" stroke="white" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" variants={{ h: { pathLength: 0 }, s: { pathLength: 1 } }} transition={{ duration: 0.4, delay: 0.25 }} />
            </motion.svg>
            <p className="mt-6 text-[28px] leading-[34px] font-semibold tracking-[-0.02em] text-fg">{t("paid", { amount: f.inr(inv.total) })}</p>
            <p className="mt-1 text-sm text-fg-2">{t("paidTo", { name: hostel.name })}</p>
            <dl className="mt-6 w-full divide-y divide-line rounded-xl border border-line bg-surface text-left text-sm">
              <div className="flex justify-between px-4 py-2.5"><dt className="text-fg-2">{t("invoice")}</dt><dd className="font-mono text-fg">{inv.id}</dd></div>
              <div className="flex justify-between px-4 py-2.5"><dt className="text-fg-2">{t("utr")}</dt><dd className="font-mono text-fg">{(invoices.find((i) => i.id === inv.id)?.utr) ?? "—"}</dd></div>
              <div className="flex justify-between px-4 py-2.5"><dt className="text-fg-2">{t("when")}</dt><dd className="text-fg tnum">{inv.paidOn ? `${f.day(inv.paidOn)}, ${f.time(inv.paidOn)}` : t("justNow")}</dd></div>
            </dl>
            <p className="mt-4 flex items-center gap-1.5 text-small text-success-fg"><MessageCircle className="size-4" aria-hidden />{t("receiptSent")}</p>
            <p className="mt-1 flex items-center gap-1.5 text-small text-fg-2"><CheckCircle2 className="size-4 text-brand-text" aria-hidden />{t("autoMarked")}</p>
            <div className="mt-8 grid w-full gap-2">
              <Button variant="primary" size="xl" className="w-full" onClick={() => router.push(`${base}/`)}>{t("done")}</Button>
              <Button variant="quiet" size="xl" className="w-full" onClick={() => window.print()}><FileText /> {t("download")}</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
