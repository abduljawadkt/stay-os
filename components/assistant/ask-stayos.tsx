"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, createTranslator } from "next-intl";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { ArrowUp, Loader2, Mic, MicOff, X, Database } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/common/avatar";
import { useDemo } from "@/lib/store";
import { hostel } from "@/data";
import { brand } from "@/config/brand";
import { useUI } from "@/components/shell/ui-store";
import { useLocale } from "@/lib/i18n";
import { nowISO } from "@/lib/clock";
import { inr, inrCompact, pct, fmtMonth, fmtTime, fmtDay } from "@/lib/format";
import { SUGGESTIONS, answer, detectIntent, isMalayalam, type Answer, type Intent } from "@/lib/ai";
import { useAsk } from "./ask-store";
import { useOwnerView } from "@/components/common/owner-only";
import enMessages from "@/messages/en";
import mlMessages from "@/messages/ml";
import { cn } from "@/lib/utils";

type Turn = { id: number; q: string; lang: "en" | "ml"; intent: Intent | null; a: Answer | null; phase: "thinking" | "done"; blocked?: boolean };
/** Answers about the hostel's money, for the owner only. */
const MONEY: Intent[] = ["profit", "electricity"];
let turnId = 0;

type Tr = (key: string, values?: Record<string, string | number>) => string;
// Answers follow the language of the question, independent of the UI language.
const translators: Record<"en" | "ml", Tr> = {
  en: createTranslator({ locale: "en", messages: enMessages as never, namespace: "ai" as never }) as unknown as Tr,
  ml: createTranslator({ locale: "ml", messages: { ...enMessages, ai: { ...enMessages.ai, ...mlMessages.ai } } as never, namespace: "ai" as never }) as unknown as Tr,
};
const meals = { en: enMessages.meals as Record<string, string>, ml: { ...enMessages.meals, ...(mlMessages as { meals: Record<string, string> }).meals } };

