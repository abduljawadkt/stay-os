"use client";
// The guided demo story. Each step can navigate, wait for an element, and drive the app.
import { useDemo } from "@/lib/store";
import { useUI } from "@/components/shell/ui-store";
import { useAsk } from "@/components/assistant/ask-store";
import { simulateWhatsAppComplaint } from "@/lib/demo-actions";
import { todayISO } from "@/lib/clock";
import { demo } from "@/config/demo";

export interface Step {
  id: string;
  route?: string;
  target?: string | (() => string | null);
  /** Runs once when the step opens (after the route and target are ready). */
  enter?: () => Promise<void> | void;
  /** Runs when the viewer presses Next/Do it, before moving on. */
  next?: () => Promise<void> | void;
  /** Label key for the primary button ("next" by default). */
  cta?: "next" | "doIt" | "pay" | "send" | "approve" | "finish";
  wide?: boolean;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function waitFor(selector: string, timeout = 6000, ready?: (el: HTMLElement) => boolean): Promise<HTMLElement | null> {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const el = document.querySelector<HTMLElement>(selector);
    if (el && (!ready || ready(el))) return el;
    await sleep(120);
  }
  return null;
}

async function click(selector: string, timeout = 6000) {
  const el = await waitFor(selector, timeout, (e) => !(e as HTMLButtonElement).disabled);
  el?.click();
  return !!el;
}

