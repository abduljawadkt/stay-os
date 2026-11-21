// Neon Auth, served from our own domain. Safari (and other browsers that block cross-site cookies) would
// drop a session cookie set by the neonauth.neon.tech domain, signing people out straight after sign-in.
// Forwarding the calls here makes that cookie first-party. Nothing is stored or changed on the way.
import type { NextRequest } from "next/server";

const UPSTREAM = (process.env.NEXT_PUBLIC_NEON_AUTH_URL ?? "").replace(/\/$/, "");
const FORWARD_REQUEST = ["content-type", "cookie", "origin", "user-agent", "authorization", "x-neon-client-info", "accept"];
const FORWARD_RESPONSE = ["content-type", "set-auth-jwt", "set-auth-token", "cache-control", "location"];

export const dynamic = "force-dynamic";

async function proxy(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const url = new URL(request.url);
  const target = `${UPSTREAM}/${path.map(encodeURIComponent).join("/")}${url.search}`;
  const headers = new Headers();
  for (const h of FORWARD_REQUEST) {
    const v = request.headers.get(h);
    if (v) headers.set(h, v);
  }
  if (!headers.has("origin")) headers.set("origin", url.origin);
  const res = await fetch(target, {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer(),
    redirect: "manual",
    cache: "no-store",
  });
  const out = new Headers();
  for (const h of FORWARD_RESPONSE) {
    const v = res.headers.get(h);
    if (v) out.set(h, v);
  }
  // cookies come back as ours: no Domain, so the browser keeps them for this site
  for (const c of res.headers.getSetCookie()) out.append("set-cookie", c.replace(/;\s*Domain=[^;]+/i, ""));
  return new Response(res.status === 204 || res.status === 304 ? null : await res.arrayBuffer(), { status: res.status, headers: out });
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE };
