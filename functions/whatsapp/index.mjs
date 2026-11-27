// StayOS WhatsApp: real messages from one StayOS number (Meta WhatsApp Cloud API). A Neon Function, no dependencies.
//
//   POST /flush          the app, after it writes messages: send this hostel's new template messages (any member)
//   POST /cron/daily     the 9 AM schedule: rent due-today and overdue reminders for hostels that want them, then send
//   GET  /webhook        Meta checks the webhook (verify token)
//   POST /webhook        Meta reports delivery (sent, delivered, read, failed) and replies; Approve/Reject decides leave
//   GET  /setup          StayOS admins: is it configured, the webhook URL and verify token, the templates to create
//   GET  /health
//
// Without WA_TOKEN and WA_PHONE_ID it runs dry: every message is logged in public.wa_outbox as 'dry_run', nothing is sent.
// Only real hostels whose owner switched WhatsApp on are sent to, and only messages written after that. Phone numbers
// come from the residents table, never from the conversation (residents can edit those), so a resident can't make
// StayOS message anyone else. Template words come from the database where they matter (amounts, due dates).
import { createHmac, randomBytes, timingSafeEqual, webcrypto } from "node:crypto";

const DB = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
const AUTH_URL = process.env.NEON_AUTH_URL;
const APP_URL = (process.env.APP_URL || "https://stayos.space").replace(/\/$/, "");
const PUBLIC_URL = (process.env.PUBLIC_URL || "").replace(/\/$/, "");
const ORIGINS = (process.env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
const TOKEN = process.env.WA_TOKEN || "";
const PHONE_ID = process.env.WA_PHONE_ID || "";
const APP_SECRET = process.env.WA_APP_SECRET || "";
const VERIFY_TOKEN = process.env.WA_VERIFY_TOKEN || "";
const LANG = process.env.WA_LANG || "en";
const GRAPH = (process.env.WA_GRAPH_URL || "https://graph.facebook.com/v21.0").replace(/\/$/, "");
const CONFIGURED = !!(TOKEN && PHONE_ID);

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

// ---------------------------------------------------------------- sign-in (Neon Auth JWT, EdDSA)
let jwks = null;
let jwksAt = 0;
async function publicKey(kid) {
  for (let attempt = 0; attempt < 2; attempt++) {
    if (!jwks || attempt === 1 || Date.now() - jwksAt > 3600_000) {
      jwks = (await (await fetch(`${AUTH_URL}/.well-known/jwks.json`)).json()).keys || [];
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
  const ok = await webcrypto.subtle.verify({ name: "Ed25519" }, await publicKey(header.kid), Buffer.from(s, "base64url"), Buffer.from(`${h}.${p}`));
  if (!ok) throw new HttpError(401, "unauthorized", "Invalid token");
  if (payload.exp && payload.exp * 1000 < Date.now()) throw new HttpError(401, "unauthorized", "Session expired, sign in again");
  if (!payload.sub) throw new HttpError(401, "unauthorized", "Invalid token");
  return String(payload.sub);
}
async function member(request, org) {
  const uid = await userId(request);
  if (!/^[0-9a-f-]{36}$/i.test(String(org || ""))) throw new HttpError(400, "bad_request", "Unknown hostel");
  const [m] = await sql("select role from public.members where org_id = $1 and user_id = $2", [org, uid]);
  if (!m) throw new HttpError(403, "forbidden", "You are not a member of this hostel");
  return { uid, role: m.role };
}

// ---------------------------------------------------------------- helpers
const uid = (p) => `${p}-${randomBytes(4).toString("hex").toUpperCase()}`;
/** E.164 digits for Meta: "+91 98765 43210" → "919876543210"; a bare 10-digit Indian number gets 91. */
function phone(raw) {
  const d = String(raw || "").replace(/\D/g, "");
  if (d.length === 10) return `91${d}`;
  if (d.length === 11 && d.startsWith("0")) return `91${d.slice(1)}`;
  return d.length >= 11 && d.length <= 15 ? d : "";
}
/** Meta refuses template values with new lines, tabs or long runs of spaces. */
const clean = (v, max = 60) => String(v ?? "").replace(/[\n\t\r]+/g, " ").replace(/ {2,}/g, " ").trim().slice(0, max) || "-";
const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const day = (iso) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }) : "-");
const when = (iso) => (iso ? new Date(iso).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }) : "-");
const time = (iso) => (iso ? new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }) : "-");
const payUrl = (invoiceId) => `${APP_URL}/resident/pay/?invoice=${encodeURIComponent(invoiceId)}`;

