// Pure calculations over demo state. Every number on screen comes from here, never hardcoded.
import {
  hostel, rooms, messMenu, staff as staffList,
  type Bed, type Complaint, type Expense, type ExpenseCategory, type GateEvent, type Invoice, type LeaveRequest,
  type Meal, type MealOptOut, type MealPlace, type PlaceMeal, type Resident, type Room, type Staff,
} from "@/data";

export const MEALS: Meal[] = ["breakfast", "lunch", "snacks", "dinner"];
export const EXPENSE_CATEGORIES: ExpenseCategory[] = ["food", "electricity", "water", "salaries", "maintenance", "internet"];
/** Beds in the signed-in hostel. A live binding: refreshed by refreshIndexes() when a hostel loads. */
export let TOTAL_BEDS = 0;

export const roomById: Record<string, Room> = {};
export const staffById: Record<string, Staff> = {};

/** Rebuild the lookups after the reference data changes (see setReferenceData). */
export function refreshIndexes(bedCount: number) {
  TOTAL_BEDS = bedCount;
  for (const k of Object.keys(roomById)) delete roomById[k];
  for (const k of Object.keys(staffById)) delete staffById[k];
  for (const r of rooms) roomById[r.id] = r;
  for (const s of staffList) staffById[s.id] = s;
}

export function indexBy<T extends { id: string }>(list: T[]) {
  const m: Record<string, T> = {};
  for (const x of list) m[x.id] = x;
  return m;
}

const DAY = 86400000;
const dateMs = (d: string) => new Date(`${d}T00:00:00+05:30`).getTime();
export const daysBetween = (later: string, earlier: string) => Math.round((dateMs(later) - dateMs(earlier)) / DAY);
export const addDays = (d: string, n: number) => {
  const x = new Date(dateMs(d) + n * DAY + 330 * 60000);
  return x.toISOString().slice(0, 10);
};
export const monthOf = (d: string) => d.slice(0, 7);
export const daysInMonth = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};
export const prevMonth = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
};

// ---------- residents & beds ----------
export const isCurrent = (r: Resident) => r.status !== "checked_out";

export function occupancy(beds: Bed[]) {
  const c = { occupied: 0, vacant: 0, reserved: 0, maintenance: 0 };
  for (const b of beds) c[b.status]++;
  return { ...c, total: beds.length, rate: beds.length ? c.occupied / beds.length : 0 };
}

