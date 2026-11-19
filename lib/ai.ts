// "Ask StayOS": scripted intents that answer from the live demo state (no network, no model).
import type { DemoState } from "./store";
import {
  aging, expensesByCategory, headcount, occupancy, overdueInvoices, pnl, presence, prevMonth, rebates, roomById, sla, wasteSaved, invoiceState,
} from "./selectors";
import { demo } from "@/config/demo";
import type { BlockId, Meal } from "@/data";

export type Intent =
  | "dues" | "vacant" | "profit" | "waste" | "late" | "complaints" | "electricity" | "headcount" | "police" | "occupancy" | "leave";

export type Answer =
  | { intent: "dues"; total: number; count: number; rows: { name: string; bed: string; amount: number; days: number }[]; invoiceIds: string[]; remindCount: number }
  | { intent: "vacant"; block: BlockId; floor: number | null; rows: { bed: string; type: string; rent: number }[] }
  | { intent: "profit"; month: string; revenue: number; expenses: number; net: number; margin: number; prevNet: number }
  | { intent: "waste"; amount: number; meals: number; rebateTotal: number; rebateCount: number; year: number }
  | { intent: "late"; rows: { name: string; bed: string; time: string; mins: number }[] }
  | { intent: "complaints"; open: number; breached: { id: string; title: string; room: string; over: number }[]; risk: number }
  | { intent: "electricity"; month: string; prev: string; cur: number; last: number; change: number }
  | { intent: "headcount"; meal: Meal; cooking: number; enrolled: number; skipped: number; all: { meal: Meal; cooking: number }[] }
  | { intent: "police"; rows: { id: string; name: string; bed: string; since: string }[] }
  | { intent: "occupancy"; rate: number; occupied: number; leaving: number; arriving: number; projected: number }
  | { intent: "leave"; rows: { name: string; bed: string; to: string; destination: string }[]; awaiting: number };

const ML = /[ഀ-ൿ]/;
export const isMalayalam = (s: string) => ML.test(s);

const RULES: [Intent, RegExp][] = [
  ["vacant", /(free|vacant|empty|available|spare)\b.*\b(bed|room)|\b(bed|room)s?\b.*(free|vacant|empty|available)|ഒഴിവ്|ഒഴിഞ്ഞ|കിടക്ക/i],
  ["dues", /\b(fees?|rent|dues?|pending|unpaid|overdue|not paid|defaulter)|ഫീസ്|വാടക|അടയ്ക്കാനു|കുടിശ്ശിക|അടച്ചിട്ടില്ല/i],
  ["profit", /\b(profit|p&l|pnl|earn|earning|income|margin)|ലാഭ|വരുമാന/i],
  ["electricity", /\b(electric|electricity|power|kseb|current bill)|വൈദ്യുതി|കറന്റ്|കെഎസ്ഇബി/i],
  ["waste", /\b(waste|wastage|saved|saving|rebate|opt[- ]?out)|പാഴ|ലാഭിച്ച|റിബേറ്റ്/i],
  ["headcount", /\b(lunch|dinner|breakfast|snacks|headcount|how many.*(eat|eating)|kitchen)|ഉച്ച|അത്താഴ|പ്രഭാത|എത്ര പേർ.*(കഴിക്ക|ഭക്ഷണ)|അടുക്കള/i],
  ["late", /\b(late|curfew|after (10|ten)|night)|വൈകി|രാത്രി|കർഫ്യൂ/i],
  ["complaints", /\b(complaints?|sla|breach|tickets?|repairs?)|പരാതി/i],
  ["police", /\b(police|verification|kyc)|പോലീസ്|വെരിഫിക്കേഷൻ/i],
  ["leave", /\b(on leave|leave|who.*(home|away)|gate pass)|ലീവ്|അവധി|വീട്ടിൽ/i],
  ["occupancy", /\b(occupancy|occupied|forecast|december|next month|vacanc)|താമസ നിരക്ക്|ഒക്യുപൻസി|ഡിസംബർ/i],
];

export function detectIntent(q: string): Intent | null {
  for (const [intent, re] of RULES) if (re.test(q)) return intent;
  return null;
}

