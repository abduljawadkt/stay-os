"use client";

// Keeps the open hostel in the browser in step with Neon:
//  - loadOrg reads every table once (row-level security decides what this user sees);
//  - every change the app makes to the store is upserted shortly after;
//  - every few seconds changes_since() brings in what other people changed (another device, a parent's phone).
import { useDemo, type Role } from "./store";
import { neon, errorText } from "./neon";
import { setClock, nowISO, todayISO } from "./clock";
import { refreshIndexes } from "./selectors";
import { COLLS, COLL_BY_TABLE, PREPEND, TABLE, fromRow, sameValue, staffFromRow, toRow, type Coll } from "./db-map";
import { emptySeed, setReferenceData, staff as staffList, type Hostel, type Invoice, type Room, type Seed, type Staff, type Complaint, type LeaveRequest, type GateEvent, type Resident } from "@/data";
import { demo } from "@/config/demo";
import type { Membership, OrgRow } from "./session";

const POLL_MS = 4000;
const PAGE = 1000;

let orgId: string | null = null;
let canWriteStaff = false;
let since = "";
let applyingRemote = false;
let unsubscribe: (() => void) | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let polling = false;
const pending = new Map<string, { coll: Coll | "staff"; id: string }>();
const inflight = new Set<string>();

const key = (coll: string, id: string) => `${coll}:${id}`;

function setSaving(v: "idle" | "saving" | "saved" | "error") {
  // imported lazily to avoid a cycle at module load
  import("./session").then(({ useSession }) => useSession.setState({ saving: v }));
}

async function fetchAll(table: string, id: string): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await neon().from(table).select("*").eq("org_id", id).order("id").range(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...((data ?? []) as Record<string, unknown>[]));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

