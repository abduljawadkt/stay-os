import { demo } from "@/config/demo";

// The demo runs on a fixed calendar (Fri 27 Nov 2026, 10:24 AM IST) that ticks forward in real time.
const BASE = new Date(demo.now).getTime();
const KEY = "stayos-clock-start";
const MAX_ELAPSED = 4 * 60 * 60 * 1000;
let start = Date.now();

if (typeof window !== "undefined") {
  try {
    const saved = Number(window.localStorage.getItem(KEY));
    if (saved && Date.now() - saved < 12 * 60 * 60 * 1000) start = saved;
    else window.localStorage.setItem(KEY, String(start));
  } catch {
    /* storage blocked: clock starts fresh */
  }
}

export function resetClock() {
  start = Date.now();
  try {
    window.localStorage.setItem(KEY, String(start));
  } catch {}
}

export function nowMs() {
  return BASE + Math.min(Date.now() - start, MAX_ELAPSED);
}

const pad = (n: number) => String(n).padStart(2, "0");
/** ISO string with the +05:30 offset, matching the dataset. */
export function toIST(ms: number) {
  const d = new Date(ms + 330 * 60000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}+05:30`;
}
export const nowISO = () => toIST(nowMs());
export const todayISO = () => nowISO().slice(0, 10);