function parseBlockFloor(q: string): { block: BlockId; floor: number | null } {
  const s = q.toLowerCase();
  let block: BlockId = "B";
  const m = s.match(/block\s*([abc])\b|\b([abc])\s*block|ബ്ലോക്ക്\s*(എ|ബി|സി|a|b|c)/i);
  if (m) {
    const v = (m[1] ?? m[2] ?? m[3] ?? "b").toLowerCase();
    block = (v === "എ" ? "A" : v === "ബി" ? "B" : v === "സി" ? "C" : v.toUpperCase()) as BlockId;
  } else if (/\b([abc])-?\d/.test(s)) block = s.match(/\b([abc])-?\d/)![1].toUpperCase() as BlockId;
  const fm = s.match(/floor\s*(\d)|(\d)(?:st|nd|rd|th)?\s*floor|(\d)\s*(?:-ാം|ാം)?\s*നില|നില\s*(\d)/);
  const words: Record<string, number> = { first: 1, second: 2, third: 3, fourth: 4, "ഒന്നാം": 1, "രണ്ടാം": 2, "മൂന്നാം": 3, "നാലാം": 4 };
  let floor: number | null = fm ? Number(fm[1] ?? fm[2] ?? fm[3] ?? fm[4]) : null;
  if (!floor) for (const [w, n] of Object.entries(words)) if (s.includes(w)) floor = n;
  return { block, floor };
}

