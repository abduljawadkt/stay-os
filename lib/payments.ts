"use client";

// Talks to the payments function (functions/payments, a Neon Function next to the database).
// It holds each hostel's Razorpay keys and is the only thing that can mark an invoice paid online.
import { neon, errorText } from "./neon";
import type { OrgRow } from "./session";

const BASE = (process.env.NEXT_PUBLIC_PAYMENTS_URL ?? "").replace(/\/$/, "");
export const paymentsAvailable = Boolean(BASE);

/** The hostel has connected Razorpay (set by the payments function). */
export const razorpayConnected = (org: OrgRow | null | undefined) =>
  (org?.settings as { payments?: { provider?: string } } | undefined)?.payments?.provider === "razorpay";
export const razorpayMode = (org: OrgRow | null | undefined) =>
  (org?.settings as { payments?: { mode?: "test" | "live" } } | undefined)?.payments?.mode ?? "test";

async function token() {
  const { data } = await neon().auth.getSession();
  return (data?.session as { token?: string } | undefined)?.token ?? "";
}

async function call<T>(path: string, init: { method?: "GET" | "POST"; body?: unknown } = {}): Promise<T> {
  if (!BASE) throw new Error("Payments aren't set up on this site");
  const res = await fetch(`${BASE}${path}`, {
    method: init.method ?? (init.body ? "POST" : "GET"),
    headers: { authorization: `Bearer ${await token()}`, "content-type": "application/json" },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string; message?: string };
  if (!res.ok) {
    const err = new Error(data.message || errorText(data) || `Payments returned ${res.status}`) as Error & { code?: string };
    err.code = data.error;
    throw err;
  }
  return data;
}

export interface Connection {
  connected: boolean;
  mode?: "test" | "live";
  keyHint?: string;
  webhookUrl?: string;
  webhookSecret?: string;
}

export const getConnection = (org: string) => call<Connection>(`/connection?org=${encodeURIComponent(org)}`);
export const connectRazorpay = (org: string, keyId: string, keySecret: string) => call<Connection>("/connect", { body: { org, keyId, keySecret } });
export const disconnectRazorpay = (org: string) => call<Connection>("/disconnect", { body: { org } });
/** A Razorpay payment link for an unpaid invoice (reused for 20 hours). */
export const createPayLink = (org: string, invoice: string, opts: { via?: "app" | "whatsapp_link" | "qr"; base?: "/resident" | "/parent" } = {}) =>
  call<{ url: string; reused: boolean }>("/link", { body: { org, invoice, via: opts.via ?? "app", base: opts.base ?? "/resident" } });
