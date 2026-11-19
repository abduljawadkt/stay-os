"use client";

import { createClient } from "@neon/neon-js";

// One Neon client per browser tab: Neon Auth (Better Auth) for sign-in, the Data API for rows.
// Only public URLs live here; the database connection string never reaches the browser.
const AUTH_URL = process.env.NEXT_PUBLIC_NEON_AUTH_URL ?? "";
const DATA_API_URL = process.env.NEXT_PUBLIC_NEON_DATA_API_URL ?? "";

export const neonConfigured = Boolean(AUTH_URL && DATA_API_URL);

type Client = ReturnType<typeof createClient>;
let client: Client | null = null;

export function neon(): Client {
  if (!neonConfigured) throw new Error("Neon is not configured: set NEXT_PUBLIC_NEON_AUTH_URL and NEXT_PUBLIC_NEON_DATA_API_URL");
  if (!client) client = createClient({ auth: { url: AUTH_URL }, dataApi: { url: DATA_API_URL } });
  return client;
}

/** Turns Better Auth and PostgREST errors into one readable sentence. */
export function errorText(e: unknown): string {
  if (!e) return "Something went wrong";
  if (typeof e === "string") return e;
  const o = e as { message?: string; error?: { message?: string }; details?: string };
  const msg = o.message || o.error?.message || o.details || "Something went wrong";
  return msg.replace(/^AuthApiError:\s*/, "");
}
