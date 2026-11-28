"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { hostel } from "@/data";
import { useDemo } from "./store";
import { BASE_MS, nowMs, toIST } from "./clock";
import { useLocale } from "./i18n";
import * as f from "./format";

/**
 * The demo clock, re-rendered every `interval` ms. The first render always uses the fixed demo
 * start time so server and browser agree; the live time takes over right after mount.
 */
export function useNow(interval = 30000) {
  const [now, setNow] = useState(BASE_MS);
  useEffect(() => {
    setNow(nowMs());
    const id = setInterval(() => setNow(nowMs()), interval);
    return () => clearInterval(id);
  }, [interval]);
  return now;
}
/** The demo clock as an IST ISO string (hydration-safe, see useNow). */
export function useNowISO(interval = 30000) {
  return toIST(useNow(interval));
}

const visited = new Set<string>();
/**
 * Data views show a short skeleton the first time they open (like a real network fetch),
 * and an error state while "Simulate offline" is on.
 */
export function useScreenState(key: string) {
  const hydrated = useDemo((s) => s.hydrated);
  const offline = useDemo((s) => s.offline);
  const [loading, setLoading] = useState(() => !visited.has(key));
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!hydrated) return;
    if (visited.has(key) && attempt === 0) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(() => {
      visited.add(key);
      setLoading(false);
    }, 380 + Math.random() * 320);
    return () => clearTimeout(t);
  }, [hydrated, key, attempt]);
  return {
    loading: !hydrated || loading,
    error: hydrated && !loading && offline,
    retry: () => {
      useDemo.getState().setOffline(false);
      visited.delete(key);
      setAttempt((a) => a + 1);
    },
  };
}

/** Locale-bound formatters. */
export function useFormat() {
  const { locale } = useLocale();
  return {
    locale,
    inr: f.inr,
    inrCompact: f.inrCompact,
    num: f.num,
    pct: f.pct,
    date: (v: string | number | Date) => f.fmtDate(v, locale),
    day: (v: string | number | Date) => f.fmtDay(v, locale),
    weekday: (v: string | number | Date) => f.fmtWeekday(v, locale),
    weekdayLong: (v: string | number | Date) => f.fmtWeekdayLong(v, locale),
    month: (ym: string) => f.fmtMonth(ym, locale),
    monthShort: (ym: string) => f.fmtMonthShort(ym, locale),
    time: (v: string | number | Date) => f.fmtTime(v, locale),
    relative: (v: string | number, now: number) => f.fmtRelative(v, now, locale),
    duration: f.fmtDuration,
  };
}

const mq = (q: string) => ({
  subscribe: (cb: () => void) => {
    const m = window.matchMedia(q);
    m.addEventListener("change", cb);
    return () => m.removeEventListener("change", cb);
  },
  get: () => window.matchMedia(q).matches,
});
export function useMediaQuery(q: string, serverValue = false) {
  const { subscribe, get } = mq(q);
  return useSyncExternalStore(subscribe, get, () => serverValue);
}

/** True inside the native iOS shell (Capacitor). */
export function useIsNative() {
  return useSyncExternalStore(
    () => () => {},
    () => typeof window !== "undefined" && !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.(),
    () => false
  );
}

const isTextField = (el: Element | null) => {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
  if (el instanceof HTMLInputElement) return !["checkbox", "radio", "button", "submit", "reset", "file", "range", "color"].includes(el.type);
  return (el as HTMLElement).isContentEditable === true;
};

/**
 * True while the on-screen keyboard is likely up: a text field has focus on a touch screen. Phone tab bars
 * hide then, as in native apps; otherwise iOS Safari floats them above the keyboard, over the field.
 */
export function useKeyboardOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!window.matchMedia("(pointer: coarse)").matches) return;
    const update = () => setOpen(isTextField(document.activeElement));
    // focusout fires before the next field gets focus; wait a tick so moving between fields doesn't flicker
    const onOut = () => window.setTimeout(update, 50);
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", onOut);
    return () => {
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", onOut);
    };
  }, []);
  return open;
}

/** A block's name: the one the owner gave it ("Ladies block"), or "Block A" in the app's language. */
export function useBlockName() {
  const t = useTranslations("blockLabel");
  return (id: string) => {
    const name = hostel.blocks.find((b) => b.id === id)?.name?.trim();
    return !name || name === `Block ${id}` ? t("default", { block: id }) : name;
  };
}
