"use client";
// Presenter shortcuts used by the Demo menu and the guided tour.
import { useDemo } from "./store";
import { todayISO } from "./clock";
import { overdueInvoices } from "./selectors";
import { demo } from "@/config/demo";

export function simulatePayment(opts: { excludePersona?: boolean } = { excludePersona: true }) {
  const s = useDemo.getState();
  const list = overdueInvoices(s.invoices, todayISO()).filter((i) => !opts.excludePersona || i.residentId !== demo.residentId);
  const inv = list[Math.floor(Math.random() * Math.min(list.length, 12))] ?? list[0];
  if (inv) s.payInvoice(inv.id, { method: "upi", via: "whatsapp_link" });
  return inv?.id;
}

export const COMPLAINT_TEXT = "Hi sir, B-108 il fan work aavunnilla since morning 😓 regulator um choodanu. Pls check";

export function simulateWhatsAppComplaint() {
  const s = useDemo.getState();
  const thread = s.whatsapp.find((t) => t.residentId === demo.complainantId && t.role === "resident");
  const id = s.addComplaint({
    residentId: demo.complainantId, category: "electrical", title: "Fan not working", description: COMPLAINT_TEXT, channel: "whatsapp", photo: "fan", text: COMPLAINT_TEXT,
  });
  return { complaintId: id, threadId: thread?.id ?? useDemo.getState().whatsapp.find((t) => t.residentId === demo.complainantId && t.role === "resident")?.id };
}

export function simulateGateScan() {
  const s = useDemo.getState();
  const active = s.residents.filter((r) => r.status !== "checked_out");
  const r = active[Math.floor(Math.random() * active.length)];
  const last = s.gate.find((g) => g.residentId === r.id);
  s.scanGate(r.id, last?.type === "out" ? "in" : "out");
}