export function AskStayOS() {
  const t = useTranslations("ai");
  const { locale } = useLocale();
  const open = useDemo((s) => s.aiOpen);
  const setOpen = useDemo((s) => s.setAiOpen);
  const role = useDemo((s) => s.role);
  const ownerView = useOwnerView();
  const ownerViewRef = useRef(ownerView);
  ownerViewRef.current = ownerView;
  const pending = useAsk((s) => s.pending);
  const clearPending = useAsk((s) => s.clear);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [q, setQ] = useState("");
  const [listening, setListening] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setOpen(!useDemo.getState().aiOpen);
      }
      if (e.key === "Escape" && useDemo.getState().aiOpen) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  const ask = (question: string) => {
    const text = question.trim();
    if (!text) return;
    const lang: "en" | "ml" = isMalayalam(text) ? "ml" : locale;
    const intent = detectIntent(text);
    const blocked = !!intent && MONEY.includes(intent) && !ownerViewRef.current;
    const id = ++turnId;
    setTurns((ts) => [...ts, { id, q: text, lang, intent, a: null, phase: "thinking", blocked }]);
    setQ("");
    setTimeout(() => {
      const a = intent && !blocked ? answer(intent, text, useDemo.getState(), nowISO()) : null;
      setTurns((ts) => ts.map((x) => (x.id === id ? { ...x, a, phase: "done" } : x)));
    }, 750);
  };

  // the guided tour (or anything else) can ask a question by typing it in
  useEffect(() => {
    if (!pending) return;
    setOpen(true);
    let i = 0;
    setQ("");
    const iv = setInterval(() => {
      i += 2;
      setQ(pending.slice(0, i));
      if (i >= pending.length) {
        clearInterval(iv);
        const text = pending;
        setTimeout(() => { ask(text); clearPending(); }, 350);
      }
    }, 45);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  const startVoice = () => {
    type SR = { lang: string; interimResults: boolean; onresult: (e: { results: { 0: { transcript: string }; isFinal: boolean }[] & { length: number } }) => void; onend: () => void; onerror: () => void; start: () => void; stop: () => void };
    const W = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
    const Ctor = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    const sample = SUGGESTIONS[0].q;
    setListening(true);
    if (!Ctor) {
      // no speech API (e.g. some WebViews): show the experience with a spoken Malayalam sample
      setTimeout(() => { setListening(false); useAsk.getState().ask(sample); }, 1600);
      return;
    }
    try {
      const rec = new Ctor();
      rec.lang = locale === "ml" ? "ml-IN" : "en-IN";
      rec.interimResults = true;
      let finalText = "";
      rec.onresult = (e) => {
        const r = e.results[e.results.length - 1];
        setQ(r[0].transcript);
        if (r.isFinal) finalText = r[0].transcript;
      };
      rec.onerror = () => { setListening(false); useAsk.getState().ask(sample); };
      rec.onend = () => { setListening(false); if (finalText) ask(finalText); };
      rec.start();
    } catch {
      setListening(false);
      useAsk.getState().ask(sample);
    }
  };

  if (role !== "owner" && role !== "warden") return null;

  return (
    <>
      <AnimatePresence>
        {!open && (
          <motion.button
            key="pill"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            onClick={() => setOpen(true)}
            data-tour="ask-pill"
            className="fixed right-5 bottom-5 z-30 hidden h-11 items-center lg:flex gap-2 rounded-full border border-line bg-surface pr-3 pl-2 text-sm font-medium text-fg shadow-lg transition-colors hover:bg-surface-2"
            aria-label={t("open")}
          >
            <LogoMark size={26} />
            <span className="hidden sm:inline">{t("launcher")}</span>
            <kbd className="hidden rounded-xs border border-line bg-surface-2 px-1.5 font-mono text-[11px] text-fg-3 sm:inline">⌘J</kbd>
          </motion.button>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {open && (
          <motion.section
            key="panel"
            role="dialog"
            aria-label={t("title")}
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.24, ease: [0.2, 0, 0, 1] }}
            className="fixed inset-0 z-50 flex flex-col bg-surface pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] sm:inset-auto sm:pt-0 sm:pb-0 sm:right-5 sm:bottom-5 sm:h-[min(660px,calc(100dvh-40px))] sm:w-[440px] sm:rounded-xl sm:border sm:border-line sm:shadow-lg"
            data-tour="ask-panel"
          >
            <header className="flex items-center gap-3 border-b border-line px-4 py-3">
              <LogoMark size={28} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-fg">{t("title")}</p>
                <p className="text-xs text-fg-3">{t("subtitle")}</p>
              </div>
              <Button variant="quiet" size="icon-sm" onClick={() => setOpen(false)} aria-label={t("close")}><X /></Button>
            </header>
            <div ref={scroller} className="scrollbar-thin flex-1 space-y-5 overflow-y-auto px-4 py-4" aria-live="polite">
              {turns.length === 0 && (
                <div>
                  <p className="text-base font-semibold text-fg">{t("hello", { hostel: hostel.name || brand.name })}</p>
                  <p className="mt-1 text-sm text-fg-2">{t("intro")}</p>
                  <div className="mt-4 flex flex-col gap-2">
                    {SUGGESTIONS.slice(0, 6).map((s) => (
                      <button key={s.q} onClick={() => ask(s.q)} lang={s.lang} className="rounded-lg border border-line px-3 py-2 text-left text-sm text-fg transition-colors hover:border-line-strong hover:bg-surface-2">{s.q}</button>
                    ))}
                  </div>
                </div>
              )}
              {turns.map((turn) => <TurnView key={turn.id} turn={turn} onAsk={ask} />)}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); ask(q); }} className="border-t border-line p-3">
              {listening && (
                <div className="mb-2 flex items-center gap-2 rounded-md bg-brand-tint px-3 py-2 text-small text-brand-tint-fg" aria-live="assertive">
                  <span className="flex h-4 items-end gap-0.5" aria-hidden>{[0, 1, 2].map((i) => <motion.span key={i} className="w-1 rounded-full bg-brand" animate={{ height: [4, 14, 6, 12, 4] }} transition={{ repeat: Infinity, duration: 0.9, delay: i * 0.15 }} />)}</span>
                  {t("listening")}
                </div>
              )}
              <div className="flex items-center gap-2">
                <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("placeholder")} aria-label={t("placeholder")} className="h-10 min-w-0 flex-1 rounded-md border border-line-input bg-surface px-3 text-base text-fg md:text-sm placeholder:text-fg-3 focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/20 focus-visible:outline-none" data-tour="ask-input" />
                <Button type="button" variant="secondary" size="icon-lg" onClick={startVoice} aria-label={listening ? t("stopVoice") : t("voice")} aria-pressed={listening}>{listening ? <MicOff /> : <Mic />}</Button>
                <Button type="submit" variant="primary" size="icon-lg" disabled={!q.trim()} aria-label={t("send")}><ArrowUp /></Button>
              </div>
            </form>
          </motion.section>
        )}
      </AnimatePresence>
    </>
  );
}

