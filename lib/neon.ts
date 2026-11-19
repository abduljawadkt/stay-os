"use client";

import { createClient } from "@neon/neon-js";

// One Neon client per browser tab: Neon Auth (Better Auth) for sign-in, the Data API for rows.
// Only public URLs live here; the database connection string never reaches the browser.
const AUTH_URL = process.env.NEXT_PUBLIC_NEON_AUTH_URL ?? "";
const DATA_API_URL = process.env.NEXT_PUBLIC_NEON_DATA_API_URL ?? "";

export const neonConfigured = Boolean(AUTH_URL && DATA_API_URL);

type Client = ReturnType<typeof createClient>;
let client: Client | null = null;

/**
 * Inside the iOS app requests go through native HTTP (CapacitorHttp in capacitor.config.ts), which keeps
 * the session cookie out of WebKit's third-party cookie blocking. Native requests carry no Origin, and
 * Neon Auth only trusts http(s) origins, so they identify as localhost (allowed for this project).
 */
function patchNativeFetch() {
  if (typeof window === "undefined") return;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  if (!cap?.isNativePlatform?.()) return;
  const original = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.startsWith(AUTH_URL)) {
      const headers = new Headers(init.headers ?? (input instanceof Request ? input.headers : undefined));
      headers.set("Origin", "http://localhost");
      init = { ...init, headers };
    }
    return original(input, init);
  };
}

export function neon(): Client {
  if (!neonConfigured) throw new Error("Neon is not configured: set NEXT_PUBLIC_NEON_AUTH_URL and NEXT_PUBLIC_NEON_DATA_API_URL");
  if (!client) {
    patchNativeFetch();
    client = createClient({ auth: { url: AUTH_URL }, dataApi: { url: DATA_API_URL } });
  }
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