// ---------- blocks ----------
export const blockIds = () => hostel.blocks.map((b) => b.id);
export const blockGender = (block: string): "M" | "F" => hostel.blocks.find((b) => b.id === block)?.gender ?? "M";
/** Whether a resident of this gender may take a bed in this block (any block, if none is set aside for them). */
export const genderFits = (block: string, gender: "M" | "F") => !hostel.blocks.some((b) => b.gender === gender) || blockGender(block) === gender;
const curfewOf = (block: string) => hostel.blocks.find((b) => b.id === block)?.curfew ?? "22:00";
export const curfewMinutes = (block: string) => {
  const [h, m] = curfewOf(block).split(":").map(Number);
  return h * 60 + m;
};
/** "9:30 PM" */
export const curfewLabel = (block: string) => {
  const [h, m] = curfewOf(block).split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

/** The floors a block has rooms on, lowest first (floor 1 when it has none yet). */
export function floorsOf(block: string) {
  const fl = [...new Set(rooms.filter((r) => r.block === block).map((r) => r.floor))].sort((a, b) => a - b);
  return fl.length ? fl : [1];
}

export function occupancyByBlock(beds: Bed[]) {
  return hostel.blocks.map(({ id: block }) => ({ block, ...occupancy(beds.filter((b) => b.block === block)) }));
}

export function bedLabel(bedId: string) {
  // C-207-2 → C-207 · bed 2
  const [block, room, bed] = bedId.split("-");
  return { room: `${block}-${room}`, bed };
}

// ---------- invoices ----------
export type InvoiceState = "paid" | "overdue" | "due_today" | "due";
export function invoiceState(inv: Invoice, today: string): { state: InvoiceState; days: number } {
  if (inv.status === "paid") return { state: "paid", days: 0 };
  const d = daysBetween(today, inv.dueOn);
  if (d > 0) return { state: "overdue", days: d };
  if (d === 0) return { state: "due_today", days: 0 };
  return { state: "due", days: -d };
}

export function monthSummary(invoices: Invoice[], month: string) {
  const list = invoices.filter((i) => i.month === month);
  let billed = 0, collected = 0, collectedInMonth = 0, unpaidCount = 0;
  for (const i of list) {
    billed += i.total;
    if (i.status === "paid") {
      collected += i.total;
      if (i.paidOn && i.paidOn.slice(0, 7) === month) collectedInMonth += i.total;
    } else unpaidCount++;
  }
  return { month, count: list.length, billed, collected, pending: billed - collected, rate: billed ? collected / billed : 0, rateInMonth: billed ? collectedInMonth / billed : 0, unpaidCount };
}

export const AGING_BUCKETS = [
  { id: "b1", min: 1, max: 15 },
  { id: "b2", min: 16, max: 30 },
  { id: "b3", min: 31, max: 60 },
  { id: "b4", min: 61, max: Infinity },
] as const;
export type AgingId = (typeof AGING_BUCKETS)[number]["id"];

export function aging(invoices: Invoice[], today: string) {
  const buckets = AGING_BUCKETS.map((b) => ({ ...b, amount: 0, count: 0, invoices: [] as Invoice[] }));
  for (const inv of invoices) {
    if (inv.status === "paid") continue;
    const { state, days } = invoiceState(inv, today);
    if (state !== "overdue") continue;
    const b = buckets.find((x) => days >= x.min && days <= x.max)!;
    b.amount += inv.total;
    b.count++;
    b.invoices.push(inv);
  }
  return buckets;
}

export function overdueInvoices(invoices: Invoice[], today: string) {
  return invoices
    .filter((i) => i.status === "unpaid" && invoiceState(i, today).state === "overdue")
    .sort((a, b) => a.dueOn.localeCompare(b.dueOn));
}

/** Monthly rows for the collection trend. "Collected" counts only money received within that month. */
export function collectionTrend(invoices: Invoice[], months: string[]) {
  return months.map((m) => {
    const s = monthSummary(invoices, m);
    return { month: m, billed: s.billed, collected: m === months[months.length - 1] ? s.collected : Math.round(s.billed * s.rateInMonth), rate: m === months[months.length - 1] ? s.rate : s.rateInMonth };
  });
}

// ---------- revenue, expenses, P&L ----------
export function revenue(invoices: Invoice[], month: string, basis: "billed" | "collected" = "collected") {
  const r = { rent: 0, mess: 0, rebate: 0 };
  for (const inv of invoices) {
    if (inv.month !== month) continue;
    if (basis === "collected" && inv.status !== "paid") continue;
    for (const l of inv.lines) {
      if (l.kind === "rent") r.rent += l.amount;
      else if (l.kind === "mess") r.mess += l.amount;
      else if (l.kind === "rebate") r.rebate += l.amount;
    }
  }
  return { ...r, total: r.rent + r.mess + r.rebate };
}

export function expensesByCategory(expenses: Expense[], month: string) {
  const out = Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c, 0])) as Record<ExpenseCategory, number>;
  for (const e of expenses) if (e.date.slice(0, 7) === month) out[e.category] += e.amount;
  const total = Object.values(out).reduce((a, b) => a + b, 0);
  return { byCategory: out, total };
}

export function pnl(invoices: Invoice[], expenses: Expense[], month: string) {
  const rev = revenue(invoices, month, "collected");
  const exp = expensesByCategory(expenses, month);
  return { revenue: rev, expenses: exp, net: rev.total - exp.total, margin: rev.total ? (rev.total - exp.total) / rev.total : 0 };
}

export function occupancyTrend(residents: Resident[], months: string[], current: number) {
  return months.map((m, i) => {
    if (i === months.length - 1) return { month: m, rate: current, count: Math.round(current * TOTAL_BEDS) };
    if (!TOTAL_BEDS) return { month: m, rate: 0, count: 0 };
    const mid = `${m}-15`;
    const count = residents.filter((r) => r.checkInDate <= mid && (!r.checkOutDate || r.status !== "checked_out" || r.checkOutDate >= mid)).length;
    return { month: m, rate: count / TOTAL_BEDS, count };
  });
}

// ---------- mess ----------
export function optOutFor(optOuts: MealOptOut[], residentId: string, date: string) {
  return optOuts.find((o) => o.residentId === residentId && o.date === date);
}

export function messEnrolled(residents: Resident[], date: string) {
  return residents.filter((r) => isCurrent(r) && r.messPlan && r.checkInDate <= date);
}