/** A hostel that may send: real (not sample or demo), active, and its owner switched WhatsApp on. */
async function hostel(org) {
  const [o] = await sql(
    `select id, name, city, settings -> 'whatsapp' as wa, app.org_active(id) as active,
       is_demo or is_template or coalesce(settings -> 'clock' ->> 'mode', 'real') = 'demo' as sample
     from public.orgs where id = $1`,
    [org]
  );
  if (!o || o.sample || !o.active || o.wa?.enabled !== true) return null;
  return { id: o.id, name: o.name, city: o.city, since: o.wa.since ? new Date(o.wa.since).getTime() : Date.now(), reminders: o.wa.reminders !== false };
}

// ---------------------------------------------------------------- templates (create these in Meta, see docs/whatsapp-setup.md)
// Each turns one message the app wrote into the Meta template's {{1}}, {{2}}… values.
const TEMPLATES = {
  invoice: { name: "stayos_rent_invoice", params: (c) => [c.name, c.month, c.hostel, inr(c.invoice?.total ?? c.d.amount), day(c.invoice?.due_on ?? c.d.due), c.d.invoiceId, payUrl(c.d.invoiceId)] },
  reminder_due: { name: "stayos_rent_due", params: (c) => [c.name, c.hostel, inr(c.invoice?.total ?? c.d.amount), c.d.invoiceId, day(c.invoice?.due_on), payUrl(c.d.invoiceId)] },
  reminder_overdue: { name: "stayos_rent_overdue", params: (c) => [c.name, inr(c.invoice?.total ?? c.d.amount), c.hostel, String(c.d.days ?? ""), c.d.invoiceId, payUrl(c.d.invoiceId)] },
  receipt: { name: "stayos_payment_receipt", params: (c) => [c.hostel, inr(c.invoice?.total ?? c.d.amount), c.d.month, c.d.invoiceId, c.invoice?.utr ?? c.d.utr] },
  complaint_ack: { name: "stayos_complaint_received", params: (c) => [c.hostel, c.d.id, c.d.category, c.d.room, c.d.sla] },
  complaint_update: { name: "stayos_complaint_update", params: (c) => [c.hostel, c.d.id, c.d.by, c.d.title] },
  complaint_resolved: { name: "stayos_complaint_resolved", params: (c) => [c.hostel, c.d.id] },
  leave_request: {
    name: "stayos_leave_request",
    params: (c) => [c.hostel, c.child, when(c.leave?.from ?? c.d.from), when(c.leave?.to ?? c.d.to), c.leave?.destination ?? c.d.destination, c.leave?.reason ?? c.d.reason],
    buttons: (c) => c.leave && c.leave.status === "awaiting_parent" ? [`L|${c.org}|${c.leave.id}|approved`, `L|${c.org}|${c.leave.id}|rejected`] : null,
  },
  leave_decision: { name: "stayos_leave_decision", params: (c) => [c.hostel, c.child, c.d.decision === "approved" ? "approved" : "not approved"] },
  gate_in: { name: "stayos_gate_update", params: (c) => [c.hostel, c.child, "entered the hostel", c.d.time ?? time(c.msg.at)] },
  gate_out: { name: "stayos_gate_update", params: (c) => [c.hostel, c.child, "left the hostel", c.d.time ?? time(c.msg.at)] },
  welcome: {
    name: (c) => (c.role === "parent" ? "stayos_welcome_parent" : "stayos_welcome"),
    params: (c) => (c.role === "parent" ? [c.hostel, c.child, c.d.bed] : [c.hostel, c.name, c.d.bed]),
  },
};