function TurnView({ turn, onAsk }: { turn: Turn; onAsk: (q: string) => void }) {
  const tl = translators[turn.lang];
  const ui = useTranslations("ai");
  return (
    <div className="space-y-2">
      <div className="flex justify-end"><p lang={turn.lang} className="max-w-[85%] rounded-lg rounded-br-sm bg-surface-2 px-3 py-2 text-sm text-fg">{turn.q}</p></div>
      {turn.phase === "thinking" ? (
        <p className="flex items-center gap-2 text-small text-fg-2"><Loader2 className="size-4 animate-spin text-brand" aria-hidden />{tl(`thinking.${turn.intent ?? "none"}`)}</p>
      ) : (
        <motion.div initial="h" animate="s" variants={{ s: { transition: { staggerChildren: 0.05 } } }} lang={turn.lang} className="rounded-lg border border-line bg-surface p-3.5" data-tour="ask-answer">
          {turn.a ? <AnswerBody a={turn.a} lang={turn.lang} /> : (
            <>
              <Line>{turn.blocked ? tl("ownerOnly") : tl("fallback")}</Line>
              <div className="mt-3 flex flex-wrap gap-1.5">{SUGGESTIONS.slice(3, 9).map((s) => <button key={s.q} onClick={() => onAsk(s.q)} className="rounded-full border border-line px-2.5 py-1 text-xs text-fg-2 hover:bg-surface-2">{s.q}</button>)}</div>
            </>
          )}
          {turn.a && <p className="mt-3 flex items-center gap-1.5 border-t border-line pt-2 text-xs text-fg-3"><Database className="size-3" aria-hidden />{tl("sourceLine", { source: tl(`source.${turn.a.intent}`) })}</p>}
        </motion.div>
      )}
    </div>
  );
}

function Line({ children, className }: { children: React.ReactNode; className?: string }) {
  return <motion.p variants={{ h: { opacity: 0, y: 4 }, s: { opacity: 1, y: 0 } }} className={cn("text-sm leading-relaxed text-fg", className)}>{children}</motion.p>;
}
function Block({ children }: { children: React.ReactNode }) {
  return <motion.div variants={{ h: { opacity: 0, y: 8 }, s: { opacity: 1, y: 0 } }} className="mt-3">{children}</motion.div>;
}
function Rows({ rows }: { rows: { left: React.ReactNode; mid?: React.ReactNode; right: React.ReactNode }[] }) {
  return (
    <ul className="divide-y divide-line rounded-md border border-line text-small">
      {rows.map((r, i) => <li key={i} className="flex items-center gap-2 px-2.5 py-1.5"><span className="min-w-0 flex-1 truncate text-fg">{r.left}</span>{r.mid && <span className="font-mono text-xs text-fg-3">{r.mid}</span>}<span className="text-right text-fg tnum">{r.right}</span></li>)}
    </ul>
  );
}
function Bars({ items }: { items: { label: string; value: number; color: string }[] }) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="space-y-1.5">
      {items.map((i) => (
        <div key={i.label} className="flex items-center gap-2 text-xs">
          <span className="w-20 shrink-0 text-fg-2">{i.label}</span>
          <div className="h-2 flex-1 rounded-full bg-surface-2"><div className="h-full rounded-full" style={{ width: `${(i.value / max) * 100}%`, background: i.color }} /></div>
          <span className="w-16 text-right text-fg tnum">{inrCompact(i.value)}</span>
        </div>
      ))}
    </div>
  );
}

