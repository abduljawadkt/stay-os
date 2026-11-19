import { demo } from "@/config/demo";

// Two clocks. Sample-data hostels run on the demo calendar (Fri 27 Nov 2026, 10:24 AM IST) that ticks
// forward in real time, so the story always lines up. Real hostels use the real time.
const KEY = "stayos-clock-start";
const MAX_ELAPSED = 4 * 60 * 60 * 1000;

/** Live binding: the clock's starting point, also the first value useNow renders. */
export let BASE_MS = new Date(demo.now).getTime();
let mode: "demo" | "real" = "demo";
let start = Date.now();

function restoreStart() {
  if (typeof window === "undefined") return;
  try {
    const saved = Number(window.localStorage.getItem(KEY));
    if (saved && Date.now() - saved < 12 * 60 * 60 * 1000) start = saved;
    else window.localStorage.setItem(KEY, String(start));
  } catch {
    /* storage blocked: clock starts fresh */
  }
}
restoreStart();

/**
 * Sample hostels: the story clock starts when this device first opened the hostel, or when its sample
 * data was last reset (whichever is later), so a reset lines up every device sharing the demo.
 */
export function setClock(next: { mode: "demo" | "real"; now?: string; resetAt?: string }) {
  mode = next.mode;
  BASE_MS = mode === "demo" && next.now ? new Date(next.now).getTime() : Date.now();
  const resetMs = next.resetAt ? new Date(next.resetAt).getTime() : 0;
  if (mode === "demo" && resetMs > start && resetMs <= Date.now()) {
    start = resetMs;
    try {
      window.localStorage.setItem(KEY, String(start));
    } catch {}
  }
}
export const clockMode = () => mode;

export function resetClock() {
  start = Date.now();
  try {
    window.localStorage.setItem(KEY, String(start));
  } catch {}
}

export function nowMs() {
  return mode === "real" ? Date.now() : BASE_MS + Math.min(Date.now() - start, MAX_ELAPSED);
}

const pad = (n: number) => String(n).padStart(2, "0");
/** ISO string with the +05:30 offset, matching the dataset. */
export function toIST(ms: number) {
  const d = new Date(ms + 330 * 60000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}+05:30`;
}
export const nowISO = () => toIST(nowMs());
export const todayISO = () => nowISO().slice(0, 10);