async function compose(org, h, thread, msg) {
  const t = TEMPLATES[msg.template];
  if (!t) return null;
  const [r] = await sql("select id, name, phone, parent from public.residents where org_id = $1 and id = $2", [org, thread.resident_id]);
  if (!r) return null;
  const to = phone(thread.role === "parent" ? r.parent?.phone : r.phone);
  if (!to) return { skip: "no phone number" };
  const d = msg.data || {};
  const c = { org, d, msg, role: thread.role, hostel: h.name, child: r.name.split(" ")[0], name: (thread.role === "parent" ? r.parent?.name || "" : r.name).split(" ")[0] || "there", month: d.month };
  if (d.invoiceId) [c.invoice] = await sql("select id, total, due_on, utr, month from public.invoices where org_id = $1 and id = $2", [org, d.invoiceId]);
  if (c.invoice && !c.month) c.month = c.invoice.month;
  if (d.leaveId) [c.leave] = await sql(`select id, "from", "to", destination, reason, status from public.leaves where org_id = $1 and id = $2`, [org, d.leaveId]);
  return {
    to,
    template: typeof t.name === "function" ? t.name(c) : t.name,
    params: t.params(c).map((v) => clean(v, 90)),
    buttons: t.buttons ? t.buttons(c) : null,
  };
}

/**
 * A reply the office typed in the inbox. WhatsApp only allows free text within 24 hours of the person's last message
 * (after that only approved templates), so older conversations are marked as not sent, with the reason.
 */
async function composeReply(org, thread, msg) {
  const [r] = await sql("select phone, parent from public.residents where org_id = $1 and id = $2", [org, thread.resident_id]);
  if (!r) return null;
  const to = phone(thread.role === "parent" ? r.parent?.phone : r.phone);
  if (!to) return { template: "text", params: [clean(msg.text, 4000)], skip: "no phone number" };
  const at = new Date(msg.at).getTime();
  const lastIn = Math.max(0, ...(thread.messages || []).filter((x) => x.from === "contact" && new Date(x.at).getTime() <= at).map((x) => new Date(x.at).getTime()));
  const open = lastIn > 0 && at - lastIn < 24 * 3600 * 1000;
  return { to, template: "text", params: [String(msg.text).slice(0, 4000)], skip: open ? null : "they haven't written in the last 24 hours, so WhatsApp allows only ready-made templates" };
}

async function deliver(row) {
  if (!CONFIGURED) {
    await sql("update public.wa_outbox set status = 'dry_run', sent_at = now() where org_id = $1 and id = $2", [row.org_id, row.id]);
    return "dry_run";
  }
  let message;
  if (row.template === "text") message = { type: "text", text: { body: row.params[0], preview_url: false } };
  else {
    const components = [{ type: "body", parameters: row.params.map((text) => ({ type: "text", text })) }];
    for (const [i, payload] of (row.buttons || []).entries()) components.push({ type: "button", sub_type: "quick_reply", index: String(i), parameters: [{ type: "payload", payload }] });
    message = { type: "template", template: { name: row.template, language: { code: LANG }, components } };
  }
  const res = await fetch(`${GRAPH}/${PHONE_ID}/messages`, {
    method: "POST",
    headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: row.to_phone, ...message }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = clean(body.error?.error_data?.details || body.error?.message || `Meta returned ${res.status}`, 300);
    await sql("update public.wa_outbox set status = 'failed', error = $3 where org_id = $1 and id = $2", [row.org_id, row.id, err]);
    return "failed";
  }
  await sql("update public.wa_outbox set status = 'sent', wamid = $3, sent_at = now() where org_id = $1 and id = $2", [row.org_id, row.id, body.messages?.[0]?.id || null]);
  return "sent";
}

/** Send this hostel's template messages written since WhatsApp was switched on and not sent yet. */
async function flushOrg(org) {
  const h = await hostel(org);
  if (!h) return { sent: 0, skipped: "WhatsApp is off for this hostel" };
  const threads = await sql("select id, role, resident_id, messages from public.wa_threads where org_id = $1", [org]);
  const done = new Set((await sql("select thread_id || '/' || message_id as k from public.wa_outbox where org_id = $1 and message_id is not null", [org])).map((x) => x.k));
  const out = { sent: 0, dry_run: 0, failed: 0, skipped: 0 };
  let budget = 40;
  for (const th of threads) {
    for (const msg of th.messages || []) {
      if (budget <= 0) break;
      const reply = msg.kind === "text" && !!msg.text;
      if (msg.from !== "hostel" || !msg.id || (!reply && (msg.kind !== "template" || !TEMPLATES[msg.template]))) continue;
      if (new Date(msg.at).getTime() < h.since || done.has(`${th.id}/${msg.id}`)) continue;
      budget--;
      const m = reply ? await composeReply(org, th, msg) : await compose(org, h, th, msg);
      if (!m) continue;
      const id = uid("WA");
      const [row] = await sql(
        `insert into public.wa_outbox (org_id, id, thread_id, message_id, resident_id, role, to_phone, template, params, status, error)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11) on conflict do nothing returning *`,
        [org, id, th.id, msg.id, th.resident_id, th.role, m.to || "", m.template || msg.template, JSON.stringify(m.params || []), m.skip ? "skipped" : "pending", m.skip || null]
      );
      if (!row || m.skip) { out.skipped += m.skip ? 1 : 0; continue; }
      out[await deliver({ ...row, buttons: m.buttons })]++;
    }
  }
  return out;
}

