"use client";

import { create } from "zustand";
import {
  emptySeed, hostel, type Seed, type Activity, type Bed, type Channel, type Complaint, type ComplaintCategory, type ComplaintStatus,
  type Expense, type Invoice, type LeaveRequest, type Meal, type Resident, type Visitor, type WAMessage, type WAThread,
} from "@/data";
import { nowISO, nowMs, todayISO } from "./clock";
import { roomById, rebates, daysInMonth, addDays, MEALS } from "./selectors";
import { demo } from "@/config/demo";

export type Role = "owner" | "warden" | "resident" | "parent";

/** Things that happened, for toasts and the live feed. UI turns them into words. */
export type DemoEvent =
  | { type: "payment"; invoiceId: string; residentId: string; amount: number; method: string }
  | { type: "invoices_raised"; month: string; count: number; amount: number }
  | { type: "reminders_sent"; count: number }
  | { type: "bed_moved"; residentId: string; from: string; to: string }
  | { type: "checkin"; residentId: string; bedId: string }
  | { type: "complaint"; complaintId: string; channel: Channel }
  | { type: "complaint_status"; complaintId: string; status: ComplaintStatus }
  | { type: "optout"; residentId: string; meal: Meal; date: string; on: boolean }
  | { type: "leave"; leaveId: string; status: LeaveRequest["status"] }
  | { type: "leave_requested"; leaveId: string }
  | { type: "expense"; expenseId: string }
  | { type: "gate"; residentId: string; direction: "in" | "out" }
  | { type: "reset" };

interface UIState {
  hydrated: boolean;
  role: Role;
  offline: boolean;
  waOpen: boolean;
  waThreadId: string | null;
  aiOpen: boolean;
  tourActive: boolean;
  flash: Record<string, number>;
  raisedMonths: string[];
  lastEvent: (DemoEvent & { id: number }) | null;
}

export interface CheckInInput {
  name: string;
  gender: "M" | "F";
  phone: string;
  dob: string;
  bloodGroup: string;
  hometown: string;
  occupation: "student" | "professional";
  institution: string;
  parent: Resident["parent"];
  aadhaarLast4: string;
  bedId: string;
  messPlan: boolean;
  sendWelcome: boolean;
}

interface Actions {
  setHydrated: () => void;
  setRole: (r: Role) => void;
  setOffline: (v: boolean) => void;
  openWhatsApp: (threadId?: string | null) => void;
  closeWhatsApp: () => void;
  setAiOpen: (v: boolean) => void;
  setTourActive: (v: boolean) => void;
  payInvoice: (invoiceId: string, opts?: { method?: "upi" | "cash" | "bank"; via?: Invoice["paidVia"] }) => void;
  raiseInvoices: (month: string) => number;
  sendReminders: (invoiceIds: string[]) => number;
  moveResident: (residentId: string, toBedId: string) => void;
  markBedReady: (bedId: string) => void;
  submitPolice: (residentId: string) => void;
  verifyKyc: (residentId: string) => void;
  checkIn: (input: CheckInInput) => string;
  addComplaint: (input: { residentId: string; category: ComplaintCategory; title: string; description: string; channel: Channel; photo?: string; text?: string }) => string;
  setComplaintStatus: (id: string, status: ComplaintStatus) => void;
  toggleOptOut: (residentId: string, date: string, meal: Meal, source?: "app" | "whatsapp") => boolean;
  requestLeave: (residentId: string, input: { from: string; to: string; reason: string; destination: string }) => string;
  decideLeave: (id: string, decision: "approved" | "rejected", via?: "app" | "whatsapp") => void;
  addExpense: (e: Omit<Expense, "id" | "status">) => string;
  scanGate: (residentId: string, direction: "in" | "out") => void;
  addVisitor: (v: Omit<Visitor, "id" | "inAt" | "outAt">) => void;
  setAttendance: (staffId: string, date: string, mark: "P" | "A" | "L" | "H" | "late") => void;
  checkoutVisitor: (id: string) => void;
  waSend: (threadId: string, text: string, from: "hostel" | "contact") => void;
  waRead: (threadId: string) => void;
  /** Owner: reload the sample data (resolves when the fresh data is in). */
  reset: () => Promise<void>;
}

