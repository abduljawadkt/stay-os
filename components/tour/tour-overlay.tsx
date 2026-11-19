"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Play, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/brand/logo";
import { useDemo } from "@/lib/store";
import { useTour } from "./tour-store";
import { STEPS, waitFor } from "./steps";
import { brand } from "@/config/brand";
import { cn } from "@/lib/utils";

type Rect = { top: number; left: number; width: number; height: number };
const PAD = 6;
const CARD_W = 352;

/** Spotlight tour: dims the page, cuts a hole around the target, and explains it in a card. */
export function TourOverlay() {
  const t = useTranslations("tour");
  const active = useTour((s) => s.active);
  const index = useTour((s) => s.index);
  const goto = useTour((s) => s.goto);
  const stop = useTour((s) => s.stop);
  const router = useRouter();
  const pathname = usePathname();
  const setTourActive = useDemo((s) => s.setTourActive);
  const [rect, setRect] = useState<Rect | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const card = useRef<HTMLDivElement>(null);
  const [cardH, setCardH] = useState(220);
  const step = STEPS[index];
  const selector = step ? (typeof step.target === "function" ? step.target() : step.target) ?? null : null;

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") (window as unknown as { __tour: typeof useTour }).__tour = useTour;
    setTourActive(active);
  }, [active, setTourActive]);

  // enter a step: navigate, wait for target, run its enter action
  useEffect(() => {
    if (!active || !step) return;
    let cancelled = false;
    setReady(false);
    setRect(null);
    (async () => {
      if (step.route) {
        const [path] = step.route.split("?");
        if (pathname.replace(/\/$/, "") !== path.replace(/\/$/, "") || step.route.includes("?")) router.push(step.route);
        await waitFor("main, #app-scroll", 6000);
      }
      if (step.enter) await step.enter();
      const sel = typeof step.target === "function" ? step.target() : step.target;
      if (sel) {
        const el = await waitFor(sel, 7000);
        el?.scrollIntoView({ block: "center", behavior: "smooth" });
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, index]);

  // keep the spotlight glued to the target while things animate or scroll
  useEffect(() => {
    if (!active || !ready || !selector) return;
    let raf = 0;
    let last = "";
    const tick = () => {
      const el = document.querySelector(selector);
      if (el) {
        const r = el.getBoundingClientRect();
        const key = `${Math.round(r.top)}|${Math.round(r.left)}|${Math.round(r.width)}|${Math.round(r.height)}`;
        if (key !== last) {
          last = key;
          setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
        }
      }
      raf = window.setTimeout(tick, 120) as unknown as number;
    };
    tick();
    return () => clearTimeout(raf);
  }, [active, ready, selector]);

  useLayoutEffect(() => {
    if (card.current) setCardH(card.current.offsetHeight);
  });

  const next = useCallback(async () => {
    if (busy || !step) return;
    if (index === STEPS.length - 1) return stop();
    setBusy(true);
    try {
      if (step.next) await step.next();
    } finally {
      setBusy(false);
    }
    goto(index + 1);
  }, [busy, step, index, goto, stop]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector("[role=dialog][data-state=open]")) stop();
      if (e.key === "ArrowRight" && !busy && ready) next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, busy, ready, next, stop]);

  if (!active || !step) return null;

  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const w = Math.min(CARD_W, vw - 32);
  let pos: { top: number; left: number } | null = null;
  if (rect && ready) {
    const hole = { top: rect.top - PAD, left: rect.left - PAD, bottom: rect.top + rect.height + PAD, right: rect.left + rect.width + PAD };
    const fits = (top: number, left: number) => top >= 12 && left >= 12 && top + cardH <= vh - 12 && left + w <= vw - 12;
    const cx = Math.min(Math.max(12, rect.left + rect.width / 2 - w / 2), vw - w - 12);
    const cy = Math.min(Math.max(12, rect.top + rect.height / 2 - cardH / 2), vh - cardH - 12);
    const options = [
      { top: hole.bottom + 12, left: cx },
      { top: hole.top - 12 - cardH, left: cx },
      { top: cy, left: hole.right + 12 },
      { top: cy, left: hole.left - 12 - w },
    ];
    pos = options.find((o) => fits(o.top, o.left)) ?? null;
  }
  const centered = !selector || !pos;
  const ctaKey = step.cta ?? "next";

  return (
    <div className="fixed inset-0 z-[60]" style={{ pointerEvents: "none" }} data-tour-ui aria-live="polite">
      {/* dim layer with a spotlight hole */}
      <AnimatePresence>
        {selector && rect && ready ? (
          <motion.div
            key="hole"
            initial={false}
            animate={{ top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 32 }}
            className="absolute rounded-xl ring-2 ring-brand"
            style={{ boxShadow: "0 0 0 9999px rgb(14 14 13 / 0.55)" }}
          />
        ) : (
          <motion.div key="dim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-[rgb(14_14_13/0.55)]" />
        )}
      </AnimatePresence>

      <motion.div
        ref={card}
        role="dialog"
        aria-modal="false"
        aria-labelledby="tour-title"
        key={step.id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
        style={{
          pointerEvents: "auto",
          width: step.id === "welcome" || step.id === "done" ? Math.min(440, vw - 32) : w,
          ...(centered ? { left: "50%", top: "50%" } : { left: pos!.left, top: pos!.top }),
        }}
        className={cn("absolute rounded-xl border border-line bg-surface p-5 text-fg shadow-lg", centered && "!translate-x-[-50%] !translate-y-[-50%]")}
      >
        {(step.id === "welcome" || step.id === "done") && <LogoMark size={36} className="mb-4" />}
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-medium text-brand-text tnum">{t("progress", { n: index + 1, total: STEPS.length })}</p>
          <button onClick={stop} className="-mt-1 -mr-1 grid size-7 place-items-center rounded-md text-fg-3 hover:bg-surface-2 hover:text-fg" aria-label={t("skip")}><X className="size-4" /></button>
        </div>
        <h2 id="tour-title" className="mt-1 text-base font-semibold text-fg">{t(`steps.${step.id}.title`, { brand: brand.name })}</h2>
        <p className="mt-1.5 text-sm text-fg-2">{t(`steps.${step.id}.body`, { brand: brand.name })}</p>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-surface-2" aria-hidden><div className="h-full rounded-full bg-brand transition-[width] duration-300" style={{ width: `${((index + 1) / STEPS.length) * 100}%` }} /></div>
        <div className="mt-4 flex items-center justify-between gap-2">
          {step.id === "done" ? (
            <>
              <Button variant="quiet" size="sm" onClick={() => { stop(); useDemo.getState().reset(); }}><RotateCcw /> {t("reset")}</Button>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => goto(0)}><Play /> {t("again")}</Button>
                <Button variant="primary" size="sm" onClick={stop}>{t("explore")}</Button>
              </div>
            </>
          ) : (
            <>
              <Button variant="quiet" size="sm" onClick={stop}>{t("skip")}</Button>
              <Button variant="primary" size="sm" onClick={next} disabled={busy || !ready} data-tour-next>
                {(busy || !ready) && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
                {t(`cta.${ctaKey}`)}
              </Button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