/** Add a hostel message to a resident's or parent's conversation (creating it), the way the app does. */
async function appendMessage(org, residentId, role, msg, unread = 0) {
  const [r] = await sql("select name, phone, parent from public.residents where org_id = $1 and id = $2", [org, residentId]);
  if (!r) return;
  const [th] = await sql("select id, messages from public.wa_threads where org_id = $1 and resident_id = $2 and role = $3 limit 1", [org, residentId, role]);
  if (th) {
    if ((th.messages || []).some((m) => m.id === msg.id)) return;
    await sql("update public.wa_threads set messages = messages || $3::jsonb, unread = unread + $4 where org_id = $1 and id = $2", [org, th.id, JSON.stringify([msg]), unread]);
  } else {
    await sql(
      "insert into public.wa_threads (org_id, id, contact_name, role, resident_id, phone, unread, messages) values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)",
      [org, uid("wa"), role === "parent" ? r.parent?.name || "Parent" : r.name, role, residentId, role === "parent" ? r.parent?.phone || "" : r.phone, unread, JSON.stringify([msg])]
    );
  }
}

// ---------------------------------------------------------------- the 9 AM job
async function daily() {
  const orgs = await sql(`select id from public.orgs where (settings -> 'whatsapp' ->> 'enabled')::boolean and not is_demo and not is_template`);
  const report = [];
  // anyone can call this URL, so reminders never go out at night: only between 9 AM and 8 PM in India
  const [{ today, hour }] = await sql("select (now() at time zone 'Asia/Kolkata')::date::text as today, extract(hour from now() at time zone 'Asia/Kolkata')::int as hour");
  const daytime = hour >= 9 && hour < 20;
  for (const { id: org } of orgs) {
    const h = await hostel(org);
    if (!h) continue;
    if (h.reminders && daytime) {
      const due = await sql(
        `select i.id, i.resident_id, i.total, i.due_on, (($2::date) - i.due_on) as late from public.invoices i
         join public.residents r on r.org_id = i.org_id and r.id = i.resident_id and r.status <> 'checked_out'
         where i.org_id = $1 and i.status = 'unpaid' and (i.due_on = $2::date or ($2::date - i.due_on) in (1, 4, 7, 14, 21, 30))`,
        [org, today]
      );
      for (const inv of due) {
        const late = Number(inv.late);
        const at = new Date().toISOString();
        const msg = late <= 0
          ? { id: `wa-due-${inv.id}-${today}`, from: "hostel", at, kind: "template", template: "reminder_due", data: { amount: Number(inv.total), invoiceId: inv.id } }
          : { id: `wa-late-${inv.id}-${today}`, from: "hostel", at, kind: "template", template: "reminder_overdue", data: { amount: Number(inv.total), days: late, invoiceId: inv.id } };
        await appendMessage(org, inv.resident_id, "resident", msg);
      }
      report.push({ org, reminders: due.length });
    }
    report.push({ org, ...(await flushOrg(org)) });
  }
  return { ok: true, hostels: orgs.length, reminders: daytime ? "sent" : "only between 9 AM and 8 PM IST", report };
}

// ---------------------------------------------------------------- Meta webhook
function signed(raw, header) {
  if (!APP_SECRET) return false;
  const want = Buffer.from(`sha256=${createHmac("sha256", APP_SECRET).update(raw).digest("hex")}`);
  const got = Buffer.from(String(header || ""));
  return want.length === got.length && timingSafeEqual(want, got);
}