export type DemoState = Seed & UIState & Actions;

const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
const utr = () => `${Math.floor(3000 + Math.random() * 4000)}${Math.floor(10000000 + Math.random() * 89999999)}`;
let evId = 0;

function initialUI(): UIState {
  return { hydrated: false, role: "owner", offline: false, waOpen: false, waThreadId: null, aiOpen: false, tourActive: false, flash: {}, raisedMonths: [], lastEvent: null };
}

/** Append a message to a resident's or parent's WhatsApp thread, creating the chat if needed. */
function waAppend(threads: WAThread[], residents: Resident[], residentId: string, role: "resident" | "parent", msg: Omit<WAMessage, "id">, unread = msg.from === "contact" ? 1 : 0): WAThread[] {
  const r = residents.find((x) => x.id === residentId);
  if (!r) return threads;
  const idx = threads.findIndex((t) => t.residentId === residentId && t.role === role);
  const message: WAMessage = { id: uid("m"), status: msg.from === "hostel" ? "delivered" : undefined, ...msg };
  if (idx === -1) {
    const t: WAThread = {
      id: uid("wa"), contactName: role === "resident" ? r.name : r.parent.name, role, residentId,
      phone: role === "resident" ? r.phone : r.parent.phone, unread, messages: [message],
    };
    return [t, ...threads];
  }
  const t = threads[idx];
  const updated = { ...t, unread: t.unread + unread, messages: [...t.messages, message] };
  return [updated, ...threads.slice(0, idx), ...threads.slice(idx + 1)];
}

const pushActivity = (list: Activity[], a: Omit<Activity, "id" | "at">): Activity[] => [{ id: uid("ACT"), at: nowISO(), ...a }, ...list].slice(0, 200);

const MONTH_NAME = (ym: string) => new Date(`${ym}-15T12:00:00+05:30`).toLocaleString("en-GB", { month: "long" });
const shortDate = (d: string) => new Date(`${d}T12:00:00+05:30`).toLocaleString("en-GB", { day: "numeric", month: "short" });

const CATEGORY_LABEL: Record<ComplaintCategory, string> = { electrical: "Electrical", plumbing: "Plumbing", wifi: "Wi-Fi", housekeeping: "Housekeeping", mess: "Mess", furniture: "Furniture", other: "Other" };
const SLA_HOURS: Record<ComplaintCategory, number> = { electrical: 4, plumbing: 6, wifi: 3, housekeeping: 8, mess: 12, furniture: 48, other: 24 };
const ASSIGNEE: Record<ComplaintCategory, string> = { electrical: "S-20", plumbing: "S-20", wifi: "S-03", housekeeping: "S-10", mess: "S-04", furniture: "S-20", other: "S-01" };
const ASSIGNEE_NAME: Record<string, string> = { "S-20": "Biju (electrician)", "S-03": "Nisha (office)", "S-10": "Shobha (housekeeping)", "S-04": "Kunhimoideen (head cook)", "S-01": "Ashraf (warden)" };

