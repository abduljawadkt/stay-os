// StayOS payments: a Neon Function next to the database. No dependencies.
//
//   POST /connect     owner saves the hostel's Razorpay keys (checked with Razorpay, stored encrypted)
//   GET  /connection  staff: is Razorpay connected? owner also gets the webhook URL and secret to paste in Razorpay
//   POST /disconnect  owner removes the keys
//   POST /link        a resident, parent or staff member gets a Razorpay payment link for an unpaid invoice
//   POST /webhook/:org  Razorpay tells us a link was paid; we check its signature and mark the invoice paid
//
// Callers sign in with Neon Auth; their JWT (EdDSA) is verified against the auth service's public keys.
// Only the payment confirmation from Razorpay, never the browser, can mark an invoice paid.
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual, webcrypto } from "node:crypto";

const DB = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
const AUTH_URL = process.env.NEON_AUTH_URL;
const APP_URL = (process.env.APP_URL || "https://stayos.space").replace(/\/$/, "");
const PUBLIC_URL = (process.env.PUBLIC_URL || "").replace(/\/$/, "");
const ORIGINS = (process.env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
// Encryption key for stored Razorpay secrets: PAYMENTS_ENC_KEY (32 bytes, base64) if set, otherwise derived
// from the database password Neon injects. If that password is rotated, owners reconnect Razorpay once.
const ENC_KEY = process.env.PAYMENTS_ENC_KEY
  ? Buffer.from(process.env.PAYMENTS_ENC_KEY, "base64")
  : createHash("sha256").update(`stayos-payments-v1:${DB ? decodeURIComponent(new URL(DB).password) : ""}`).digest();
const RZP = "https://api.razorpay.com/v1";

class HttpError extends Error {
  constructor(status, code, message) {
    super(message || code);
    this.status = status;
    this.code = code;
  }
}

// ---------------------------------------------------------------- database (Neon SQL over HTTP)
async function sql(query, params = []) {
  const host = new URL(DB).hostname;
  const res = await fetch(`https://${host}/sql`, {
    method: "POST",
    headers: { "Neon-Connection-String": DB, "content-type": "application/json" },
    body: JSON.stringify({ query, params }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new HttpError(500, "database", body.message || "database error");
  return body.rows || [];
}

// ---------------------------------------------------------------- secrets at rest (AES-256-GCM)
function encrypt(text) {
  if (ENC_KEY.length !== 32) throw new HttpError(500, "config", "PAYMENTS_ENC_KEY is not set");
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", ENC_KEY, iv);
  const ct = Buffer.concat([c.update(text, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), ct].map((b) => b.toString("base64")).join(".");
}
function decrypt(blob) {
  const [iv, tag, ct] = blob.split(".").map((x) => Buffer.from(x, "base64"));
  const d = createDecipheriv("aes-256-gcm", ENC_KEY, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]).toString("utf8");
}

// ---------------------------------------------------------------- sign-in (Neon Auth JWT, EdDSA)
let jwks = null;
let jwksAt = 0;
async function publicKey(kid) {
  for (let attempt = 0; attempt < 2; attempt++) {
    if (!jwks || attempt === 1 || Date.now() - jwksAt > 3600_000) {
      const res = await fetch(`${AUTH_URL}/.well-known/jwks.json`);
      jwks = (await res.json()).keys || [];
      jwksAt = Date.now();
    }
    const k = jwks.find((x) => x.kid === kid);
    if (k) return webcrypto.subtle.importKey("jwk", { kty: k.kty, crv: k.crv, x: k.x }, { name: "Ed25519" }, false, ["verify"]);
  }
  throw new HttpError(401, "unauthorized", "Unknown signing key");
}
async function userId(request) {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const [h, p, s] = token.split(".");
  if (!h || !p || !s) throw new HttpError(401, "unauthorized", "Sign in first");
  const header = JSON.parse(Buffer.from(h, "base64url").toString());
  const payload = JSON.parse(Buffer.from(p, "base64url").toString());
  if (header.alg !== "EdDSA") throw new HttpError(401, "unauthorized", "Unexpected token");
  const key = await publicKey(header.kid);
  const ok = await webcrypto.subtle.verify({ name: "Ed25519" }, key, Buffer.from(s, "base64url"), Buffer.from(`${h}.${p}`));
  if (!ok) throw new HttpError(401, "unauthorized", "Invalid token");
  if (payload.exp && payload.exp * 1000 < Date.now()) throw new HttpError(401, "unauthorized", "Session expired, sign in again");
  if (!payload.sub) throw new HttpError(401, "unauthorized", "Invalid token");
  return String(payload.sub);
}
async function member(request, org) {
  const uid = await userId(request);
  if (!/^[0-9a-f-]{36}$/i.test(String(org || ""))) throw new HttpError(400, "bad_request", "Unknown hostel");
  const [m] = await sql("select role, resident_id from public.members where org_id = $1 and user_id = $2", [org, uid]);
  if (!m) throw new HttpError(403, "forbidden", "You are not a member of this hostel");
  return { uid, role: m.role, residentId: m.resident_id, staff: m.role === "owner" || m.role === "warden" };
}

// ---------------------------------------------------------------- Razorpay
async function razorpay(keyId, keySecret, path, init = {}) {
  const res = await fetch(`${RZP}${path}`, {
    ...init,
    headers: { authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`, "content-type": "application/json" },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body.error?.description || `Razorpay returned ${res.status}`;
    throw new HttpError(res.status === 401 ? 400 : 502, res.status === 401 ? "bad_keys" : "razorpay", msg);
  }
  return body;
}
async function settings(org) {
  const [s] = await sql("select key_id, key_secret_enc, webhook_secret_enc, mode from public.payment_settings where org_id = $1", [org]);
  if (!s) return null;
  try {
    return { keyId: s.key_id, keySecret: decrypt(s.key_secret_enc), webhookSecret: decrypt(s.webhook_secret_enc), mode: s.mode };
  } catch {
    throw new HttpError(409, "reconnect", "Reconnect Razorpay in Settings → Payments");
  }
}
const webhookUrl = (request, org) => `${PUBLIC_URL || new URL(request.url).origin}/webhook/${org}`;

// ---------------------------------------------------------------- routes
async function connect(request) {
  const { org, keyId, keySecret } = await request.json();
  const m = await member(request, org);
  if (m.role !== "owner") throw new HttpError(403, "forbidden", "Only the owner can connect payments");
  const match = /^rzp_(test|live)_[A-Za-z0-9]{8,32}$/.exec(String(keyId || "").trim());
  if (!match || !keySecret || String(keySecret).length < 10) throw new HttpError(400, "bad_keys", "Enter the Key ID (starts with rzp_test_ or rzp_live_) and the Key Secret");
  const id = match[0];
  await razorpay(id, String(keySecret).trim(), "/payment_links?count=1"); // throws if the keys are wrong
  const existing = await settings(org).catch(() => null);
  const webhookSecret = existing?.webhookSecret || randomBytes(24).toString("base64url");
  await sql(
    `insert into public.payment_settings (org_id, key_id, key_secret_enc, webhook_secret_enc, mode, connected_by)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (org_id) do update set key_id = excluded.key_id, key_secret_enc = excluded.key_secret_enc,
       webhook_secret_enc = excluded.webhook_secret_enc, mode = excluded.mode, connected_by = excluded.connected_by, connected_at = now()`,
    [org, id, encrypt(String(keySecret).trim()), encrypt(webhookSecret), match[1], m.uid]
  );
  await sql(`update public.orgs set settings = settings || jsonb_build_object('payments', jsonb_build_object('provider', 'razorpay', 'mode', $2::text, 'key_hint', $3::text)) where id = $1`, [org, match[1], id.slice(-4)]);
  return { connected: true, mode: match[1], keyHint: id.slice(-4), webhookUrl: webhookUrl(request, org), webhookSecret };
}

async function connection(request) {
  const org = new URL(request.url).searchParams.get("org");
  const m = await member(request, org);
  if (!m.staff) throw new HttpError(403, "forbidden", "Staff only");
  const s = await settings(org);
  if (!s) return { connected: false };
  const out = { connected: true, mode: s.mode, keyHint: s.keyId.slice(-4) };
  return m.role === "owner" ? { ...out, webhookUrl: webhookUrl(request, org), webhookSecret: s.webhookSecret } : out;
}

async function disconnect(request) {
  const { org } = await request.json();
  const m = await member(request, org);
  if (m.role !== "owner") throw new HttpError(403, "forbidden", "Only the owner can disconnect payments");
  await sql("delete from public.payment_settings where org_id = $1", [org]);
  await sql("update public.orgs set settings = settings - 'payments' where id = $1", [org]);
  return { connected: false };
}

async function link(request) {
  const { org, invoice, via = "app", base = "/resident" } = await request.json();
  const m = await member(request, org);
  const [inv] = await sql(
    `select i.id, i.resident_id, i.month, i.total, i.status, r.name, r.phone, o.name as hostel
     from public.invoices i join public.residents r on r.org_id = i.org_id and r.id = i.resident_id join public.orgs o on o.id = i.org_id
     where i.org_id = $1 and i.id = $2`,
    [org, invoice]
  );
  if (!inv) throw new HttpError(404, "not_found", "Invoice not found");
  if (!m.staff && inv.resident_id !== m.residentId) throw new HttpError(403, "forbidden", "Not your invoice");
  if (inv.status !== "unpaid") throw new HttpError(409, "already_paid", "This invoice is already paid");
  const s = await settings(org);
  if (!s) throw new HttpError(409, "not_connected", "Online payment isn't connected for this hostel yet");

  const [open] = await sql(
    "select url from public.payments where org_id = $1 and invoice_id = $2 and status = 'created' and created_at > now() - interval '20 hours' order by created_at desc limit 1",
    [org, invoice]
  );
  if (open) return { url: open.url, reused: true };

  const phone = String(inv.phone || "").replace(/[^\d+]/g, "");
  const back = base === "/parent" ? "/parent" : "/resident";
  const body = {
    amount: Number(inv.total) * 100,
    currency: "INR",
    accept_partial: false,
    description: `${inv.hostel} · rent ${inv.month} · ${inv.id}`.slice(0, 2048),
    reference_id: `${inv.id}-${Date.now().toString(36)}`.slice(0, 40),
    customer: { name: inv.name, ...(/^\+?\d{10,13}$/.test(phone) ? { contact: phone } : {}) },
    notify: { sms: false, email: false },
    reminder_enable: false,
    notes: { org, invoice: inv.id },
    callback_url: `${APP_URL}${back}/pay/?invoice=${encodeURIComponent(inv.id)}&paid=1`,
    callback_method: "get",
    expire_by: Math.floor(Date.now() / 1000) + 24 * 3600,
  };
  const pl = await razorpay(s.keyId, s.keySecret, "/payment_links", { method: "POST", body: JSON.stringify(body) });
  await sql(
    "insert into public.payments (org_id, id, invoice_id, url, amount, via, created_by) values ($1, $2, $3, $4, $5, $6, $7)",
    [org, pl.id, inv.id, pl.short_url, Number(inv.total), ["app", "whatsapp_link", "qr"].includes(via) ? via : "app", m.uid]
  );
  return { url: pl.short_url, reused: false };
}

async function webhook(request, org) {
  const raw = await request.text();
  if (!/^[0-9a-f-]{36}$/i.test(org)) throw new HttpError(404, "not_found", "Unknown hostel");
  const s = await settings(org);
  if (!s) throw new HttpError(404, "not_connected", "Payments not connected");
  const given = request.headers.get("x-razorpay-signature") || "";
  const expected = createHmac("sha256", s.webhookSecret).update(raw).digest("hex");
  if (given.length !== expected.length || !timingSafeEqual(Buffer.from(given), Buffer.from(expected))) throw new HttpError(400, "bad_signature", "Signature mismatch");

  const event = JSON.parse(raw);
  const pl = event.payload?.payment_link?.entity;
  const pay = event.payload?.payment?.entity;
  if (!pl?.id) return { ok: true, ignored: event.event };
  if (event.event === "payment_link.expired" || event.event === "payment_link.cancelled") {
    await sql("update public.payments set status = $3 where org_id = $1 and id = $2 and status = 'created'", [org, pl.id, event.event.split(".")[1]]);
    return { ok: true };
  }
  if (event.event !== "payment_link.paid") return { ok: true, ignored: event.event };

  const reference = pay?.acquirer_data?.rrn || pay?.acquirer_data?.upi_transaction_id || pay?.id || pl.id;
  const method = pay?.method === "upi" ? "upi" : "bank";
  const [p] = await sql(
    `update public.payments set status = 'paid', paid_at = now(), provider_payment_id = $3, method = $4, reference = $5
     where org_id = $1 and id = $2 returning invoice_id, via, amount`,
    [org, pl.id, pay?.id || null, pay?.method || null, reference]
  );
  const invoiceId = p?.invoice_id || pl.notes?.invoice;
  if (!invoiceId) return { ok: true, ignored: "unknown link" };
  const [due] = await sql("select total from public.invoices where org_id = $1 and id = $2", [org, invoiceId]);
  if (!due) return { ok: true, ignored: "unknown invoice" };
  if (Number(pl.amount_paid ?? pay?.amount ?? 0) < Number(due.total) * 100) throw new HttpError(400, "amount_mismatch", "Paid amount is lower than the invoice");
  const [inv] = await sql(
    `update public.invoices set status = 'paid', paid_on = now(), method = $3, utr = $4, paid_via = $5
     where org_id = $1 and id = $2 and status = 'unpaid' returning resident_id, total`,
    [org, invoiceId, method, String(reference).slice(0, 40), p?.via || "app"]
  );
  if (inv) {
    await sql(
      "insert into public.activity (org_id, id, at, kind, data) values ($1, $2, now(), 'payment', $3::jsonb) on conflict do nothing",
      [org, `ACT-${randomBytes(4).toString("hex").toUpperCase()}`, JSON.stringify({ residentId: inv.resident_id, amount: Number(inv.total), method, invoiceId })]
    );
  }
  return { ok: true, invoice: invoiceId, marked: !!inv };
}

// ---------------------------------------------------------------- HTTP
function cors(request) {
  const origin = request.headers.get("origin") || "";
  const allowed = ORIGINS.includes(origin) || /^https?:\/\/localhost(:\d+)?$/.test(origin) || origin === "capacitor://localhost";
  return allowed
    ? { "access-control-allow-origin": origin, "access-control-allow-headers": "authorization, content-type", "access-control-allow-methods": "GET, POST, OPTIONS", vary: "origin" }
    : {};
}
const json = (request, status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...cors(request) } });

export default async function handler(request) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(request) });
  const { pathname } = new URL(request.url);
  try {
    if (request.method === "GET" && (pathname === "/" || pathname === "/health")) return json(request, 200, { ok: true, service: "stayos-payments" });
    if (request.method === "POST" && pathname === "/connect") return json(request, 200, await connect(request));
    if (request.method === "GET" && pathname === "/connection") return json(request, 200, await connection(request));
    if (request.method === "POST" && pathname === "/disconnect") return json(request, 200, await disconnect(request));
    if (request.method === "POST" && pathname === "/link") return json(request, 200, await link(request));
    const wh = /^\/webhook\/([^/]+)\/?$/.exec(pathname);
    if (request.method === "POST" && wh) return json(request, 200, await webhook(request, wh[1]));
    return json(request, 404, { error: "not_found" });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    if (status === 500) console.error("[payments]", e);
    return json(request, status, { error: e.code || "error", message: status === 500 && !(e instanceof HttpError) ? "Something went wrong" : e.message });
  }
}