/** Approve or Reject tapped on a leave request: only the resident's own parent's number counts. */
async function leaveReply(from, payload) {
  const [, org, leaveId, decision] = String(payload).split("|");
  if (!org || !leaveId || !["approved", "rejected"].includes(decision)) return "ignored";
  if (!(await hostel(org))) return "ignored";
  const [lv] = await sql(
    `select l.id, l.resident_id, l."from", l."to", l.status, r.parent, r.mess_plan from public.leaves l
     join public.residents r on r.org_id = l.org_id and r.id = l.resident_id where l.org_id = $1 and l.id = $2`,
    [org, leaveId]
  );
  if (!lv || phone(lv.parent?.phone) !== phone(from)) return "not the parent";
  if (lv.status !== "awaiting_parent") return "already decided";
  await sql("update public.leaves set status = $3, parent_decision_at = now() where org_id = $1 and id = $2 and status = 'awaiting_parent'", [org, leaveId, decision]);
  const at = new Date().toISOString();
  await appendMessage(org, lv.resident_id, "parent", { id: uid("m"), from: "contact", at, kind: "text", text: decision === "approved" ? "Approve" : "Reject" });
  await appendMessage(org, lv.resident_id, "parent", { id: uid("m"), from: "hostel", at, kind: "template", template: "leave_decision", data: { decision, leaveId } });
  await appendMessage(org, lv.resident_id, "resident", { id: uid("m"), from: "hostel", at, kind: "template", template: "leave_decision", data: { decision, leaveId, resident: "1" } });
  await sql("insert into public.activity (org_id, id, at, kind, data) values ($1, $2, now(), $3, $4::jsonb)",
    [org, uid("ACT"), decision === "approved" ? "leave_approved" : "leave_rejected", JSON.stringify({ residentId: lv.resident_id, leaveId, via: "whatsapp" })]);
  // approved leave → the meals while away are skipped, as when the parent approves in the app
  if (decision === "approved" && lv.mess_plan) {
    const hour = { breakfast: 8, lunch: 13, snacks: 17, dinner: 20 };
    const ist = (iso) => new Date(new Date(iso).getTime() + 330 * 60000).toISOString();
    const from = ist(lv.from), to = ist(lv.to);
    for (let d = from.slice(0, 10); d <= to.slice(0, 10); d = new Date(Date.parse(`${d}T12:00:00Z`) + 86400000).toISOString().slice(0, 10)) {
      const fromH = d === from.slice(0, 10) ? Number(from.slice(11, 13)) : 0;
      const toH = d === to.slice(0, 10) ? Number(to.slice(11, 13)) : 24;
      const meals = Object.keys(hour).filter((m) => hour[m] >= fromH && hour[m] < toH);
      if (!meals.length) continue;
      const [prev] = await sql("select id, meals from public.meal_optouts where org_id = $1 and resident_id = $2 and date = $3", [org, lv.resident_id, d]);
      // arrays go over HTTP as JSON and become text[] in the database
      if (prev) await sql("update public.meal_optouts set meals = array(select jsonb_array_elements_text($3::jsonb)), reason = 'On leave' where org_id = $1 and id = $2",
        [org, prev.id, JSON.stringify([...new Set([...(prev.meals || []), ...meals])])]);
      else await sql("insert into public.meal_optouts (org_id, id, resident_id, date, meals, reason, source) values ($1, $2, $3, $4, array(select jsonb_array_elements_text($5::jsonb)), 'On leave', 'whatsapp')",
        [org, uid("OO"), lv.resident_id, d, JSON.stringify(meals)]);
    }
  }
  await flushOrg(org);
  return decision;
}

/** Any other message: shown in the hostel's WhatsApp inbox for the staff to answer. */
async function inbound(from, text) {
  const who = await sql(
    `select r.org_id, r.id, case when regexp_replace(r.phone, '\\D', '', 'g') like '%' || right($1, 10) then 'resident' else 'parent' end as role
     from public.residents r join public.orgs o on o.id = r.org_id
     where (o.settings -> 'whatsapp' ->> 'enabled')::boolean and not o.is_demo and r.status <> 'checked_out'
       and (right(regexp_replace(r.phone, '\\D', '', 'g'), 10) = right($1, 10) or right(regexp_replace(coalesce(r.parent ->> 'phone', ''), '\\D', '', 'g'), 10) = right($1, 10))`,
    [from]
  );
  for (const w of who) {
    if (!(await hostel(w.org_id))) continue;
    await appendMessage(w.org_id, w.id, w.role, { id: uid("m"), from: "contact", at: new Date().toISOString(), kind: "text", text: clean(text, 1000) }, 1);
  }
  return who.length;
}