/** Reads a WhatsApp message the way the StayOS bot would: complaint, meal skip, leave reply, or payment link. */
export function classifyWhatsApp(text: string): { kind: "complaint"; category: ComplaintCategory; title: string } | { kind: "skip"; meal: Meal } | { kind: "approve" } | { kind: "reject" } | { kind: "pay" } | null {
  const t = text.toLowerCase();
  if (/^\s*(1|approve|yes|ok|അനുവദി\S*|ശരി)(\s|$|[.!,])/.test(t)) return { kind: "approve" };
  if (/^\s*(2|reject|no|വേണ്ട|നിരസി\S*)(\s|$|[.!,])/.test(t)) return { kind: "reject" };
  if (/(skip|cancel|venda|വേണ്ട|ഒഴിവാക്ക)/.test(t)) {
    const meal: Meal = /(breakfast|രാവിലെ|prathal)/.test(t) ? "breakfast" : /(lunch|ഉച്ച|uchakk)/.test(t) ? "lunch" : /(snack|tea|ചായ)/.test(t) ? "snacks" : "dinner";
    return { kind: "skip", meal };
  }
  if (/(pay|link|fee|rent|ഫീസ്|വാടക|ലിങ്ക്)/.test(t)) return { kind: "pay" };
  const rules: [RegExp, ComplaintCategory, string][] = [
    [/(fan|ഫാൻ|light|tubelight|bulb|switch|socket|plug|heater|geyser|current|power)/, "electrical", "Fan not working"],
    [/(tap|leak|flush|drain|water|shower|pipe|വെള്ളം|ടാപ്പ്|ചോർ)/, "plumbing", "Water leak in bathroom"],
    [/(wifi|wi-fi|internet|network|net |speed|വൈഫൈ)/, "wifi", "Wi-Fi not working"],
    [/(clean|dust|waste|smell|bathroom|വൃത്തി)/, "housekeeping", "Room needs cleaning"],
    [/(food|rice|curry|mess|breakfast|lunch|dinner|ഭക്ഷണം)/, "mess", "Mess food issue"],
    [/(chair|table|cupboard|lock|cot|mattress|door|key)/, "furniture", "Furniture repair"],
  ];
  for (const [re, category, title] of rules) {
    if (re.test(t)) {
      let ttl = title;
      if (category === "electrical") ttl = /(light|tubelight|bulb)/.test(t) ? "Light not working" : /(heater|geyser)/.test(t) ? "Water heater not heating" : /(switch|socket|plug)/.test(t) ? "Socket not working" : "Fan not working";
      return { kind: "complaint", category, title: ttl };
    }
  }
  return null;
}

/** Next number for ids like R-1043 or CMP-1044, starting at `start` in an empty hostel. */
const nextNum = (ids: string[], prefix: number, start: number) => ids.reduce((m, id) => Math.max(m, Number(id.slice(prefix)) || 0), start - 1) + 1;