export function headcount(residents: Resident[], optOuts: MealOptOut[], date: string) {
  const enrolled = messEnrolled(residents, date);
  const enrolledIds = new Set(enrolled.map((r) => r.id));
  const skipped: Record<Meal, number> = { breakfast: 0, lunch: 0, snacks: 0, dinner: 0 };
  for (const o of optOuts) {
    if (o.date !== date || !enrolledIds.has(o.residentId)) continue;
    for (const m of o.meals) skipped[m]++;
  }
  return MEALS.map((meal) => ({ meal, enrolled: enrolled.length, skipped: skipped[meal], cooking: enrolled.length - skipped[meal] }));
}

/** A meal's cut-off as stored ("10:00", or "21:00 previous day" for breakfast): its time, and whether it falls the day before. */
export function cutoffParts(v: string | undefined) {
  const m = /^(\d{1,2}:\d{2})\s*(previous day)?/i.exec(v ?? "");
  return { time: m?.[1] ?? v ?? "", dayBefore: !!m?.[2] };
}

/** When a meal on a day stops taking changes, as "YYYY-MM-DDTHH:MM" in IST: the hostel's cut-off, on the day or the day before. */
export function cutoffAt(meal: Meal, date: string) {
  const { time, dayBefore } = cutoffParts(messMenu.cutoffs[meal]);
  const hm = /^\d{1,2}:\d{2}$/.test(time) ? time.padStart(5, "0") : "00:00";
  return `${dayBefore ? addDays(date, -1) : date}T${hm}`;
}
/** Whether residents can no longer skip that meal on that day, or change where they have it. `now` is an IST ISO time. */
export const cutoffPassed = (meal: Meal, date: string, now: string) => now.slice(0, 16) >= cutoffAt(meal, date);

export const PLACE_MEALS: PlaceMeal[] = ["breakfast", "lunch", "dinner"];
export const isPlaceMeal = (m: Meal): m is PlaceMeal => m !== "snacks";
/** Where a meal is had when the resident hasn't chosen: breakfast and dinner at the hostel, lunch at the institute. */
export const DEFAULT_PLACE: Record<PlaceMeal, MealPlace> = { breakfast: "hostel", lunch: "institute", dinner: "hostel" };
/** The resident's choice for that day's meal, or the default. */
export function mealPlace(o: Pick<MealOptOut, "mealAt" | "lunchAt"> | undefined, meal: PlaceMeal): MealPlace {
  const p = o?.mealAt?.[meal];
  if (p) return p;
  if (meal === "lunch" && o?.lunchAt === "hostel") return "hostel";
  return DEFAULT_PLACE[meal];
}
export const blockOfBed = (bedId: string) => bedId.split("-")[0];
/** The block whose dining serves this place: the resident's own for "hostel", none for the institute. */
export const placeBlock = (place: MealPlace, ownBlock: string) => (place === "institute" ? null : place === "hostel" ? ownBlock : place.slice(6));

/** Who has a meal where on a day: at their institute, at the hostel, and the hostel number split by block. */
export function placeSplit(residents: Resident[], optOuts: MealOptOut[], date: string, meal: PlaceMeal) {
  const mine = new Map<string, MealOptOut>();
  for (const o of optOuts) if (o.date === date) mine.set(o.residentId, o);
  let institute = 0;
  const byBlock: Record<string, number> = {};
  for (const r of messEnrolled(residents, date)) {
    const o = mine.get(r.id);
    if (o?.meals.includes(meal)) continue;
    const block = placeBlock(mealPlace(o, meal), blockOfBed(r.bedId));
    if (block === null) institute++;
    else byBlock[block] = (byBlock[block] ?? 0) + 1;
  }
  const hostel = Object.values(byBlock).reduce((a, b) => a + b, 0);
  return { institute, hostel, byBlock };
}

export function wasteSaved(optOuts: MealOptOut[], month: string, uptoDate: string) {
  let meals = 0, amount = 0;
  for (const o of optOuts) {
    if (o.date.slice(0, 7) !== month || o.date > uptoDate) continue;
    for (const m of o.meals) {
      meals++;
      amount += messMenu.plateCost[m];
    }
  }
  return { meals, amount };
}