async function webhook(request) {
  const raw = await request.text();
  if (!signed(raw, request.headers.get("x-hub-signature-256"))) throw new HttpError(401, "bad_signature", "Signature check failed");
  const body = JSON.parse(raw || "{}");
  for (const entry of body.entry || []) for (const change of entry.changes || []) {
    const v = change.value || {};
    for (const st of v.statuses || []) {
      const status = ["sent", "delivered", "read", "failed"].includes(st.status) ? st.status : null;
      // Meta can report out of order: never go back from read to delivered, or from delivered to sent
      const rank = "case $X when 'sent' then 1 when 'delivered' then 2 when 'read' then 3 else 0 end";
      if (status) await sql(
        `update public.wa_outbox set status = $2, error = $3 where wamid = $1 and ($2 = 'failed' or ${rank.replace("$X", "status")} < ${rank.replace("$X", "$2")})`,
        [st.id, status, st.errors?.[0]?.title ? clean(st.errors[0].title, 300) : null]
      );
    }
    for (const m of v.messages || []) {
      if (m.type === "button" && m.button?.payload) await leaveReply(m.from, m.button.payload);
      else if (m.type === "interactive" && m.interactive?.button_reply?.id) await leaveReply(m.from, m.interactive.button_reply.id);
      else if (m.type === "text") await inbound(m.from, m.text?.body || "");
    }
  }
  return { ok: true };
}

// ---------------------------------------------------------------- StayOS admin: setup details
async function setup(request) {
  const id = await userId(request);
  const [a] = await sql(
    `select exists (select 1 from public.platform_admins pa join neon_auth."user" u on lower(u.email) = lower(pa.email) where u.id::text = $1 and u."emailVerified") as ok`,
    [id]
  );
  if (!a?.ok) throw new HttpError(403, "forbidden", "StayOS admins only");
  const base = PUBLIC_URL || new URL(request.url).origin;
  return {
    configured: CONFIGURED, phoneIdSet: !!PHONE_ID, tokenSet: !!TOKEN, appSecretSet: !!APP_SECRET, language: LANG,
    webhookUrl: `${base}/webhook`, verifyToken: VERIFY_TOKEN || null,
    templates: [...new Set(Object.values(TEMPLATES).flatMap((t) => (typeof t.name === "function" ? ["stayos_welcome", "stayos_welcome_parent"] : [t.name])))],
  };
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
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, "") || "/";
  try {
    if (request.method === "GET" && (path === "/" || path === "/health")) return json(request, 200, { ok: true, service: "stayos-whatsapp", configured: CONFIGURED });
    if (request.method === "GET" && path === "/webhook") {
      const ok = VERIFY_TOKEN && url.searchParams.get("hub.mode") === "subscribe" && url.searchParams.get("hub.verify_token") === VERIFY_TOKEN;
      return ok ? new Response(url.searchParams.get("hub.challenge") || "", { status: 200 }) : new Response("forbidden", { status: 403 });
    }
    if (request.method === "POST" && path === "/webhook") return json(request, 200, await webhook(request));
    if (request.method === "POST" && path === "/flush") {
      const { org } = await request.json();
      await member(request, org);
      return json(request, 200, await flushOrg(org));
    }
    // the schedule calls this; it is safe to call more often: each reminder goes once a day, each message once
    if ((request.method === "POST" || request.method === "GET") && path === "/cron/daily") return json(request, 200, await daily());
    if (request.method === "GET" && path === "/setup") return json(request, 200, await setup(request));
    return json(request, 404, { error: "not_found" });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    if (status === 500) console.error("[whatsapp]", e);
    return json(request, status, { error: e.code || "error", message: status === 500 && !(e instanceof HttpError) ? "Something went wrong" : e.message });
  }
}