export function answer(intent: Intent, q: string, s: DemoState, nowIso: string): Answer {
  const today = nowIso.slice(0, 10);
  const resById = Object.fromEntries(s.residents.map((r) => [r.id, r]));
  switch (intent) {
    case "dues": {
      const list = s.invoices.filter((i) => i.status === "unpaid" && i.month <= demo.currentMonth);
      const byRes = new Map<string, { name: string; bed: string; amount: number; days: number }>();
      for (const i of list) {
        const r = resById[i.residentId];
        const cur = byRes.get(i.residentId) ?? { name: r?.name ?? "", bed: r?.bedId ?? "", amount: 0, days: 0 };
        cur.amount += i.total;
        cur.days = Math.max(cur.days, invoiceState(i, today).days * (invoiceState(i, today).state === "overdue" ? 1 : 0));
        byRes.set(i.residentId, cur);
      }
      const rows = [...byRes.values()].sort((a, b) => b.days - a.days || b.amount - a.amount);
      const od = overdueInvoices(s.invoices, today);
      return { intent, total: list.reduce((a, i) => a + i.total, 0), count: rows.length, rows, invoiceIds: od.map((i) => i.id), remindCount: new Set(od.map((i) => i.residentId)).size };
    }
    case "vacant": {
      const { block, floor } = parseBlockFloor(q);
      const rows = s.beds
        .filter((b) => b.status === "vacant" && b.block === block && (floor === null || b.floor === floor))
        .map((b) => ({ bed: b.id, type: roomById[b.roomId].type, rent: roomById[b.roomId].rent }));
      return { intent, block, floor, rows };
    }
    case "profit": {
      const p = pnl(s.invoices, s.expenses, demo.currentMonth);
      const pp = pnl(s.invoices, s.expenses, prevMonth(demo.currentMonth));
      return { intent, month: demo.currentMonth, revenue: p.revenue.total, expenses: p.expenses.total, net: p.net, margin: p.margin, prevNet: pp.net };
    }
    case "waste": {
      const w = wasteSaved(s.optOuts, demo.currentMonth, today);
      const rb = rebates(s.optOuts, demo.currentMonth);
      return { intent, amount: w.amount, meals: w.meals, rebateTotal: rb.reduce((a, r) => a + r.amount, 0), rebateCount: rb.length, year: Math.round((w.amount / Number(today.slice(8))) * 365) };
    }
    case "late": {
      const yday = new Date(new Date(`${today}T12:00:00+05:30`).getTime() - 86400000).toISOString().slice(0, 10);
      const rows = s.gate
        .filter((g) => g.late && (g.at.startsWith(yday) || g.at.startsWith(today)))
        .map((g) => {
          const r = resById[g.residentId];
          const curfew = r?.bedId.startsWith("C") ? 21 * 60 + 30 : 22 * 60;
          return { name: r?.name ?? "", bed: r?.bedId ?? "", time: g.at, mins: Number(g.at.slice(11, 13)) * 60 + Number(g.at.slice(14, 16)) - curfew };
        });
      return { intent, rows };
    }
    case "complaints": {
      const now = new Date(nowIso).getTime();
      const open = s.complaints.filter((c) => c.status !== "resolved");
      const breached = open.filter((c) => sla(c, now).state === "breached").map((c) => ({ id: c.id, title: c.title, room: c.roomId, over: -sla(c, now).remaining }));
      return { intent, open: open.length, breached, risk: open.filter((c) => sla(c, now).state === "risk").length };
    }
    case "electricity": {
      const cur = expensesByCategory(s.expenses, demo.currentMonth).byCategory.electricity;
      const last = expensesByCategory(s.expenses, prevMonth(demo.currentMonth)).byCategory.electricity;
      return { intent, month: demo.currentMonth, prev: prevMonth(demo.currentMonth), cur, last, change: last ? (cur - last) / last : 0 };
    }
    case "headcount": {
      const hc = headcount(s.residents, s.optOuts, today);
      const meal: Meal = /breakfast|പ്രഭാത/i.test(q) ? "breakfast" : /dinner|അത്താഴ/i.test(q) ? "dinner" : /snack|ചായ/i.test(q) ? "snacks" : "lunch";
      const h = hc.find((x) => x.meal === meal)!;
      return { intent, meal, cooking: h.cooking, enrolled: h.enrolled, skipped: h.skipped, all: hc.map((x) => ({ meal: x.meal, cooking: x.cooking })) };
    }
    case "police": {
      const rows = s.residents.filter((r) => r.status !== "checked_out" && r.police.status === "pending").map((r) => ({ id: r.id, name: r.name, bed: r.bedId, since: r.checkInDate }));
      return { intent, rows };
    }
    case "occupancy": {
      const o = occupancy(s.beds);
      const leaving = s.residents.filter((r) => r.status === "notice" && r.checkOutDate && r.checkOutDate <= `${demo.nextMonth}-31`).length;
      const arriving = s.beds.filter((b) => b.status === "reserved").length;
      return { intent, rate: o.rate, occupied: o.occupied, leaving, arriving, projected: (o.occupied - leaving + arriving) / o.total };
    }
    case "leave": {
      const p = presence(s.gate, s.residents, s.leaves, nowIso);
      const rows = s.leaves
        .filter((l) => l.status === "approved" && p.onLeave.has(l.residentId) && l.from <= nowIso && l.to >= nowIso)
        .map((l) => ({ name: resById[l.residentId]?.name ?? "", bed: resById[l.residentId]?.bedId ?? "", to: l.to, destination: l.destination }));
      return { intent, rows, awaiting: s.leaves.filter((l) => l.status === "awaiting_parent").length };
    }
  }
}

export const SUGGESTIONS: { q: string; lang: "en" | "ml" }[] = [
  { q: "ഈ മാസം ആരൊക്കെ ഫീസ് അടയ്ക്കാനുണ്ട്?", lang: "ml" },
  { q: "Which beds are free on Block B floor 2?", lang: "en" },
  { q: "What's my net profit this month?", lang: "en" },
  { q: "ഇന്ന് ഉച്ചയ്ക്ക് എത്ര പേർ കഴിക്കും?", lang: "ml" },
  { q: "Who came in late last night?", lang: "en" },
  { q: "Which complaints are past SLA?", lang: "en" },
  { q: "Compare electricity with last month", lang: "en" },
  { q: "How much food waste did we save this month?", lang: "en" },
  { q: "ആരുടെയൊക്കെ പോലീസ് വെരിഫിക്കേഷൻ ബാക്കിയുണ്ട്?", lang: "ml" },
  { q: "What will occupancy look like in December?", lang: "en" },
];

export { aging };
