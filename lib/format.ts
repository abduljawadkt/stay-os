export type Locale = "en" | "ml";
const TZ = "Asia/Kolkata";

const inrFmt = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
export const num = (n: number) => inrFmt.format(Math.round(n));
export function inr(n: number) {
  const s = inrFmt.format(Math.abs(Math.round(n)));
  return n < 0 ? `−₹${s}` : `₹${s}`;
}
export function inrCompact(n: number) {
  const a = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  const trim = (x: string) => x.replace(/\.0+$/, "").replace(/(\.\d)0$/, "$1");
  if (a >= 1e7) return `${sign}₹${trim((a / 1e7).toFixed(2))}Cr`;
  if (a >= 1e5) return `${sign}₹${trim((a / 1e5).toFixed(2))}L`;
  if (a >= 1e3) return `${sign}₹${trim((a / 1e3).toFixed(1))}K`;
  return `${sign}₹${Math.round(a)}`;
}
export const pct = (x: number, digits = 1) => `${(x * 100).toFixed(digits).replace(/\.0$/, "")}%`;

const cache = new Map<string, Intl.DateTimeFormat>();
function dtf(locale: Locale, opts: Intl.DateTimeFormatOptions, kind: "date" | "time") {
  const tag = locale === "ml" ? "ml-IN" : kind === "time" ? "en-US" : "en-GB";
  const key = tag + JSON.stringify(opts);
  let f = cache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(tag, { timeZone: TZ, ...opts });
    cache.set(key, f);
  }
  return f;
}
const asDate = (v: string | number | Date) =>
  typeof v === "string" && v.length === 10 ? new Date(`${v}T12:00:00+05:30`) : new Date(v);

/** 27 Nov 2026 */
export const fmtDate = (v: string | number | Date, l: Locale = "en") =>
  dtf(l, { day: "numeric", month: "short", year: "numeric" }, "date").format(asDate(v));
/** 27 Nov */
export const fmtDay = (v: string | number | Date, l: Locale = "en") =>
  dtf(l, { day: "numeric", month: "short" }, "date").format(asDate(v));
/** Fri, 27 Nov */
export const fmtWeekday = (v: string | number | Date, l: Locale = "en") =>
  dtf(l, { weekday: "short", day: "numeric", month: "short" }, "date").format(asDate(v));
/** Friday */
export const fmtWeekdayLong = (v: string | number | Date, l: Locale = "en") =>
  dtf(l, { weekday: "long" }, "date").format(asDate(v));
/** November 2026 */
export const fmtMonth = (ym: string, l: Locale = "en") =>
  dtf(l, { month: "long", year: "numeric" }, "date").format(new Date(`${ym}-15T12:00:00+05:30`));
/** Nov */
export const fmtMonthShort = (ym: string, l: Locale = "en") =>
  dtf(l, { month: "short" }, "date").format(new Date(`${ym}-15T12:00:00+05:30`));
/** 9:42 PM */
export const fmtTime = (v: string | number | Date, l: Locale = "en") =>
  dtf(l, { hour: "numeric", minute: "2-digit", hour12: true }, "time").format(asDate(v));

const rtfCache = new Map<string, Intl.RelativeTimeFormat>();
export function fmtRelative(v: string | number, nowMs: number, l: Locale = "en") {
  const tag = l === "ml" ? "ml-IN" : "en-GB";
  let rtf = rtfCache.get(tag);
  if (!rtf) {
    rtf = new Intl.RelativeTimeFormat(tag, { numeric: "auto", style: "short" });
    rtfCache.set(tag, rtf);
  }
  const diff = (new Date(v).getTime() - nowMs) / 1000;
  const a = Math.abs(diff);
  if (a < 45) return l === "ml" ? "ഇപ്പോൾ" : "just now";
  if (a < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (a < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  return rtf.format(Math.round(diff / 86400), "day");
}

/** 3h 12m, 45m */
export function fmtDuration(ms: number) {
  const m = Math.max(0, Math.round(Math.abs(ms) / 60000));
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d >= 1) return `${d}d ${h % 24}h`;
  if (h >= 1) return `${h}h ${String(m % 60).padStart(2, "0")}m`;
  return `${m}m`;
}

export function initials(name: string) {
  const parts = name.replace(/[^A-Za-z\s]/g, " ").split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || name.slice(0, 2).toUpperCase();
}
export const firstName = (name: string) => name.split(" ")[0];