export const useDemo = create<DemoState>()(
    (set, get) => ({
      ...emptySeed(),
      ...initialUI(),

      setHydrated: () => set({ hydrated: true }),
      setRole: (role) => {
        // remembered for this tab, so a reload (iPhone Safari reloads pages it put to sleep) keeps the view
        try {
          sessionStorage.setItem("stayos-view", role);
        } catch {}
        set({ role });
      },
      setOffline: (offline) => set({ offline }),
      openWhatsApp: (threadId = null) => set((s) => ({ waOpen: true, waThreadId: threadId ?? s.waThreadId })),
      closeWhatsApp: () => set({ waOpen: false }),
      setAiOpen: (aiOpen) => set({ aiOpen }),
      setTourActive: (tourActive) => set({ tourActive }),

      payInvoice: (invoiceId, opts = {}) => {
        const s = get();
        const inv = s.invoices.find((i) => i.id === invoiceId);
        if (!inv || inv.status === "paid") return;
        const method = opts.method ?? "upi";
        const ref = method === "upi" ? utr() : method === "bank" ? `FDRLH${Math.floor(10000000 + Math.random() * 89999999)}` : null;
        const at = nowISO();
        const invoices = s.invoices.map((i) => (i.id === invoiceId ? { ...i, status: "paid" as const, paidOn: at, method, utr: ref, paidVia: method === "upi" ? opts.via ?? "whatsapp_link" : null } : i));
        let whatsapp = waAppend(s.whatsapp, s.residents, inv.residentId, "resident", {
          from: "hostel", at, kind: "template", template: "receipt",
          data: { amount: inv.total, invoiceId: inv.id, utr: ref ?? "Cash", month: MONTH_NAME(inv.month) },
        });
        const r = s.residents.find((x) => x.id === inv.residentId)!;
        if (s.whatsapp.some((t) => t.residentId === r.id && t.role === "parent")) {
          whatsapp = waAppend(whatsapp, s.residents, r.id, "parent", { from: "hostel", at, kind: "template", template: "receipt", data: { amount: inv.total, invoiceId: inv.id, utr: ref ?? "Cash", month: MONTH_NAME(inv.month), child: r.name.split(" ")[0] } });
        }
        set({
          invoices, whatsapp,
          flash: { ...s.flash, [invoiceId]: Date.now() },
          activity: pushActivity(s.activity, { kind: "payment", residentId: inv.residentId, amount: inv.total, method, invoiceId }),
          lastEvent: { id: ++evId, type: "payment", invoiceId, residentId: inv.residentId, amount: inv.total, method },
        });
        // residents and parents can't write invoices: the server records (or refuses) their online payment
        if (method === "upi") import("./sync").then((m) => m.payOnline(invoiceId, opts.via ?? "app", at, inv));
      },

      raiseInvoices: (month) => {
        const s = get();
        if (s.raisedMonths.includes(month) || s.invoices.some((i) => i.month === month)) return 0;
        const prev = rebates(s.optOuts, demo.currentMonth);
        const rebateBy = new Map(prev.map((r) => [r.residentId, r]));
        const monthStart = `${month}-01`;
        let seq = 0;
        let amount = 0;
        const created: Invoice[] = [];
        for (const r of s.residents) {
          if (r.status === "checked_out") continue;
          if (r.checkOutDate && r.checkOutDate < monthStart) continue;
          const room = roomById[s.beds.find((b) => b.id === r.bedId)!.roomId];
          const lines: Invoice["lines"] = [{ kind: "rent", label: `Rent · ${room.type}`, amount: room.rent }];
          if (r.messPlan) lines.push({ kind: "mess", label: "Mess", amount: hostel.messFee });
          const rb = rebateBy.get(r.id);
          if (rb && r.messPlan) lines.push({ kind: "rebate", label: `Mess rebate · ${rb.days} days away in ${MONTH_NAME(demo.currentMonth)}`, amount: -rb.amount });
          const total = lines.reduce((a, l) => a + l.amount, 0);
          amount += total;
          seq++;
          created.push({
            id: `INV-${month.slice(2, 4)}${month.slice(5, 7)}-${String(seq).padStart(4, "0")}`, residentId: r.id, month, issuedOn: todayISO(),
            dueOn: `${month}-${String(hostel.dueDay).padStart(2, "0")}`, lines, total, status: "unpaid", paidOn: null, method: null, utr: null, paidVia: null, remindersSent: 0,
          });
        }
        let whatsapp = s.whatsapp;
        const at = nowISO();
        for (const inv of created) {
          if (!whatsapp.some((t) => t.residentId === inv.residentId && t.role === "resident")) continue;
          const r = s.residents.find((x) => x.id === inv.residentId)!;
          whatsapp = waAppend(whatsapp, s.residents, inv.residentId, "resident", { from: "hostel", at, kind: "template", template: "invoice", data: { name: r.name.split(" ")[0], month: MONTH_NAME(month), amount: inv.total, due: shortDate(inv.dueOn), invoiceId: inv.id } });
        }
        set({
          invoices: [...s.invoices, ...created], whatsapp,
          raisedMonths: [...s.raisedMonths, month],
          activity: pushActivity(s.activity, { kind: "invoices_raised", count: created.length, month, amount }),
          lastEvent: { id: ++evId, type: "invoices_raised", month, count: created.length, amount },
        });
        return created.length;
      },

      sendReminders: (invoiceIds) => {
        const s = get();
        const today = todayISO();
        const at = nowISO();
        let whatsapp = s.whatsapp;
        const ids = new Set(invoiceIds);
        const invoices = s.invoices.map((i) => (ids.has(i.id) ? { ...i, remindersSent: i.remindersSent + 1 } : i));
        for (const inv of s.invoices.filter((i) => ids.has(i.id))) {
          const r = s.residents.find((x) => x.id === inv.residentId)!;
          const days = Math.max(0, Math.round((new Date(`${today}T00:00:00+05:30`).getTime() - new Date(`${inv.dueOn}T00:00:00+05:30`).getTime()) / 86400000));
          whatsapp = waAppend(whatsapp, s.residents, r.id, "resident", { from: "hostel", at, kind: "template", template: "reminder_overdue", data: { name: r.name.split(" ")[0], amount: inv.total, days, invoiceId: inv.id } });
        }
        set({
          invoices, whatsapp,
          activity: pushActivity(s.activity, { kind: "reminders_sent", count: ids.size }),
          lastEvent: { id: ++evId, type: "reminders_sent", count: ids.size },
        });
        return ids.size;
      },

      moveResident: (residentId, toBedId) => {
        const s = get();
        const r = s.residents.find((x) => x.id === residentId);
        const to = s.beds.find((b) => b.id === toBedId);
        if (!r || !to || to.status !== "vacant") return;
        const from = r.bedId;
        const beds = s.beds.map((b): Bed => {
          if (b.id === from) return { ...b, status: "vacant", residentId: undefined };
          if (b.id === toBedId) return { ...b, status: "occupied", residentId };
          return b;
        });
        set({
          beds,
          residents: s.residents.map((x) => (x.id === residentId ? { ...x, bedId: toBedId } : x)),
          activity: pushActivity(s.activity, { kind: "bed_moved", residentId, fromBed: from, toBed: toBedId }),
          lastEvent: { id: ++evId, type: "bed_moved", residentId, from, to: toBedId },
        });
      },

      markBedReady: (bedId) =>
        set((s) => ({ beds: s.beds.map((b) => (b.id === bedId && b.status === "maintenance" ? { ...b, status: "vacant" as const, maintenanceNote: undefined } : b)) })),

      submitPolice: (residentId) =>
        set((s) => ({
          residents: s.residents.map((r) => (r.id === residentId ? { ...r, police: { status: "submitted" as const, refNo: `KP/KKD/TV/2026/${Math.floor(10000 + Math.random() * 89999)}`, submittedOn: todayISO() } } : r)),
        })),
      verifyKyc: (residentId) =>
        set((s) => ({ residents: s.residents.map((r) => (r.id === residentId ? { ...r, kyc: { ...r.kyc, status: "verified" as const, method: "digilocker" as const, verifiedOn: todayISO() } } : r)) })),

      checkIn: (input) => {
        const s = get();
        const id = `R-${nextNum(s.residents.map((r) => r.id), 2, 1001)}`;
        const today = todayISO();
        const r: Resident = {
          id, name: input.name, gender: input.gender, phone: input.phone, dob: input.dob, bloodGroup: input.bloodGroup, hometown: input.hometown,
          occupation: input.occupation, institution: input.institution, parent: input.parent, bedId: input.bedId, checkInDate: today, checkOutDate: null,
          status: "active", kyc: { status: "verified", method: "digilocker", aadhaarLast4: input.aadhaarLast4, verifiedOn: today },
          police: { status: "pending", refNo: null, submittedOn: null }, messPlan: input.messPlan, deposit: hostel.deposit,
        };
        const room = roomById[s.beds.find((b) => b.id === input.bedId)!.roomId];
        const ym = today.slice(0, 7);
        const dim = daysInMonth(ym);
        const days = dim - Number(today.slice(8)) + 1;
        const lines: Invoice["lines"] = [{ kind: "rent", label: `Rent · ${days} of ${dim} days`, amount: Math.round((room.rent * days) / dim / 10) * 10 }];
        if (input.messPlan) lines.push({ kind: "mess", label: `Mess · ${days} of ${dim} days`, amount: Math.round((hostel.messFee * days) / dim / 10) * 10 });
        lines.push({ kind: "deposit", label: "Security deposit (refundable)", amount: hostel.deposit });
        const seq = s.invoices.filter((i) => i.month === ym).length + 1;
        const inv: Invoice = {
          id: `INV-${ym.slice(2, 4)}${ym.slice(5, 7)}-${String(seq).padStart(4, "0")}`, residentId: id, month: ym, issuedOn: today, dueOn: addDays(today, 7),
          lines, total: lines.reduce((a, l) => a + l.amount, 0), status: "unpaid", paidOn: null, method: null, utr: null, paidVia: null, remindersSent: 0,
        };
        const residents = [...s.residents, r];
        let whatsapp = s.whatsapp;
        if (input.sendWelcome) {
          whatsapp = waAppend(whatsapp, residents, id, "resident", { from: "hostel", at: nowISO(), kind: "template", template: "welcome", data: { name: input.name.split(" ")[0], bed: input.bedId, amount: inv.total, invoiceId: inv.id } });
          whatsapp = waAppend(whatsapp, residents, id, "parent", { from: "hostel", at: nowISO(), kind: "template", template: "welcome", data: { name: input.name.split(" ")[0], bed: input.bedId, amount: inv.total, invoiceId: inv.id, parent: "1" } });
        }
        set({
          residents, whatsapp,
          beds: s.beds.map((b) => (b.id === input.bedId ? { ...b, status: "occupied", residentId: id, reservation: undefined } : b)),
          invoices: [...s.invoices, inv],
          activity: pushActivity(s.activity, { kind: "checkin", residentId: id, toBed: input.bedId }),
          lastEvent: { id: ++evId, type: "checkin", residentId: id, bedId: input.bedId },
        });
        return id;
      },

      addComplaint: ({ residentId, category, title, description, channel, photo, text }) => {
        const s = get();
        const r = s.residents.find((x) => x.id === residentId)!;
        const id = `CMP-${nextNum(s.complaints.map((c) => c.id), 4, 1001)}`;
        const at = nowISO();
        const c: Complaint = {
          id, residentId, roomId: s.beds.find((b) => b.id === r.bedId)!.roomId, category, title, description, channel, status: "new",
          priority: ["electrical", "plumbing", "wifi"].includes(category) ? "high" : "medium", createdAt: at, slaHours: SLA_HOURS[category],
          assignedTo: null, resolvedAt: null, rating: null, updates: [{ at, kind: "created", by: channel }], photo,
        };
        let whatsapp = s.whatsapp;
        if (channel === "whatsapp" && text) {
          whatsapp = waAppend(whatsapp, s.residents, residentId, "resident", { from: "contact", at, kind: photo ? "image" : "text", text, image: photo });
        }
        whatsapp = waAppend(whatsapp, s.residents, residentId, "resident", { from: "hostel", at, kind: "template", template: "complaint_ack", data: { id, category: CATEGORY_LABEL[category], room: c.roomId, sla: `${SLA_HOURS[category]} hours` } }, 0);
        set({
          complaints: [c, ...s.complaints], whatsapp,
          activity: pushActivity(s.activity, { kind: "complaint", residentId, complaintId: id, channel }),
          lastEvent: { id: ++evId, type: "complaint", complaintId: id, channel },
        });
        return id;
      },

      setComplaintStatus: (id, status) => {
        const s = get();
        const c = s.complaints.find((x) => x.id === id);
        if (!c || c.status === status) return;
        const at = nowISO();
        const assignee = c.assignedTo ?? ASSIGNEE[c.category];
        const updates = [...c.updates];
        if (status === "in_progress") {
          if (!c.assignedTo) updates.push({ at, kind: "assigned", by: assignee });
          updates.push({ at, kind: "on_the_way", by: assignee });
        }
        if (status === "resolved") updates.push({ at, kind: "resolved", by: assignee });
        const updated: Complaint = { ...c, status, assignedTo: status === "new" ? null : assignee, resolvedAt: status === "resolved" ? at : null, updates };
        let whatsapp = s.whatsapp;
        if (status !== "new") {
          whatsapp = waAppend(whatsapp, s.residents, c.residentId, "resident", {
            from: "hostel", at, kind: "template", template: status === "resolved" ? "complaint_resolved" : "complaint_update",
            data: { id, by: ASSIGNEE_NAME[assignee] ?? "our team", title: c.title },
          }, 0);
        }
        set({
          complaints: s.complaints.map((x) => (x.id === id ? updated : x)), whatsapp,
          activity: status === "resolved" ? pushActivity(s.activity, { kind: "complaint_resolved", residentId: c.residentId, complaintId: id }) : s.activity,
          lastEvent: { id: ++evId, type: "complaint_status", complaintId: id, status },
        });
      },

      toggleOptOut: (residentId, date, meal, source = "app") => {
        const s = get();
        const existing = s.optOuts.find((o) => o.residentId === residentId && o.date === date);
        let on: boolean;
        let optOuts;
        if (existing) {
          on = !existing.meals.includes(meal);
          const meals = on ? MEALS.filter((m) => existing.meals.includes(m) || m === meal) : existing.meals.filter((m) => m !== meal);
          optOuts = s.optOuts.map((o) => (o === existing ? { ...o, meals } : o));
        } else {
          on = true;
          optOuts = [...s.optOuts, { id: uid("OO"), residentId, date, meals: [meal], reason: source === "whatsapp" ? "Skipped on WhatsApp" : "Skipped in app", source, createdAt: nowISO() }];
        }
        set({
          optOuts,
          activity: on ? pushActivity(s.activity, { kind: "optout", residentId, meals: [meal] }) : s.activity,
          lastEvent: { id: ++evId, type: "optout", residentId, meal, date, on },
        });
        return on;
      },

      requestLeave: (residentId, input) => {
        const s = get();
        const id = `LV-${nextNum(s.leaves.map((l) => l.id), 3, 101)}`;
        const at = nowISO();
        const r = s.residents.find((x) => x.id === residentId)!;
        const lv: LeaveRequest = { id, residentId, ...input, status: "awaiting_parent", requestedAt: at, parentDecisionAt: null };
        const whatsapp = waAppend(s.whatsapp, s.residents, residentId, "parent", {
          from: "hostel", at, kind: "template", template: "leave_request",
          data: { child: r.name.split(" ")[0], from: input.from, to: input.to, destination: input.destination, reason: input.reason, leaveId: id },
        }, 0);
        set({
          leaves: [lv, ...s.leaves], whatsapp,
          activity: pushActivity(s.activity, { kind: "leave_request", residentId, leaveId: id }),
          lastEvent: { id: ++evId, type: "leave_requested", leaveId: id },
        });
        return id;
      },

      decideLeave: (id, decision, via = "app") => {
        const s = get();
        const lv = s.leaves.find((l) => l.id === id);
        if (!lv || lv.status !== "awaiting_parent") return;
        const at = nowISO();
        let whatsapp = s.whatsapp.map((t) =>
          t.residentId === lv.residentId && t.role === "parent"
            ? { ...t, messages: t.messages.map((m) => (m.template === "leave_request" && m.data?.leaveId === id ? { ...m, answered: decision, status: "read" as const } : m)) }
            : t
        );
        if (via === "whatsapp") whatsapp = waAppend(whatsapp, s.residents, lv.residentId, "parent", { from: "contact", at, kind: "text", text: decision === "approved" ? "Approve" : "Reject" }, 0);
        whatsapp = waAppend(whatsapp, s.residents, lv.residentId, "parent", { from: "hostel", at, kind: "template", template: "leave_decision", data: { decision, leaveId: id } }, 0);
        whatsapp = waAppend(whatsapp, s.residents, lv.residentId, "resident", { from: "hostel", at, kind: "template", template: "leave_decision", data: { decision, leaveId: id, resident: "1" } }, 0);
        // approved leave → meals skipped automatically while away
        let optOuts = s.optOuts;
        if (decision === "approved") {
          const r = s.residents.find((x) => x.id === lv.residentId)!;
          if (r.messPlan) {
            let d = lv.from.slice(0, 10);
            const end = lv.to.slice(0, 10);
            while (d <= end) {
              const fromH = d === lv.from.slice(0, 10) ? Number(lv.from.slice(11, 13)) : 0;
              const toH = d === end ? Number(lv.to.slice(11, 13)) : 24;
              const meals = MEALS.filter((m) => {
                const h = { breakfast: 8, lunch: 13, snacks: 17, dinner: 20 }[m];
                return h >= fromH && h < toH;
              });
              if (meals.length) {
                const day = d;
                const prev = optOuts.find((o) => o.residentId === r.id && o.date === day);
                optOuts = prev
                  ? optOuts.map((o) => (o === prev ? { ...o, meals, reason: lv.reason } : o))
                  : [...optOuts, { id: uid("OO"), residentId: r.id, date: day, meals, reason: lv.reason, source: "app" as const, createdAt: at }];
              }
              d = addDays(d, 1);
            }
          }
        }
        set({
          leaves: s.leaves.map((l) => (l.id === id ? { ...l, status: decision, parentDecisionAt: at } : l)), whatsapp, optOuts,
          activity: pushActivity(s.activity, { kind: decision === "approved" ? "leave_approved" : "leave_rejected", residentId: lv.residentId, leaveId: id }),
          lastEvent: { id: ++evId, type: "leave", leaveId: id, status: decision },
        });
      },

      addExpense: (e) => {
        const s = get();
        const id = `EXP-${String(nextNum(s.expenses.map((e) => e.id), 4, 1)).padStart(4, "0")}`;
        set({ expenses: [...s.expenses, { ...e, id, status: "paid" }], lastEvent: { id: ++evId, type: "expense", expenseId: id } });
        return id;
      },

      scanGate: (residentId, direction) => {
        const s = get();
        const at = nowISO();
        const r = s.residents.find((x) => x.id === residentId)!;
        const block = s.beds.find((b) => b.id === r.bedId)?.block;
        const [ch, cm] = (hostel.blocks.find((b) => b.id === block)?.curfew ?? "22:00").split(":").map(Number);
        const curfewMin = ch * 60 + cm;
        const mins = Number(at.slice(11, 13)) * 60 + Number(at.slice(14, 16));
        set({
          gate: [{ id: uid("G"), residentId, type: direction, at, method: "qr", late: direction === "in" && mins > curfewMin, passId: null }, ...s.gate],
          activity: pushActivity(s.activity, { kind: direction === "in" ? "gate_in" : "gate_out", residentId }),
          lastEvent: { id: ++evId, type: "gate", residentId, direction },
        });
      },

      addVisitor: (v) =>
        set((s) => ({
          visitors: [{ ...v, id: uid("V"), inAt: nowISO(), outAt: null }, ...s.visitors],
          activity: pushActivity(s.activity, { kind: "visitor", residentId: v.residentId, visitorName: v.name }),
        })),
      setAttendance: (staffId, date, mark) => set((s) => ({ staffAttendance: { ...s.staffAttendance, [staffId]: { ...s.staffAttendance[staffId], [date]: mark } } })),
      checkoutVisitor: (id) => set((s) => ({ visitors: s.visitors.map((v) => (v.id === id ? { ...v, outAt: nowISO() } : v)) })),

      waSend: (threadId, text, from) => {
        const s = get();
        const t = s.whatsapp.find((x) => x.id === threadId);
        if (!t || !text.trim()) return;
        const at = nowISO();
        const whatsapp = s.whatsapp.map((x) => (x.id === threadId ? { ...x, messages: [...x.messages, { id: uid("m"), from, at, kind: "text" as const, text, status: from === "hostel" ? ("delivered" as const) : undefined }] } : x));
        set({ whatsapp });
        if (from !== "contact") return;
        // the StayOS bot replies like it would in production
        const intent = classifyWhatsApp(text);
        if (!intent) return;
        setTimeout(() => {
          const st = get();
          if (intent.kind === "complaint" && t.role === "resident") {
            st.addComplaint({ residentId: t.residentId, category: intent.category, title: intent.title, description: text, channel: "whatsapp" });
          } else if (intent.kind === "skip" && t.role === "resident") {
            const today = todayISO();
            const existing = st.optOuts.find((o) => o.residentId === t.residentId && o.date === today);
            if (!existing?.meals.includes(intent.meal)) st.toggleOptOut(t.residentId, today, intent.meal, "whatsapp");
            set((cur) => ({ whatsapp: waAppend(cur.whatsapp, cur.residents, t.residentId, "resident", { from: "hostel", at: nowISO(), kind: "template", template: "optout_ack", data: { meal: intent.meal, date: shortDate(today) } }, 0) }));
          } else if ((intent.kind === "approve" || intent.kind === "reject") && t.role === "parent") {
            const pending = st.leaves.find((l) => l.residentId === t.residentId && l.status === "awaiting_parent");
            if (pending) st.decideLeave(pending.id, intent.kind === "approve" ? "approved" : "rejected", "app");
          } else if (intent.kind === "pay") {
            const inv = st.invoices.filter((i) => i.residentId === t.residentId && i.status === "unpaid").sort((a, b) => a.dueOn.localeCompare(b.dueOn))[0];
            if (inv) {
              const r = st.residents.find((x) => x.id === t.residentId)!;
              set((cur) => ({ whatsapp: waAppend(cur.whatsapp, cur.residents, t.residentId, t.role, { from: "hostel", at: nowISO(), kind: "template", template: "reminder_due", data: { name: r.name.split(" ")[0], amount: inv.total, invoiceId: inv.id } }, 0) }));
            }
          }
        }, 900);
      },

      waRead: (threadId) => set((s) => ({ whatsapp: s.whatsapp.map((t) => (t.id === threadId ? { ...t, unread: 0 } : t)) })),

      reset: async () => {
        const { resetDemoData } = await import("./sync");
        await resetDemoData();
        set({ waOpen: false, aiOpen: false, offline: false, lastEvent: { id: ++evId, type: "reset" } });
      },
    })
);

export const now = nowMs;