function setInput(selector: string, value: string) {
  const el = document.querySelector<HTMLInputElement>(selector);
  if (!el) return;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  setter.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

const anjaliInvoice = () => useDemo.getState().invoices.find((i) => i.residentId === demo.residentId && i.month === demo.currentMonth)?.id;
let newComplaintId: string | null = null;
const thread = (residentId: string, role: "resident" | "parent") => useDemo.getState().whatsapp.find((w) => w.residentId === residentId && w.role === role)?.id ?? null;

export const STEPS: Step[] = [
  { id: "welcome", route: "/dashboard/", cta: "next" },
  { id: "kpis", route: "/dashboard/", target: "[data-tour=kpis]" },
  { id: "attention", route: "/dashboard/", target: "[data-tour=attention]" },

  // New resident check-in
  { id: "checkin", route: "/dashboard/rooms/?block=C&floor=3", target: "[data-tour=checkin-button]", cta: "doIt", next: async () => { useUI.getState().openCheckIn(demo.checkIn.suggestedBed); await waitFor("[data-tour=checkin-dialog]"); } },
  { id: "details", target: "[data-tour=checkin-dialog]", next: async () => { await click("[data-tour=checkin-next0]"); await waitFor("[data-tour=kyc-start]"); } },
  { id: "digilocker", target: "[data-tour=checkin-dialog]", cta: "doIt", next: async () => { await click("[data-tour=kyc-start]"); await waitFor("[data-tour=checkin-next]", 8000, (e) => !(e as HTMLButtonElement).disabled); await sleep(900); } },
  { id: "verified", target: "[data-tour=checkin-dialog]", next: async () => { await click("[data-tour=checkin-next]"); await waitFor("[data-tour=bed-pick]"); } },
  { id: "bed", target: "[data-tour=checkin-dialog]", next: async () => { await click("[data-tour=checkin-next2]"); await waitFor("[data-tour=checkin-complete]"); } },
  { id: "confirm", target: "[data-tour=checkin-dialog]", cta: "doIt", next: async () => { await click("[data-tour=checkin-complete]"); await waitFor("[data-tour=checkin-floor]"); await sleep(600); } },
  { id: "floor", target: () => `#room-${demo.checkIn.suggestedBed.split("-").slice(0, 2).join("-")}`, enter: async () => { await click("[data-tour=checkin-floor]", 2000); } },

  // Month-end invoicing, reminders, UPI auto-reconciliation
  { id: "raise", route: "/dashboard/rent/", target: "[data-tour=raise-button]", cta: "doIt", next: async () => { await click("[data-tour=raise-button]"); await waitFor("[data-tour=raise-dialog]"); } },
  { id: "raiseConfirm", target: "[data-tour=raise-dialog]", cta: "doIt", next: async () => { await click("[data-tour=raise-confirm]"); await waitFor("[data-tour=raise-view]", 8000); await sleep(700); await click("[data-tour=raise-view]"); await sleep(400); } },
  { id: "raised", target: "[data-tour=rent-summary]" },
  { id: "remind", target: "[data-tour=remind-button]", cta: "doIt", next: async () => { await click("[data-tour=remind-button]"); await waitFor("[data-tour=remind-dialog]"); } },
  { id: "remindPreview", target: "[data-tour=remind-dialog]", cta: "send", next: async () => { await click("[data-tour=remind-send]"); await waitFor("[data-tour=wa-panel]"); useDemo.getState().openWhatsApp(thread(demo.residentId, "resident")); await sleep(500); } },
  { id: "waReminder", target: "[data-tour=wa-panel]" },
  {
    id: "upi",
    target: () => { const id = anjaliInvoice(); return id ? `[data-invoice="${id}"]` : null; },
    enter: async () => { useDemo.getState().closeWhatsApp(); await sleep(350); setInput("[data-tour=invoice-search]", "Anjali Menon"); await sleep(300); },
    cta: "pay",
    next: async () => { const id = anjaliInvoice(); if (id) useDemo.getState().payInvoice(id, { method: "upi", via: "whatsapp_link" }); await sleep(2200); },
  },
  { id: "receipt", target: "[data-tour=wa-panel]", enter: async () => { useDemo.getState().openWhatsApp(thread(demo.residentId, "resident")); await sleep(400); } },

  // Complaint over WhatsApp
  {
    id: "complaintIn",
    route: "/dashboard/complaints/",
    target: "[data-tour=wa-panel]",
    enter: async () => { await waitFor("[data-tour=kanban]"); const { complaintId, threadId } = simulateWhatsAppComplaint(); newComplaintId = complaintId; useDemo.getState().openWhatsApp(threadId ?? null); await sleep(500); },
  },
  { id: "complaintCard", target: () => (newComplaintId ? `[data-complaint="${newComplaintId}"]` : "[data-tour=col-new]"), enter: async () => { useDemo.getState().closeWhatsApp(); await sleep(400); } },
  { id: "complaintStart", target: "[data-tour=complaint-drawer]", enter: async () => { if (newComplaintId) await click(`[data-complaint="${newComplaintId}"]`); await waitFor("[data-tour=complaint-drawer]"); }, cta: "doIt", next: async () => { await click("[data-tour=complaint-start]"); await sleep(1200); } },
  { id: "complaintResolve", target: "[data-tour=complaint-drawer]", cta: "doIt", next: async () => { await click("[data-tour=complaint-resolve]"); await sleep(900); document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); await sleep(300); } },
  { id: "complaintWa", target: "[data-tour=wa-panel]", enter: async () => { useDemo.getState().openWhatsApp(thread(demo.complainantId, "resident")); await sleep(400); } },

  // Mess opt-out
  { id: "messSkip", route: "/resident/", target: "[data-tour=resident-menu]", enter: async () => { useDemo.getState().closeWhatsApp(); }, cta: "doIt", next: async () => { const s = useDemo.getState(); const today = todayISO(); const o = s.optOuts.find((x) => x.residentId === demo.residentId && x.date === today); if (!o?.meals.includes("dinner")) s.toggleOptOut(demo.residentId, today, "dinner"); await sleep(1100); } },
  { id: "headcount", route: "/dashboard/mess/", target: "[data-tour=headcount]" },
  { id: "waste", route: "/dashboard/mess/", target: "[data-tour=waste]" },

  // Ask StayOS in Malayalam
  { id: "ask", route: "/dashboard/", target: "[data-tour=ask-panel]", enter: async () => { useAsk.getState().ask("ഈ മാസം ആരൊക്കെ ഫീസ് അടയ്ക്കാനുണ്ട്?"); await waitFor("[data-tour=ask-answer]", 8000); await sleep(500); }, wide: true },
  { id: "done", cta: "finish", enter: () => { useDemo.getState().setAiOpen(false); } },
];