const pad = (n: number) => String(n).padStart(2, "0");
function lastMonths(current: string, n: number) {
  const [y, m] = current.split("-").map(Number);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    out.push(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`);
  }
  return out;
}
function nextMonthOf(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${pad(m + 1)}`;
}

/** Read a hostel from the database and put it in the app. */
export async function loadOrg(id: string, membership: Membership): Promise<OrgRow> {
  const staffRole = membership.role === "owner" || membership.role === "warden";
  const stamp = await neon().rpc("changes_since", { p_org: id, p_since: "infinity" });
  if (stamp.error) throw stamp.error;
  const serverNow = (stamp.data as { now: string }).now;

  const [orgRes, roomsRows, staffRows, ...collRows] = await Promise.all([
    neon().from("orgs").select("*").eq("id", id).single(),
    fetchAll("rooms", id),
    staffRole
      ? fetchAll("staff", id)
      : neon().rpc("staff_directory", { p_org: id }).then(({ data, error }: { data: unknown; error: unknown }) => {
          if (error) throw error;
          return ((data ?? []) as Record<string, unknown>[]).map((s) => ({ ...s, salary: 0, attendance: {}, advance: 0, joined_on: null }));
        }),
    ...COLLS.map((c) => fetchAll(TABLE[c], id)),
  ]);
  if (orgRes.error) throw orgRes.error;
  const org = orgRes.data as OrgRow;

  // clock: sample-data hostels run on the demo calendar
  const clock = org.settings.clock ?? { mode: "real" as const };
  setClock({ ...clock, resetAt: org.settings.reset_at });
  if (clock.mode === "demo") demo.now = clock.now ?? demo.now;
  const today = todayISO();
  const currentMonth = today.slice(0, 7);

  const rooms = roomsRows.map((r) => fromRow<Room>("rooms", r));
  const staff = (staffRows as Record<string, unknown>[]).map(staffFromRow);
  type BlockRow = NonNullable<OrgRow["settings"]["blocks"]>[number];
  const blocks: BlockRow[] = org.settings.blocks?.length
    ? org.settings.blocks
    : [...new Set(rooms.map((r) => r.block))].sort().map((b) => ({ id: b, name: `Block ${b}`, gender: "M" as const, floors: Math.max(...rooms.filter((r) => r.block === b).map((r) => r.floor)), curfew: "22:00" }));
  const hostel: Hostel = {
    id: org.id, name: org.name, city: org.city, address: org.address, phone: org.phone, whatsapp: org.whatsapp, upiId: org.upi_id, bank: org.bank,
    owner: { name: org.owner_name, phone: org.owner_phone },
    wardenId: org.settings.wardenId ?? staff.find((s) => s.role === "warden")?.id ?? "",
    blocks: blocks.map((b) => ({ ...b, wardenId: b.wardenId ?? "" })) as Hostel["blocks"],
    rentByType: org.rent_by_type as Hostel["rentByType"], messFee: org.mess_fee, deposit: org.deposit, dueDay: org.due_day,
    now: nowISO(), today, months: lastMonths(currentMonth, 6),
  };
  setReferenceData({ hostel, rooms, staff, mess: (org.settings.mess ?? {}) as never });

  const seed = emptySeed();
  COLLS.forEach((c, i) => {
    (seed[c] as unknown[]) = (collRows[i] as Record<string, unknown>[]).map((r) => fromRow(c, r));
  });
  // newest first where the app expects it
  seed.complaints.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  seed.gate.sort((a, b) => b.at.localeCompare(a.at));
  seed.activity.sort((a, b) => b.at.localeCompare(a.at));
  seed.leaves.sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  seed.visitors.sort((a, b) => b.inAt.localeCompare(a.inAt));
  seed.notices.sort((a, b) => b.postedAt.localeCompare(a.postedAt));
  seed.whatsapp.sort((a, b) => (b.messages.at(-1)?.at ?? "").localeCompare(a.messages.at(-1)?.at ?? ""));
  seed.staffAttendance = Object.fromEntries(staff.map((s) => [s.id, s.attendance ?? {}]));
  refreshIndexes(seed.beds.length);

  // the story: which resident the apps show, the month being billed
  demo.currentMonth = currentMonth;
  demo.nextMonth = nextMonthOf(currentMonth);
  const current = seed.residents.filter((r) => r.status !== "checked_out");
  const pickResident = (pref: string) => (current.some((r) => r.id === pref) ? pref : current[0]?.id ?? "");
  demo.residentId = membership.residentId ?? pickResident("R-1042");
  demo.complainantId = pickResident("R-1107");
  const vacant = seed.beds.filter((b) => b.status === "vacant");
  if (!vacant.some((b) => b.id === demo.checkIn.suggestedBed)) demo.checkIn.suggestedBed = vacant[0]?.id ?? "";

  const prevRole = useDemo.getState().role;
  const views: Record<string, Role[]> = { owner: ["owner", "warden", "resident", "parent"], warden: ["warden", "resident", "parent"], resident: ["resident"], parent: ["parent"] };
  const role = orgId === id && views[membership.role].includes(prevRole) ? prevRole : membership.role;

  orgId = id;
  canWriteStaff = staffRole;
  since = serverNow;
  pending.clear();
  applyingRemote = true;
  useDemo.setState({ ...seed, role, hydrated: true, raisedMonths: [], flash: {}, lastEvent: null });
  applyingRemote = false;
  return org;
}

export function clearOrgData() {
  orgId = null;
  pending.clear();
  applyingRemote = true;
  useDemo.setState({ ...emptySeed(), hydrated: false, lastEvent: null, flash: {} });
  applyingRemote = false;
}

// ---------------------------------------------------------------------------
// Local changes -> database
// ---------------------------------------------------------------------------
function queue(coll: Coll | "staff", id: string) {
  pending.set(key(coll, id), { coll, id });
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(flush, 250);
  setSaving("saving");
}

function onStoreChange(state: Seed, prev: Seed) {
  if (applyingRemote || !orgId) return;
  for (const c of COLLS) {
    const next = state[c] as { id: string }[];
    const before = prev[c] as { id: string }[];
    if (next === before) continue;
    const old = new Map(before.map((x) => [x.id, x]));
    for (const item of next) if (old.get(item.id) !== item) queue(c, item.id);
  }
  if (state.staffAttendance !== prev.staffAttendance && canWriteStaff) {
    for (const [id, att] of Object.entries(state.staffAttendance)) if (prev.staffAttendance[id] !== att) queue("staff", id);
  }
}

async function flush() {
  flushTimer = null;
  const id = orgId;
  if (!id || !pending.size) return;
  const batch = [...pending.values()];
  pending.clear();
  const s = useDemo.getState();
  const byColl = new Map<Coll | "staff", Record<string, unknown>[]>();
  for (const { coll, id: itemId } of batch) {
    inflight.add(key(coll, itemId));
    let item: object | undefined;
    if (coll === "staff") {
      const base = staffList.find((x) => x.id === itemId);
      item = base ? { ...base, attendance: s.staffAttendance[itemId] ?? base.attendance } : undefined;
    } else item = (s[coll] as { id: string }[]).find((x) => x.id === itemId);
    if (!item) continue;
    if (!byColl.has(coll)) byColl.set(coll, []);
    byColl.get(coll)!.push(toRow(coll, item, id));
  }
  let failed = false;
  await Promise.all(
    [...byColl.entries()].map(async ([coll, rows]) => {
      const table = coll === "staff" ? "staff" : TABLE[coll];
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await neon().from(table).upsert(rows.slice(i, i + 500), { onConflict: "org_id,id" });
        if (error) {
          failed = true;
          console.warn(`[sync] ${table}: ${errorText(error)}`);
          // a row-level security refusal will not succeed on retry; anything else is retried
          if (!/row-level security|permission denied/i.test(errorText(error))) for (const r of rows.slice(i, i + 500)) pending.set(key(coll, r.id as string), { coll, id: r.id as string });
        }
      }
    })
  );
  for (const { coll, id: itemId } of batch) inflight.delete(key(coll, itemId));
  if (orgId !== id) return;
  if (pending.size) {
    flushTimer = setTimeout(flush, 3000);
    setSaving("error");
  } else setSaving(failed ? "error" : "saved");
}

/** Push anything not yet saved (before signing out or switching hostel). */
export async function flushNow() {
  if (flushTimer) clearTimeout(flushTimer);
  await flush();
}

