"use client";

// Real WhatsApp, from one StayOS number (functions/whatsapp, a Neon Function next to the database).
// The app keeps writing messages into each conversation as before; after they are saved, it asks the function to send
// the new ones. The function decides what may go out (real hostels with WhatsApp switched on, phone numbers from the
// residents table), so nothing here can send to an arbitrary number.
import { neon, errorText } from "./neon";
import type { OrgRow } from "./session";

const BASE = (process.env.NEXT_PUBLIC_WHATSAPP_URL ?? "").replace(/\/$/, "");

export interface WhatsAppSettings { enabled: boolean; reminders: boolean; since?: string }
export const whatsappSettings = (org: OrgRow | null | undefined): WhatsAppSettings => {
  const w = (org?.settings as { whatsapp?: Partial<WhatsAppSettings> } | undefined)?.whatsapp;
  return { enabled: w?.enabled === true, reminders: w?.reminders !== false, since: w?.since };
};
/** Sample and demo hostels never send: their phone numbers are made up. */
export const canSendWhatsApp = (org: OrgRow | null | undefined) =>
  !!BASE && !!org && !org.is_demo && org.settings?.clock?.mode !== "demo" && whatsappSettings(org).enabled;

async function token() {
  const { data } = await neon().auth.getSession();
  return (data?.session as { token?: string } | undefined)?.token ?? "";
}
async function call<T>(path: string, init: { method?: "GET" | "POST"; body?: unknown } = {}): Promise<T> {
  if (!BASE) throw new Error("WhatsApp isn't set up on this site");
  const res = await fetch(`${BASE}${path}`, {
    method: init.method ?? (init.body ? "POST" : "GET"),
    headers: { authorization: `Bearer ${await token()}`, "content-type": "application/json" },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string; message?: string };
  if (!res.ok) throw new Error(data.message || errorText(data) || `WhatsApp returned ${res.status}`);
  return data;
}

let timer: ReturnType<typeof setTimeout> | null = null;
/** After conversations are saved: send the new template messages (batched over a couple of seconds). */
export function flushWhatsApp(org: OrgRow | null | undefined) {
  if (!canSendWhatsApp(org)) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    call("/flush", { body: { org: org!.id } }).catch((e) => console.warn("[whatsapp]", errorText(e)));
  }, 2000);
}

/** Is the StayOS WhatsApp number connected (keys set on the function)? */
export async function whatsappStatus(): Promise<{ available: boolean; configured: boolean }> {
  if (!BASE) return { available: false, configured: false };
  try {
    const r = await fetch(`${BASE}/health`).then((x) => x.json());
    return { available: true, configured: !!r.configured };
  } catch {
    return { available: false, configured: false };
  }
}

/** Owner: switch WhatsApp on or off for the hostel, and the 9 AM rent reminders. */
export async function setWhatsApp(orgId: string, enabled: boolean, reminders: boolean) {
  const { data, error } = await neon().rpc("set_whatsapp", { p_org: orgId, p_enabled: enabled, p_reminders: reminders });
  if (error) throw new Error(errorText(error));
  return data as WhatsAppSettings;
}

export interface OutboxRow {
  id: string; resident_id: string | null; role: string; to_phone: string; template: string;
  status: "pending" | "sent" | "delivered" | "read" | "failed" | "dry_run" | "skipped"; error: string | null; created_at: string;
}
/** Staff: the last messages StayOS sent for this hostel and whether they arrived. */
export async function recentOutbox(orgId: string, limit = 25): Promise<OutboxRow[]> {
  const { data } = await neon().from("wa_outbox").select("id,resident_id,role,to_phone,template,status,error,created_at").eq("org_id", orgId).order("created_at", { ascending: false }).limit(limit);
  return (data ?? []) as OutboxRow[];
}

export interface WhatsAppSetup {
  configured: boolean; phoneIdSet: boolean; tokenSet: boolean; appSecretSet: boolean; language: string;
  webhookUrl: string; verifyToken: string | null; templates: string[];
}
/** StayOS admins: what's configured, and the webhook details to paste into Meta. */
export const whatsappSetup = () => call<WhatsAppSetup>("/setup");
