"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, BadgeCheck, Loader2, MoreVertical, Search, SendHorizontal, Smile, X, Paperclip, CheckCheck } from "lucide-react";
import { useDemo } from "@/lib/store";
import { useFormat } from "@/lib/hooks";
import { toast } from "sonner";
import { payLink } from "@/lib/upi";
import { renderTemplate } from "@/lib/wa-templates";
import { fmtTime, initials } from "@/lib/format";
import { todayISO } from "@/lib/clock";
import { hostel, type WAThread } from "@/data";
import { Bubble } from "./bubble";
import { cn } from "@/lib/utils";

type Filter = "all" | "unread" | "parents";

/** A WhatsApp Business inbox for the hostel's number. You can also act as the resident or parent. */
export function WhatsAppPanel() {
  const t = useTranslations("whatsapp");
  const open = useDemo((s) => s.waOpen);
  const threadId = useDemo((s) => s.waThreadId);
  const close = useDemo((s) => s.closeWhatsApp);
  const openThread = useDemo((s) => s.openWhatsApp);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);
  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          key="wa"
          role="complementary"
          aria-label={t("panel")}
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ duration: 0.32, ease: [0.2, 0, 0, 1] }}
          className="wa-scope fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-[var(--wa-divider)] bg-[var(--wa-in)] text-[var(--wa-text)] shadow-lg sm:w-[396px]"
          data-tour="wa-panel"
        >
          {threadId ? <Conversation id={threadId} onBack={() => useDemo.setState({ waThreadId: null })} onClose={close} /> : <ChatList onOpen={(id) => openThread(id)} onClose={close} />}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function preview(th: WAThread, lang: "en" | "ml") {
  const m = th.messages[th.messages.length - 1];
  if (!m) return "";
  if (m.kind === "image") return "📷 Photo";
  const text = m.kind === "template" && m.template ? (renderTemplate(m.template, m.data ?? {}, lang).header ?? renderTemplate(m.template, m.data ?? {}, lang).body) : m.text ?? "";
  return text.split("\n")[0];
}

function WAAvatar({ name, size = 44 }: { name: string; size?: number }) {
  return (
    <span aria-hidden className="grid shrink-0 place-items-center rounded-full bg-[#dfe5e7] font-medium text-[#54656f] dark:bg-[#6a7175] dark:text-[#d1d7db]" style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {initials(name)}
    </span>
  );
}