function AnswerBody({ a, lang }: { a: Answer; lang: "en" | "ml" }) {
  const tl = translators[lang];
  const router = useRouter();
  const sendReminders = useDemo((s) => s.sendReminders);
  const openWhatsApp = useDemo((s) => s.openWhatsApp);
  const setAiOpen = useDemo((s) => s.setAiOpen);
  const openCheckIn = useUI((s) => s.openCheckIn);
  const [done, setDone] = useState(false);
  const go = (href: string) => { setAiOpen(false); router.push(href); };
  const actions = useMemo(() => ({ go }), []); // eslint-disable-line react-hooks/exhaustive-deps
  const Actions = ({ children }: { children: React.ReactNode }) => <Block><div className="flex flex-wrap gap-2">{children}</div></Block>;
  switch (a.intent) {
    case "dues":
      return (
        <>
          <Line>{tl("dues.head", { count: a.count, total: inr(a.total) })}</Line>
          <Block><Rows rows={a.rows.slice(0, 6).map((r) => ({ left: <span className="inline-flex items-center gap-2"><Avatar name={r.name} size={20} />{r.name}</span>, mid: r.bed, right: <>{inr(r.amount)} <span className="text-xs text-danger-fg">{r.days > 0 ? tl("dues.days", { days: r.days }) : ""}</span></> }))} /></Block>
          {a.rows.length > 6 && <Line className="mt-1.5 text-xs text-fg-3">{tl("more", { count: a.rows.length - 6 })}</Line>}
          <Actions>
            <Button variant="primary" size="sm" disabled={done} onClick={() => { sendReminders(a.invoiceIds); setDone(true); openWhatsApp(null); }} data-tour="ask-action">{done ? tl("dues.sent") : tl("dues.action", { count: a.remindCount })}</Button>
            <Button variant="quiet" size="sm" onClick={() => actions.go("/dashboard/rent/?filter=overdue")}>{tl("dues.open")}</Button>
          </Actions>
        </>
      );
    case "vacant":
      return (
        <>
          <Line>{a.rows.length ? tl("vacant.head", { count: a.rows.length, block: a.block, floor: a.floor ?? 0, hasFloor: a.floor ? "yes" : "no" }) : tl("vacant.none", { block: a.block, floor: a.floor ?? 0, hasFloor: a.floor ? "yes" : "no" })}</Line>
          {a.rows.length > 0 && <Block><Rows rows={a.rows.slice(0, 8).map((r) => ({ left: <span className="font-mono">{r.bed}</span>, mid: tl(`roomType.${r.type}`), right: tl("perMonth", { amount: inr(r.rent) }) }))} /></Block>}
          <Actions>
            <Button variant="primary" size="sm" onClick={() => actions.go(`/dashboard/rooms/?block=${a.block}&floor=${a.floor ?? 1}`)}>{tl("vacant.action")}</Button>
            {a.rows[0] && <Button variant="quiet" size="sm" onClick={() => { setAiOpen(false); openCheckIn(a.rows[0].bed); }}>{tl("vacant.checkin", { bed: a.rows[0].bed })}</Button>}
          </Actions>
        </>
      );
    case "profit": {
      const up = a.net >= a.prevNet;
      return (
        <>
          <Line>{tl("profit.head", { month: fmtMonth(a.month, lang), net: inr(a.net), revenue: inr(a.revenue), margin: pct(a.margin, 0) })}</Line>
          <Line className="mt-1 text-small text-fg-2">{tl(up ? "profit.up" : "profit.down", { delta: inr(Math.abs(a.net - a.prevNet)) })}</Line>
          <Block><Bars items={[{ label: tl("profit.revenue"), value: a.revenue, color: "var(--brand)" }, { label: tl("profit.expenses"), value: a.expenses, color: "var(--line-strong)" }]} /></Block>
          <Actions><Button variant="primary" size="sm" onClick={() => actions.go("/dashboard/reports/")}>{tl("profit.action")}</Button></Actions>
        </>
      );
    }
    case "waste":
      return (
        <>
          <Line>{tl("waste.head", { meals: a.meals, amount: inr(a.amount), year: inrCompact(a.year) })}</Line>
          <Line className="mt-1 text-small text-fg-2">{tl("waste.rebates", { count: a.rebateCount, amount: inr(a.rebateTotal) })}</Line>
          <Actions><Button variant="primary" size="sm" onClick={() => actions.go("/dashboard/mess/")}>{tl("waste.action")}</Button></Actions>
        </>
      );
    case "late":
      return (
        <>
          <Line>{a.rows.length ? tl("late.head", { count: a.rows.length }) : tl("late.none")}</Line>
          {a.rows.length > 0 && <Block><Rows rows={a.rows.map((r) => ({ left: r.name, mid: r.bed, right: <>{fmtTime(r.time, lang)} <span className="text-xs text-danger-fg">+{r.mins}m</span></> }))} /></Block>}
          <Actions>
            {a.rows.length > 0 && <Button variant="primary" size="sm" disabled={done} onClick={() => { setDone(true); toast(tl("late.sent", { count: a.rows.length })); }}>{done ? tl("late.sentShort") : tl("late.action")}</Button>}
            <Button variant="quiet" size="sm" onClick={() => actions.go("/dashboard/gate/?tab=late")}>{tl("late.open")}</Button>
          </Actions>
        </>
      );
    case "complaints":
      return (
        <>
          <Line>{tl("complaints.head", { open: a.open, breached: a.breached.length })}</Line>
          {a.breached.length > 0 && <Block><Rows rows={a.breached.map((c) => ({ left: c.title, mid: c.room, right: <span className="text-xs text-danger-fg">{tl("complaints.over", { h: Math.floor(c.over / 3600000), m: Math.round((c.over % 3600000) / 60000) })}</span> }))} /></Block>}
          {a.risk > 0 && <Line className="mt-1.5 text-small text-fg-2">{tl("complaints.risk", { count: a.risk })}</Line>}
          <Actions><Button variant="primary" size="sm" onClick={() => actions.go("/dashboard/complaints/")}>{tl("complaints.action")}</Button></Actions>
        </>
      );
    case "electricity": {
      const up = a.change >= 0;
      return (
        <>
          <Line>{tl(up ? "electricity.up" : "electricity.down", { month: fmtMonth(a.month, lang), cur: inr(a.cur), pct: pct(Math.abs(a.change)), prev: fmtMonth(a.prev, lang), last: inr(a.last) })}</Line>
          <Block><Bars items={[{ label: fmtMonth(a.prev, lang).split(" ")[0], value: a.last, color: "var(--line-strong)" }, { label: fmtMonth(a.month, lang).split(" ")[0], value: a.cur, color: "var(--chart-2)" }]} /></Block>
          <Line className="mt-2 text-small text-fg-2">{tl("electricity.why")}</Line>
          <Actions><Button variant="primary" size="sm" onClick={() => actions.go("/dashboard/expenses/")}>{tl("electricity.action")}</Button></Actions>
        </>
      );
    }
    case "headcount":
      return (
        <>
          <Line>{tl("headcount.head", { count: a.cooking, meal: meals[lang][a.meal].toLowerCase(), skipped: a.skipped, enrolled: a.enrolled })}</Line>
          <Block><Rows rows={a.all.map((x) => ({ left: meals[lang][x.meal], right: x.cooking }))} /></Block>
          <Actions><Button variant="primary" size="sm" disabled={done} onClick={() => { setDone(true); toast(tl("headcount.sent")); }}>{done ? tl("headcount.sentShort") : tl("headcount.action")}</Button></Actions>
        </>
      );
    case "police":
      return (
        <>
          <Line>{a.rows.length ? tl("police.head", { count: a.rows.length }) : tl("police.none")}</Line>
          {a.rows.length > 0 && <Block><Rows rows={a.rows.map((r) => ({ left: r.name, mid: r.bed, right: <span className="text-xs text-fg-3">{tl("police.since", { date: fmtDay(r.since, lang) })}</span> }))} /></Block>}
          <Actions><Button variant="primary" size="sm" onClick={() => actions.go("/dashboard/residents/?filter=police")}>{tl("police.action")}</Button></Actions>
        </>
      );
    case "occupancy":
      return (
        <>
          <Line>{tl("occupancy.head", { rate: pct(a.rate), occupied: a.occupied, leaving: a.leaving, arriving: a.arriving, projected: pct(a.projected) })}</Line>
          <Actions><Button variant="primary" size="sm" onClick={() => actions.go("/dashboard/rooms/")}>{tl("occupancy.action")}</Button></Actions>
        </>
      );
    case "leave":
      return (
        <>
          <Line>{tl("leave.head", { count: a.rows.length, awaiting: a.awaiting })}</Line>
          {a.rows.length > 0 && <Block><Rows rows={a.rows.slice(0, 8).map((r) => ({ left: r.name, mid: r.bed, right: <span className="text-xs text-fg-3">{r.destination}</span> }))} /></Block>}
          <Actions><Button variant="primary" size="sm" onClick={() => actions.go("/dashboard/gate/?tab=leaves")}>{tl("leave.action")}</Button></Actions>
        </>
      );
  }
}
