"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useDemo } from "./store";
import { nowMs } from "./clock";
import { useLocale } from "./i18n";
import * as f from "./format";

/** Re-renders every `interval` ms with the demo clock. */
export function useNow(interval = 30000) {
  const [now, setNow] = useState(() => nowMs());
  useEffect(() => {
    const id = setInterval(() => setNow(nowMs()), interval);
    return () => clearInterval(id);
  }, [interval]);
  return now;
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