function ChatList({ onOpen, onClose }: { onOpen: (id: string) => void; onClose: () => void }) {
  const t = useTranslations("whatsapp");
  const f = useFormat();
  const threads = useDemo((s) => s.whatsapp);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const today = todayISO();
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return [...threads]
      .filter((th) => filter === "all" || (filter === "unread" ? th.unread > 0 : th.role === "parent"))
      .filter((th) => !s || th.contactName.toLowerCase().includes(s))
      .sort((a, b) => (b.messages[b.messages.length - 1]?.at ?? "").localeCompare(a.messages[a.messages.length - 1]?.at ?? ""));
  }, [threads, q, filter]);
  return (
    <>
      <header className="bg-[var(--wa-header)] px-4 pt-4 pb-3">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-[17px] font-semibold">{hostel.name}<BadgeCheck className="size-4 fill-[var(--wa-green)] text-[var(--wa-header)]" aria-label={t("verified")} /></p>
            <p className="text-[12.5px] text-[var(--wa-meta)]">{t("business", { number: hostel.whatsapp })}</p>
          </div>
          <button onClick={onClose} className="grid size-9 place-items-center rounded-full hover:bg-black/5 dark:hover:bg-white/10" aria-label={t("close")}><X className="size-5" /></button>
        </div>
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--wa-meta)]" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")} aria-label={t("search")} className="h-9 w-full rounded-lg bg-[var(--wa-in)] pr-3 pl-9 text-base text-[var(--wa-text)] md:text-[14px] outline-none placeholder:text-[var(--wa-meta)] focus-visible:ring-2 focus-visible:ring-[var(--wa-green)]" />
        </div>
        <div className="mt-3 flex gap-2" role="tablist" aria-label={t("filter")}>
          {(["all", "unread", "parents"] as Filter[]).map((k) => (
            <button key={k} role="tab" aria-selected={filter === k} onClick={() => setFilter(k)} className={cn("h-8 rounded-full px-3 text-[13px] font-medium transition-colors", filter === k ? "bg-[#d9fdd3] text-[#008069] dark:bg-[#0a332c] dark:text-[#00a884]" : "bg-[var(--wa-in)] text-[var(--wa-meta)]")}>{t(`filters.${k}`)}</button>
          ))}
        </div>
      </header>
      <ul className="flex-1 overflow-y-auto" aria-label={t("chats")}>
        {list.length === 0 && <li className="p-8 text-center text-[14px] text-[var(--wa-meta)]">{t("noChats")}</li>}
        {list.map((th) => {
          const last = th.messages[th.messages.length - 1];
          const lang = th.role === "parent" ? "ml" : "en";
          return (
            <li key={th.id}>
              <button onClick={() => onOpen(th.id)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-[var(--wa-header)]" data-thread={th.id}>
                <WAAvatar name={th.contactName} />
                <div className="min-w-0 flex-1 border-b border-[var(--wa-divider)] pb-2.5">
                  <div className="flex items-baseline gap-2">
                    <span className="flex-1 truncate text-[16px]">{th.contactName}{th.role === "parent" && <span className="ml-1.5 rounded bg-[var(--wa-header)] px-1 text-[11px] text-[var(--wa-meta)]">{t("parent")}</span>}</span>
                    <span className={cn("shrink-0 text-[12px]", th.unread ? "text-[var(--wa-green)]" : "text-[var(--wa-meta)]")}>{last ? (last.at.startsWith(today) ? fmtTime(last.at, "en").toLowerCase() : f.day(last.at)) : ""}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    {last?.from === "hostel" && <CheckCheck className={cn("size-4 shrink-0", last.status === "read" ? "text-[var(--wa-tick)]" : "text-[var(--wa-meta)]")} aria-hidden />}
                    <span className="flex-1 truncate text-[14px] text-[var(--wa-meta)]">{preview(th, lang)}</span>
                    {th.unread > 0 && <span className="grid min-w-5 place-items-center rounded-full bg-[var(--wa-green)] px-1.5 text-[12px] leading-5 font-semibold text-white">{th.unread}</span>}
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="border-t border-[var(--wa-divider)] px-4 py-2.5 text-center text-[12px] text-[var(--wa-meta)]">{t("footer")}</p>
    </>
  );
}

const QUICK: Record<"resident" | "parent", string[]> = {
  resident: ["quick.fan", "quick.skip", "quick.link", "quick.paid"],
  parent: ["quick.approve", "quick.reject", "quick.thanks"],
};

function Conversation({ id, onBack, onClose }: { id: string; onBack: () => void; onClose: () => void }) {
  const t = useTranslations("whatsapp");
  const f = useFormat();
  const thread = useDemo((s) => s.whatsapp.find((w) => w.id === id));
  const residents = useDemo((s) => s.residents);
  const invoices = useDemo((s) => s.invoices);
  const waSend = useDemo((s) => s.waSend);
  const waRead = useDemo((s) => s.waRead);
  const payInvoice = useDemo((s) => s.payInvoice);
  const decideLeave = useDemo((s) => s.decideLeave);
  const [text, setText] = useState("");
  const [asContact, setAsContact] = useState(true);
  const [typing, setTyping] = useState(false);
  const [paying, setPaying] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const count = thread?.messages.length ?? 0;
  useEffect(() => {
    waRead(id);
  }, [id, count, waRead]);
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [count, typing, paying]);
  if (!thread) return null;
  const r = residents.find((x) => x.id === thread.residentId);
  const lang = thread.role === "parent" ? "ml" : "en";
  const contactFirst = thread.contactName.split(" ")[0];

  const send = (msg: string, contact = asContact) => {
    if (!msg.trim()) return;
    waSend(thread.id, msg.trim(), contact ? "contact" : "hostel");
    setText("");
    if (contact) {
      setTyping(true);
      setTimeout(() => setTyping(false), 1100);
    }
  };
  const onButton = (msgId: string, action: string | undefined, label: string) => {
    const m = thread.messages.find((x) => x.id === msgId);
    if (!m) return;
    if (!action) return send(label, true);
    if (action === "invoice" || action === "receipt") return toast(t("linkOpened", { link: payLink(String(m.data?.invoiceId ?? "")), name: contactFirst }));
    if (action === "app") return toast(t("appOpened", { name: contactFirst }));
    if (action === "pay") {
      const invId = String(m.data?.invoiceId ?? "");
      const inv = invoices.find((i) => i.id === invId);
      if (!inv || inv.status === "paid") return;
      setPaying(invId);
      setTimeout(() => {
        payInvoice(invId, { method: "upi", via: "whatsapp_link" });
        setPaying(null);
      }, 1800);
    } else if (action === "approve" || action === "reject") {
      const leaveId = String(m.data?.leaveId ?? "");
      decideLeave(leaveId, action === "approve" ? "approved" : "rejected", "whatsapp");
    }
  };

  // group by day
  const groups: { day: string; items: typeof thread.messages }[] = [];
  for (const m of thread.messages) {
    const d = m.at.slice(0, 10);
    if (!groups.length || groups[groups.length - 1].day !== d) groups.push({ day: d, items: [] });
    groups[groups.length - 1].items.push(m);
  }
  const today = todayISO();
  const dayLabel = (d: string) => (d === today ? t("today") : new Date(new Date(`${today}T12:00:00+05:30`).getTime() - 86400000).toISOString().slice(0, 10) === d ? t("yesterday") : f.weekday(d));

  return (
    <>
      <header className="flex items-center gap-2 bg-[var(--wa-header)] px-2 py-2.5">
        <button onClick={onBack} className="grid size-9 place-items-center rounded-full hover:bg-black/5 dark:hover:bg-white/10" aria-label={t("back")}><ArrowLeft className="size-5" /></button>
        <WAAvatar name={thread.contactName} size={38} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] font-medium">{thread.contactName}</p>
          <p className="truncate text-[12.5px] text-[var(--wa-meta)]" aria-live="polite">{typing ? t("typing") : thread.role === "parent" ? t("parentOf", { name: r?.name ?? "" }) : t("residentAt", { bed: r?.bedId ?? "" })}</p>
        </div>
        <button className="grid size-9 place-items-center rounded-full text-[var(--wa-meta)]" aria-label={t("more")} tabIndex={-1}><MoreVertical className="size-5" /></button>
        <button onClick={onClose} className="grid size-9 place-items-center rounded-full hover:bg-black/5 dark:hover:bg-white/10" aria-label={t("close")}><X className="size-5" /></button>
      </header>
      <div ref={scroller} className="wa-wallpaper flex-1 overflow-y-auto px-3 py-3" aria-live="polite">
        <p className="mx-auto mb-3 w-fit max-w-[90%] rounded-lg bg-[#ffeecd] px-3 py-1.5 text-center text-[12.5px] text-[#54656f] dark:bg-[#182229] dark:text-[#ffd279]">{t("encryption", { hostel: hostel.name })}</p>
        {groups.map((g) => (
          <div key={g.day}>
            <p className="mx-auto my-3 w-fit rounded-lg bg-[var(--wa-chip)] px-3 py-1 text-[12.5px] text-[var(--wa-meta)] shadow-[0_1px_0.5px_rgb(11_20_26/0.13)]">{dayLabel(g.day)}</p>
            <div className="space-y-1.5">
              <AnimatePresence initial={false}>
                {g.items.map((m, i) => (
                  <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
                    <Bubble m={m} lang={lang} showTail={i === 0 || g.items[i - 1].from !== m.from} onButton={(action, label) => onButton(m.id, action, label)} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        ))}
        {paying && (
          <div className="mt-2 flex justify-start">
            <div className="flex items-center gap-2 rounded-lg bg-[var(--wa-in)] px-3 py-2 text-[13.5px] shadow-[0_1px_0.5px_rgb(11_20_26/0.13)]"><Loader2 className="size-4 animate-spin text-[var(--wa-green)]" aria-hidden />{t("payingUpi", { name: contactFirst })}</div>
          </div>
        )}
        {typing && (
          <div className="mt-2 flex justify-end">
            <div className="flex gap-1 rounded-lg bg-[var(--wa-out)] px-3 py-3" aria-label={t("typing")}>
              {[0, 1, 2].map((i) => <span key={i} className="size-1.5 animate-bounce rounded-full bg-[var(--wa-meta)]" style={{ animationDelay: `${i * 120}ms` }} />)}
            </div>
          </div>
        )}
      </div>
      <div className="border-t border-[var(--wa-divider)] bg-[var(--wa-header)] px-2 pt-2 pb-[calc(8px+env(safe-area-inset-bottom))]">
        <div className="mb-2 flex items-center gap-2 px-1">
          <div className="flex shrink-0 rounded-full bg-[var(--wa-in)] p-0.5 text-[12px]" role="radiogroup" aria-label={t("sendAs")}>
            <button role="radio" aria-checked={asContact} onClick={() => setAsContact(true)} className={cn("h-7 rounded-full px-2.5 font-medium whitespace-nowrap", asContact ? "bg-[var(--wa-green)] text-white" : "text-[var(--wa-meta)]")}>{t("as", { name: contactFirst })}</button>
            <button role="radio" aria-checked={!asContact} onClick={() => setAsContact(false)} className={cn("h-7 rounded-full px-2.5 font-medium whitespace-nowrap", !asContact ? "bg-[var(--wa-green)] text-white" : "text-[var(--wa-meta)]")}>{t("asHostel")}</button>
          </div>
          <span className="truncate text-[11.5px] text-[var(--wa-meta)]">{asContact ? t("asHint") : t("asHostelHint")}</span>
        </div>
        {asContact && (
          <div className="no-scrollbar mb-2 flex gap-1.5 overflow-x-auto px-1">
            {QUICK[thread.role].map((k) => (
              <button key={k} onClick={() => send(t(k))} className="h-8 shrink-0 rounded-full border border-[var(--wa-divider)] bg-[var(--wa-in)] px-3 text-[13px] text-[var(--wa-text)] hover:brightness-95">{t(k)}</button>
            ))}
          </div>
        )}
        <form onSubmit={(e) => { e.preventDefault(); send(text); }} className="flex items-center gap-2">
          <div className="flex h-11 flex-1 items-center gap-2 rounded-full bg-[var(--wa-in)] px-3">
            <Smile className="size-5 shrink-0 text-[var(--wa-meta)]" aria-hidden />
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t("message")} aria-label={t("message")} className="h-full min-w-0 flex-1 bg-transparent text-base text-[var(--wa-text)] md:text-[15px] outline-none placeholder:text-[var(--wa-meta)]" />
            <Paperclip className="size-5 shrink-0 text-[var(--wa-meta)]" aria-hidden />
          </div>
          <button type="submit" className="grid size-11 shrink-0 place-items-center rounded-full bg-[var(--wa-green)] text-white disabled:opacity-60" disabled={!text.trim()} aria-label={t("send")}><SendHorizontal className="size-5" /></button>
        </form>
      </div>
    </>
  );
}
