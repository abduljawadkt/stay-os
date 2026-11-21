// How the app's objects map to database rows. The app uses camelCase objects with nested parts;
// tables use snake_case columns and jsonb for the nested parts (see db/schema.sql).
import type { Activity, Seed, Staff } from "@/data";

export type Coll = Exclude<keyof Seed, "staffAttendance">;

export const TABLE: Record<Coll, string> = {
  beds: "beds", residents: "residents", invoices: "invoices", expenses: "expenses", complaints: "complaints", gate: "gate_events",
  leaves: "leaves", visitors: "visitors", optOuts: "meal_optouts", notices: "notices", activity: "activity", whatsapp: "wa_threads",
};
export const COLL_BY_TABLE = Object.fromEntries(Object.entries(TABLE).map(([c, t]) => [t, c])) as Record<string, Coll>;
export const COLLS = Object.keys(TABLE) as Coll[];

/** Newest-first lists get new rows at the top; the rest at the bottom. */
export const PREPEND: Coll[] = ["complaints", "gate", "leaves", "visitors", "activity", "whatsapp", "notices"];

const COLUMNS: Record<Coll | "staff", string[]> = {
  beds: ["id", "roomId", "block", "floor", "label", "status", "residentId", "reservation", "maintenanceNote"],
  residents: ["id", "name", "gender", "phone", "dob", "bloodGroup", "hometown", "occupation", "institution", "parent", "bedId", "checkInDate", "checkOutDate", "status", "kyc", "police", "messPlan", "deposit"],
  invoices: ["id", "residentId", "month", "issuedOn", "dueOn", "lines", "total", "status", "paidOn", "method", "utr", "paidVia", "remindersSent"],
  expenses: ["id", "date", "category", "vendor", "description", "amount", "mode", "receipt", "status"],
  complaints: ["id", "residentId", "roomId", "category", "title", "description", "channel", "status", "priority", "createdAt", "slaHours", "assignedTo", "resolvedAt", "rating", "updates", "photo"],
  gate: ["id", "residentId", "type", "at", "method", "late", "passId"],
  leaves: ["id", "residentId", "from", "to", "reason", "destination", "status", "requestedAt", "parentDecisionAt"],
  visitors: ["id", "name", "phone", "relation", "residentId", "purpose", "inAt", "outAt", "idProof", "idLast4"],
  optOuts: ["id", "residentId", "date", "meals", "reason", "source", "createdAt", "lunchAt"],
  notices: ["id", "category", "pinned", "audience", "postedAt", "title", "titleMl", "body", "bodyMl"],
  activity: ["id", "at", "kind"],
  whatsapp: ["id", "contactName", "role", "residentId", "phone", "unread", "messages"],
  staff: ["id", "name", "role", "title", "salary", "shift", "phone", "joinedOn", "attendance", "advance"],
};

/** Fallbacks for NOT NULL columns the app may leave empty. */
const DEFAULTS: Partial<Record<Coll | "staff", Record<string, unknown>>> = {
  residents: { phone: "", bloodGroup: "", hometown: "", institution: "", parent: {}, kyc: {}, police: {}, deposit: 0, messPlan: true, occupation: "student" },
  expenses: { description: "", mode: "bank", status: "paid" },
  complaints: { description: "", priority: "medium", updates: [] },
  leaves: { reason: "", destination: "" },
  visitors: { phone: "", relation: "", purpose: "", idProof: "", idLast4: "" },
  optOuts: { reason: "", meals: [], source: "app", lunchAt: "institute" },
  notices: { titleMl: "", body: "", bodyMl: "", pinned: false, audience: "all", category: "general" },
  whatsapp: { phone: "", unread: 0, messages: [] },
  invoices: { remindersSent: 0, lines: [] },
  staff: { title: "", salary: 0, shift: "", phone: "", attendance: {}, advance: 0 },
};

/** Optional app fields that are absent rather than null. */
const UNDEFINED_WHEN_NULL: Partial<Record<Coll, string[]>> = {
  beds: ["residentId", "reservation", "maintenanceNote"],
  complaints: ["photo"],
};

const snake = (k: string) => k.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase());
const camel = (k: string) => k.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());

export function toRow(coll: Coll | "staff", item: object, orgId: string): Record<string, unknown> {
  const src = item as Record<string, unknown>;
  const row: Record<string, unknown> = { org_id: orgId };
  for (const k of COLUMNS[coll]) {
    let v = src[k];
    if (v === undefined || v === null) v = DEFAULTS[coll]?.[k] ?? null;
    row[snake(k)] = v;
  }
  if (coll === "activity") {
    const { id: _id, at: _at, kind: _kind, ...data } = src;
    row.data = data;
  }
  return row;
}

export function fromRow<T = unknown>(coll: Coll | "staff" | "rooms", row: Record<string, unknown>): T {
  if (coll === "activity") {
    const { id, at, kind, data } = row as { id: string; at: string; kind: Activity["kind"]; data: object };
    return { ...(data ?? {}), id, at, kind } as T;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === "org_id" || k === "updated_at") continue;
    out[camel(k)] = v;
  }
  for (const k of UNDEFINED_WHEN_NULL[coll as Coll] ?? []) if (out[k] === null) delete out[k];
  return out as T;
}

export const staffFromRow = (row: Record<string, unknown>) => fromRow<Staff>("staff", row);

/** Order-independent equality for rows that went through jsonb (which sorts object keys). */
export function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a == b;
  if (typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    const bb = b as unknown[];
    return a.length === bb.length && a.every((x, i) => sameValue(x, bb[i]));
  }
  const ao = a as Record<string, unknown>, bo = b as Record<string, unknown>;
  const keys = new Set([...Object.keys(ao), ...Object.keys(bo)]);
  for (const k of keys) {
    const x = ao[k], y = bo[k];
    if ((x === undefined || x === null) && (y === undefined || y === null)) continue;
    if (!sameValue(x, y)) return false;
  }
  return true;
}