// ---------------------------------------------------------------------------
// Database -> local, for changes made elsewhere
// ---------------------------------------------------------------------------
type Changes = { now: string; reload?: boolean; org_updated?: boolean } & Record<string, Record<string, unknown>[] | undefined>;

async function poll() {
  const id = orgId;
  if (!id || polling || (typeof document !== "undefined" && document.visibilityState === "hidden")) return;
  polling = true;
  try {
    const { data, error } = await neon().rpc("changes_since", { p_org: id, p_since: since });
    if (error || !data || orgId !== id) return;
    const ch = data as Changes;
    if (ch.reload) {
      const { useSession, openOrg } = await import("./session");
      if (useSession.getState().orgId === id) await openOrg(id, { force: true });
      return;
    }
    since = ch.now;
    merge(ch);
  } catch {
    /* offline for a moment; the next poll catches up */
  } finally {
    polling = false;
  }
}

function merge(ch: Changes) {
  const s = useDemo.getState();
  const patch: Partial<Seed> = {};
  const events: NonNullable<ReturnType<typeof useDemo.getState>["lastEvent"]>[] = [];
  const flash: Record<string, number> = {};
  for (const [table, rows] of Object.entries(ch)) {
    if (!Array.isArray(rows) || !rows.length) continue;
    if (table === "staff") continue;
    const coll = COLL_BY_TABLE[table];
    if (!coll) continue;
    let list = [...(s[coll] as { id: string }[])];
    let changed = false;
    for (const row of rows) {
      const item = fromRow<{ id: string }>(coll, row);
      if (pending.has(key(coll, item.id)) || inflight.has(key(coll, item.id))) continue;
      const idx = list.findIndex((x) => x.id === item.id);
      const local = idx >= 0 ? list[idx] : undefined;
      if (local && sameValue(local, item)) continue;
      changed = true;
      if (local) list[idx] = item;
      else list = PREPEND.includes(coll) ? [item, ...list] : [...list, item];
      // turn what happened elsewhere into the same toasts as local actions
      if (coll === "invoices") {
        const inv = item as unknown as Invoice;
        if (inv.status === "paid" && (local as Invoice | undefined)?.status === "unpaid") {
          events.push({ id: Date.now() + events.length, type: "payment", invoiceId: inv.id, residentId: inv.residentId, amount: inv.total, method: inv.method ?? "upi" });
          flash[inv.id] = Date.now();
        }
      } else if (coll === "complaints" && !local) {
        const c = item as unknown as Complaint;
        events.push({ id: Date.now() + events.length, type: "complaint", complaintId: c.id, channel: c.channel });
      } else if (coll === "leaves") {
        const lv = item as unknown as LeaveRequest;
        if (!local) events.push({ id: Date.now() + events.length, type: "leave_requested", leaveId: lv.id });
        else if ((local as LeaveRequest).status !== lv.status) events.push({ id: Date.now() + events.length, type: "leave", leaveId: lv.id, status: lv.status });
      } else if (coll === "gate" && !local) {
        const g = item as unknown as GateEvent;
        events.push({ id: Date.now() + events.length, type: "gate", residentId: g.residentId, direction: g.type });
      } else if (coll === "residents" && !local) {
        const r = item as unknown as Resident;
        events.push({ id: Date.now() + events.length, type: "checkin", residentId: r.id, bedId: r.bedId });
      }
    }
    if (changed) (patch as Record<string, unknown>)[coll] = list;
  }
  const staffRows = ch.staff;
  if (Array.isArray(staffRows) && staffRows.length && canWriteStaff) {
    const att = { ...s.staffAttendance };
    let changed = false;
    for (const row of staffRows) {
      const st = staffFromRow(row) as Staff;
      if (pending.has(key("staff", st.id)) || inflight.has(key("staff", st.id))) continue;
      if (!sameValue(att[st.id], st.attendance)) {
        att[st.id] = st.attendance;
        changed = true;
      }
    }
    if (changed) patch.staffAttendance = att;
  }
  if (!Object.keys(patch).length) return;
  applyingRemote = true;
  useDemo.setState({ ...patch, flash: { ...s.flash, ...flash }, ...(events.length ? { lastEvent: events[events.length - 1] } : {}) });
  applyingRemote = false;
}

export function startSync(id: string) {
  stopSync();
  orgId = id;
  unsubscribe = useDemo.subscribe((state, prev) => onStoreChange(state, prev));
  pollTimer = setInterval(poll, POLL_MS);
  if (typeof document !== "undefined") document.addEventListener("visibilitychange", poll);
}

export function stopSync() {
  unsubscribe?.();
  unsubscribe = null;
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
  if (typeof document !== "undefined") document.removeEventListener("visibilitychange", poll);
}

/** Owner: put the sample data back (the guided demo starts from here). */
export async function resetDemoData() {
  const id = orgId;
  if (!id) return;
  await flushNow();
  const { error } = await neon().rpc("reset_demo_data", { p_org: id });
  if (error) throw new Error(errorText(error));
  const { openOrg } = await import("./session");
  await openOrg(id, { force: true });
}