/** Rebate: ₹70 a day for every run of 3+ consecutive full days away (all four meals skipped). */
export function rebates(optOuts: MealOptOut[], month: string) {
  const fullDays = new Map<string, string[]>();
  for (const o of optOuts) {
    if (o.date.slice(0, 7) !== month || o.meals.length < 4) continue;
    if (!fullDays.has(o.residentId)) fullDays.set(o.residentId, []);
    fullDays.get(o.residentId)!.push(o.date);
  }
  const out: { residentId: string; days: number; amount: number; from: string; to: string }[] = [];
  for (const [residentId, dates] of fullDays) {
    const sorted = [...new Set(dates)].sort();
    let runStart = 0, total = 0, first = "", last = "";
    for (let i = 1; i <= sorted.length; i++) {
      if (i < sorted.length && daysBetween(sorted[i], sorted[i - 1]) === 1) continue;
      const len = i - runStart;
      if (len >= messMenu.rebateMinDays) {
        total += len;
        if (!first) first = sorted[runStart];
        last = sorted[i - 1];
      }
      runStart = i;
    }
    if (total > 0) out.push({ residentId, days: total, amount: total * messMenu.rebatePerDay, from: first, to: last });
  }
  return out.sort((a, b) => b.amount - a.amount);
}

const NO_ITEM = { en: "Not set", ml: "നിശ്ചയിച്ചിട്ടില്ല", veg: true };
const EMPTY_DAY = { day: 0, breakfast: NO_ITEM, lunch: NO_ITEM, snacks: NO_ITEM, dinner: NO_ITEM };
const filled = (x: { en: string; ml: string; veg: boolean } | undefined) => (x && (x.en || x.ml) ? x : NO_ITEM);

/** One day of the weekly menu (0 = Sunday). A new hostel's menu starts empty: unset dishes read "Not set". */
export function menuForDay(day: number) {
  const d = messMenu.menu.find((x) => x.day === day);
  return d ? { ...d, breakfast: filled(d.breakfast), lunch: filled(d.lunch), snacks: filled(d.snacks), dinner: filled(d.dinner) } : { ...EMPTY_DAY, day };
}
export function menuFor(date: string) {
  return menuForDay(new Date(`${date}T12:00:00+05:30`).getDay());
}

// ---------- complaints ----------
export type SlaState = "ok" | "risk" | "breached" | "met" | "missed";
export function sla(c: Complaint, now: number) {
  const start = new Date(c.createdAt).getTime();
  const limit = c.slaHours * 3600000;
  const end = c.resolvedAt ? new Date(c.resolvedAt).getTime() : now;
  const elapsed = end - start;
  const ratio = elapsed / limit;
  let state: SlaState;
  if (c.resolvedAt) state = ratio <= 1 ? "met" : "missed";
  else state = ratio >= 1 ? "breached" : ratio >= 0.75 ? "risk" : "ok";
  return { state, remaining: limit - elapsed, elapsed, ratio };
}

// ---------- gate ----------
export function lastGateByResident(gate: GateEvent[]) {
  const m = new Map<string, GateEvent>();
  for (const g of gate) {
    const cur = m.get(g.residentId);
    if (!cur || g.at > cur.at) m.set(g.residentId, g);
  }
  return m;
}

export function presence(gate: GateEvent[], residents: Resident[], leaves: LeaveRequest[], nowIso: string) {
  const last = lastGateByResident(gate);
  const onLeave = new Set(leaves.filter((l) => l.status === "approved" && l.from <= nowIso && l.to >= nowIso).map((l) => l.residentId));
  let inside = 0, out = 0, leave = 0;
  for (const r of residents) {
    if (!isCurrent(r)) continue;
    if (onLeave.has(r.id)) leave++;
    else if (last.get(r.id)?.type === "out") out++;
    else inside++;
  }
  return { inside, out, leave, onLeave };
}

// ---------- staff ----------
export function staffMonth(s: Staff, attendance: Staff["attendance"], uptoDate: string) {
  let present = 0, absent = 0, leave = 0, late = 0, half = 0;
  for (const [d, mark] of Object.entries(attendance)) {
    if (d > uptoDate) continue;
    if (mark === "P") present++;
    else if (mark === "late") { present++; late++; }
    else if (mark === "A") absent++;
    else if (mark === "L") leave++;
    else if (mark === "H") half++;
  }
  const daily = s.salary / 30;
  const paidLeaves = 2;
  const unpaidDays = absent + Math.max(0, leave - paidLeaves) + half * 0.5;
  const deduction = Math.round(unpaidDays * daily);
  return { present, absent, leave, late, half, deduction, advance: s.advance, net: s.salary - deduction - s.advance };
}

export const currentMonthKey = () => hostel.months[hostel.months.length - 1];
