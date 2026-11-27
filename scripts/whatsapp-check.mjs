// End-to-end check of functions/whatsapp against the real database and real Neon Auth sign-ins.
// Only Meta is faked (its API answers locally), so no WhatsApp keys are needed and nothing is really sent.
// It uses a temporary real hostel owned by the demo owner, removed at the end.
//   npm run whatsapp:check
import { createHmac } from "node:crypto";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local", quiet: true });

const AUTH = process.env.NEXT_PUBLIC_NEON_AUTH_URL;
const API = process.env.NEXT_PUBLIC_NEON_DATA_API_URL;
const DEMO = "00000000-0000-0000-0000-0000000000d0";
const ORG = "00000000-0000-0000-0000-0000000a7e57";
const SECRET = "check-app-secret";
Object.assign(process.env, {
  NEON_AUTH_URL: AUTH, APP_URL: "https://stayos.space", PUBLIC_URL: "https://wa.example.test",
  WA_TOKEN: "check-token", WA_PHONE_ID: "100000000000001", WA_APP_SECRET: SECRET, WA_VERIFY_TOKEN: "check-verify", WA_GRAPH_URL: "https://graph.example.test/v21.0",
});

// fake Meta, real everything else
const realFetch = globalThis.fetch;
const sent = [];
globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === "string" ? input : input.url;
  if (url.startsWith("https://graph.example.test/")) {
    const body = JSON.parse(init.body);
    sent.push(body);
    if (body.template?.name === "stayos_complaint_resolved") return Response.json({ error: { message: "Template name does not exist in the translation" } }, { status: 404 });
    return Response.json({ messages: [{ id: `wamid.check${sent.length}` }] });
  }
  return realFetch(input, init);
};
const { default: handler } = await import("../functions/whatsapp/index.mjs");

async function token(email) {
  const r = await realFetch(`${AUTH}/sign-in/email`, { method: "POST", headers: { origin: "http://localhost:3000", "content-type": "application/json" }, body: JSON.stringify({ email, password: "stayos-demo-2026" }) });
  const cookie = r.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  return (await realFetch(`${AUTH}/get-session`, { headers: { origin: "http://localhost:3000", cookie } })).headers.get("set-auth-jwt");
}
const call = async (path, { jwt, body, method = body ? "POST" : "GET", headers = {} } = {}) => {
  const res = await handler(new Request(`https://wa.example.test${path}`, {
    method, headers: { "content-type": "application/json", ...(jwt ? { authorization: `Bearer ${jwt}` } : {}), ...headers }, body: typeof body === "string" ? body : body ? JSON.stringify(body) : undefined,
  }));
  const text = await res.text();
  let data = text;
  try { data = JSON.parse(text); } catch { /* the webhook check answers plain text */ }
  return { status: res.status, data };
};
const rpc = async (jwt, fn, args) => {
  const r = await realFetch(`${API}/rpc/${fn}`, { method: "POST", headers: { authorization: `Bearer ${jwt}`, "content-type": "application/json" }, body: JSON.stringify(args) });
  return { status: r.status, data: await r.json().catch(() => null) };
};
const hook = (payload, sign = true) => {
  const raw = JSON.stringify(payload);
  return call("/webhook", { body: raw, headers: sign ? { "x-hub-signature-256": `sha256=${createHmac("sha256", SECRET).update(raw).digest("hex")}` } : {} });
};
const fromMeta = (value) => ({ object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages", value: { messaging_product: "whatsapp", ...value } }] }] });

const { default: pg } = await import("pg");
const db = new pg.Client({ connectionString: process.env.DATABASE_URL?.replace("sslmode=require", "sslmode=verify-full") });
await db.connect();
const q = async (text, params = []) => (await db.query(text, params)).rows;

let failures = 0;
const expect = (label, ok, extra = "") => { if (!ok) failures++; console.log(`${ok ? "ok  " : "FAIL"} ${label}${ok ? "" : `  ${extra}`}`); };

// numbers no real resident has: 6 + 9 random digits
const num = () => `6${String(Math.floor(Math.random() * 1e9)).padStart(9, "0")}`;
const RES_PHONE = num(), PARENT_PHONE = num(), STRANGER = num();
const thread = async (role) => (await q("select id, unread, messages from public.wa_threads where org_id = $1 and resident_id = 'R-1' and role = $2", [ORG, role]))[0];
const outbox = () => q("select * from public.wa_outbox where org_id = $1 order by created_at", [ORG]);
const addMsg = (role, msg) => q("update public.wa_threads set messages = messages || $3::jsonb where org_id = $1 and resident_id = 'R-1' and role = $2", [ORG, role, JSON.stringify([msg])]);
const at = (minutes = 0) => new Date(Date.now() + minutes * 60000).toISOString();

const owner = await token("owner@demo.stayos.space");
const resident = await token("anjali@demo.stayos.space");
const ownerId = (await q(`select id::text from neon_auth."user" where email = 'owner@demo.stayos.space'`))[0].id;

try {
  await q("delete from public.orgs where id = $1", [ORG]);
  await q(`insert into public.orgs (id, name, city, subscription_status, trial_ends_at) values ($1, 'Check Hostel', 'Kozhikode', 'trialing', now() + interval '10 days')`, [ORG]);
  await q(`insert into public.members (org_id, user_id, role, name, email) values ($1, $2, 'owner', 'Check', 'owner@demo.stayos.space')`, [ORG, ownerId]);
  await q(`insert into public.rooms (org_id, id, block, floor, number, type, rent, capacity, bath) values ($1, 'X-101', 'X', 1, 101, 'single', 5000, 1, 'attached')`, [ORG]);
  await q(`insert into public.beds (org_id, id, room_id, block, floor, label, status, resident_id) values ($1, 'X-101-A', 'X-101', 'X', 1, 'A', 'occupied', 'R-1')`, [ORG]);
  await q(`insert into public.residents (org_id, id, name, gender, phone, parent, bed_id, check_in_date, status, mess_plan) values ($1, 'R-1', 'Arjun Nair', 'M', $2, $3::jsonb, 'X-101-A', current_date, 'active', true)`,
    [ORG, `+91 ${RES_PHONE.slice(0, 5)} ${RES_PHONE.slice(5)}`, JSON.stringify({ name: "Suresh Nair", relation: "Father", phone: PARENT_PHONE })]);
  const welcome = { id: "m-w1", from: "hostel", at: at(), kind: "template", template: "welcome", data: { name: "Arjun", bed: "X-101-A" } };
  await q(`insert into public.wa_threads (org_id, id, contact_name, role, resident_id, phone, unread, messages) values ($1, 'wa-r', 'Arjun Nair', 'resident', 'R-1', $2, 0, $3::jsonb)`, [ORG, RES_PHONE, JSON.stringify([welcome])]);
  await q(`insert into public.wa_threads (org_id, id, contact_name, role, resident_id, phone, unread, messages) values ($1, 'wa-p', 'Suresh Nair', 'parent', 'R-1', $2, 0, '[]'::jsonb)`, [ORG, PARENT_PHONE]);

  // ---- access
  expect("health says configured", (await call("/health")).data.configured === true);
  expect("webhook check with the right token", (await call("/webhook?hub.mode=subscribe&hub.verify_token=check-verify&hub.challenge=42")).data === 42);
  expect("webhook check with a wrong token is refused", (await call("/webhook?hub.mode=subscribe&hub.verify_token=nope&hub.challenge=42")).status === 403);
  expect("sending needs sign-in", (await call("/flush", { body: { org: ORG } })).status === 401);
  expect("someone from another hostel can't send for this one", (await call("/flush", { jwt: resident, body: { org: ORG } })).status === 403);
  expect("setup details are for StayOS admins only", (await call("/setup", { jwt: owner })).status === 403);

  // ---- off until the owner switches it on
  let r = await call("/flush", { jwt: owner, body: { org: ORG } });
  expect("nothing is sent while WhatsApp is off", sent.length === 0 && /off/.test(r.data.skipped ?? ""), JSON.stringify(r.data));
  expect("a resident can't switch WhatsApp on", (await rpc(resident, "set_whatsapp", { p_org: ORG, p_enabled: true })).status >= 400);
  expect("the sample hostel can't switch WhatsApp on", (await rpc(owner, "set_whatsapp", { p_org: DEMO, p_enabled: true })).status >= 400);
  r = await rpc(owner, "set_whatsapp", { p_org: ORG, p_enabled: true, p_reminders: true });
  expect("the owner switches WhatsApp on", r.status === 200 && r.data?.enabled === true, JSON.stringify(r.data));
  r = await call("/flush", { jwt: owner, body: { org: ORG } });
  expect("messages from before it was on are not sent", r.data.sent === 0 && sent.length === 0, JSON.stringify(r.data));

  // ---- a new message goes out, once
  await addMsg("parent", { id: "m-w2", from: "hostel", at: at(1), kind: "template", template: "welcome", data: { name: "Arjun", bed: "X-101-A", parent: "1" } });
  r = await call("/flush", { jwt: owner, body: { org: ORG } });
  const w = sent.at(-1);
  expect("the parent's welcome is sent", r.data.sent === 1 && w?.template?.name === "stayos_welcome_parent", JSON.stringify(r.data));
  expect("to the parent's number from the residents table", w?.to === `91${PARENT_PHONE}`);
  expect("with the hostel, child and bed filled in", JSON.stringify(w?.template?.components?.[0]?.parameters?.map((p) => p.text)) === JSON.stringify(["Check Hostel", "Arjun", "X-101-A"]), JSON.stringify(w?.template));
  r = await call("/flush", { jwt: owner, body: { org: ORG } });
  expect("it is not sent twice", r.data.sent === 0 && sent.length === 1);
  let [row] = await outbox();
  expect("the send is logged", row?.status === "sent" && row?.wamid === "wamid.check1" && row?.template === "stayos_welcome_parent");

  // ---- the conversation's phone number can't redirect a message
  await q("update public.wa_threads set phone = $3 where org_id = $1 and id = $2", [ORG, "wa-r", STRANGER]);
  await addMsg("resident", { id: "m-i1", from: "hostel", at: at(2), kind: "template", template: "complaint_ack", data: { id: "C-1", category: "Electrical", room: "X-101", sla: "24 hours" } });
  await call("/flush", { jwt: owner, body: { org: ORG } });
  expect("messages go to the resident's saved number, not the conversation's", sent.at(-1)?.to === `91${RES_PHONE}`, sent.at(-1)?.to);

  // ---- Meta reports delivery
  expect("an unsigned webhook is refused", (await hook(fromMeta({ statuses: [{ id: "wamid.check1", status: "read" }] }), false)).status === 401);
  await hook(fromMeta({ statuses: [{ id: "wamid.check1", status: "read" }] }));
  await hook(fromMeta({ statuses: [{ id: "wamid.check1", status: "delivered" }] }));
  [row] = await outbox();
  expect("read stays read when a late 'delivered' arrives", row.status === "read", row.status);

  // ---- a template Meta refuses is logged with the reason
  await addMsg("resident", { id: "m-x1", from: "hostel", at: at(3), kind: "template", template: "complaint_resolved", data: { id: "C-1" } });
  await call("/flush", { jwt: owner, body: { org: ORG } });
  const failed = (await outbox()).find((x) => x.message_id === "m-x1");
  expect("a refused template shows as failed, with Meta's reason", failed?.status === "failed" && /Template name/.test(failed?.error ?? ""), JSON.stringify(failed));

  // ---- replies
  const before = sent.length;
  await addMsg("resident", { id: "m-t1", from: "hostel", at: at(4), kind: "text", text: "Hi Arjun, the electrician comes at 5." });
  await call("/flush", { jwt: owner, body: { org: ORG } });
  const early = (await outbox()).find((x) => x.message_id === "m-t1");
  expect("an office reply isn't sent if they haven't written in 24 hours", sent.length === before && early?.status === "skipped" && /24 hours/.test(early?.error ?? ""), JSON.stringify(early));
  await hook(fromMeta({ messages: [{ from: `91${RES_PHONE}`, id: "wamid.in1", type: "text", text: { body: "Is the fan fixed?" } }] }));
  const rt = await thread("resident");
  expect("their message appears in the hostel's inbox", rt.messages.at(-1)?.from === "contact" && rt.messages.at(-1)?.text === "Is the fan fixed?" && rt.unread === 1);
  await hook(fromMeta({ messages: [{ from: `91${STRANGER}`, id: "wamid.in2", type: "text", text: { body: "hello" } }] }));
  expect("a message from an unknown number goes nowhere", (await thread("resident")).messages.length === rt.messages.length);
  await addMsg("resident", { id: "m-t2", from: "hostel", at: at(5), kind: "text", text: "Yes, done this morning." });
  await call("/flush", { jwt: owner, body: { org: ORG } });
  expect("an office reply within 24 hours is sent as text", sent.at(-1)?.type === "text" && sent.at(-1)?.text?.body === "Yes, done this morning.", JSON.stringify(sent.at(-1)));

  // ---- leave: the parent approves on WhatsApp
  await q(`insert into public.leaves (org_id, id, resident_id, "from", "to", reason, destination, status, requested_at) values ($1, 'L-1', 'R-1', now() + interval '1 day', now() + interval '2 days', 'Going home', 'Kozhikode', 'awaiting_parent', now())`, [ORG]);
  await addMsg("parent", { id: "m-l1", from: "hostel", at: at(6), kind: "template", template: "leave_request", data: { leaveId: "L-1" } });
  await call("/flush", { jwt: owner, body: { org: ORG } });
  const lr = sent.at(-1);
  const buttons = lr?.template?.components?.filter((c) => c.type === "button").map((c) => c.parameters[0].payload);
  expect("the leave request goes to the parent with Approve and Reject", lr?.template?.name === "stayos_leave_request" && buttons?.[0] === `L|${ORG}|L-1|approved` && buttons?.[1] === `L|${ORG}|L-1|rejected`, JSON.stringify(lr?.template));
  await hook(fromMeta({ messages: [{ from: `91${STRANGER}`, id: "wamid.b0", type: "button", button: { payload: `L|${ORG}|L-1|approved`, text: "Approve" } }] }));
  expect("another number can't approve it", (await q("select status from public.leaves where org_id = $1 and id = 'L-1'", [ORG]))[0].status === "awaiting_parent");
  await hook(fromMeta({ messages: [{ from: `91${RES_PHONE}`, id: "wamid.b1", type: "button", button: { payload: `L|${ORG}|L-1|approved`, text: "Approve" } }] }));
  expect("the resident can't approve their own leave", (await q("select status from public.leaves where org_id = $1 and id = 'L-1'", [ORG]))[0].status === "awaiting_parent");
  await hook(fromMeta({ messages: [{ from: `91${PARENT_PHONE}`, id: "wamid.b2", type: "button", button: { payload: `L|${ORG}|L-1|approved`, text: "Approve" } }] }));
  const lv = (await q("select status, parent_decision_at from public.leaves where org_id = $1 and id = 'L-1'", [ORG]))[0];
  expect("the parent's tap approves it", lv.status === "approved" && !!lv.parent_decision_at);
  expect("both get the decision", sent.filter((m) => m.template?.name === "stayos_leave_decision").length === 2);
  expect("the meals while away are skipped", (await q("select count(*)::int as n from public.meal_optouts where org_id = $1 and resident_id = 'R-1' and source = 'whatsapp'", [ORG]))[0].n >= 1);
  expect("it shows in the activity feed", (await q("select count(*)::int as n from public.activity where org_id = $1 and kind = 'leave_approved'", [ORG]))[0].n === 1);
  await hook(fromMeta({ messages: [{ from: `91${PARENT_PHONE}`, id: "wamid.b3", type: "button", button: { payload: `L|${ORG}|L-1|rejected`, text: "Reject" } }] }));
  expect("a second tap doesn't change it", (await q("select status from public.leaves where org_id = $1 and id = 'L-1'", [ORG]))[0].status === "approved");

  // ---- the 9 AM rent reminders
  await q(`insert into public.invoices (org_id, id, resident_id, month, issued_on, due_on, total, status) values ($1, 'INV-D', 'R-1', to_char(now(), 'YYYY-MM'), current_date - 3, (now() at time zone 'Asia/Kolkata')::date, 5000, 'unpaid')`, [ORG]);
  await q(`insert into public.invoices (org_id, id, resident_id, month, issued_on, due_on, total, status) values ($1, 'INV-L', 'R-1', '2026-01', current_date - 30, (now() at time zone 'Asia/Kolkata')::date - 4, 5000, 'unpaid')`, [ORG]);
  await q(`insert into public.invoices (org_id, id, resident_id, month, issued_on, due_on, total, status) values ($1, 'INV-N', 'R-1', '2026-02', current_date - 30, (now() at time zone 'Asia/Kolkata')::date - 5, 5000, 'unpaid')`, [ORG]);
  const n0 = sent.length;
  r = await call("/cron/daily");
  const daytime = r.data.reminders === "sent";
  const rem = sent.slice(n0).map((m) => m.template?.name);
  if (daytime) {
    expect("due today and 4 days late get reminders", rem.includes("stayos_rent_due") && rem.includes("stayos_rent_overdue") && rem.length === 2, JSON.stringify(rem));
    const due = sent.slice(n0).find((m) => m.template?.name === "stayos_rent_due");
    expect("with the amount and a pay link", due?.template?.components?.[0]?.parameters?.some((p) => p.text === "₹5,000") && due.template.components[0].parameters.some((p) => p.text === "https://stayos.space/resident/pay/?invoice=INV-D"));
    await call("/cron/daily");
    expect("running it again the same day sends nothing new", sent.length === n0 + 2);
  } else {
    expect("outside 9 AM to 8 PM IST no reminders go out", rem.length === 0, JSON.stringify(rem));
  }
  await rpc(owner, "set_whatsapp", { p_org: ORG, p_enabled: true, p_reminders: false });
  await q("delete from public.wa_outbox where org_id = $1 and template in ('stayos_rent_due', 'stayos_rent_overdue')", [ORG]);
  await q(`update public.wa_threads set messages = (select coalesce(jsonb_agg(m), '[]') from jsonb_array_elements(messages) m where m->>'template' not in ('reminder_due', 'reminder_overdue')) where org_id = $1`, [ORG]);
  const n1 = sent.length;
  await call("/cron/daily");
  expect("with reminders off, the 9 AM job sends none", sent.length === n1);

  // ---- sample hostels never send
  const n2 = sent.length;
  r = await call("/flush", { jwt: owner, body: { org: DEMO } });
  expect("the sample hostel sends nothing", sent.length === n2 && /off/.test(r.data.skipped ?? ""), JSON.stringify(r.data));
  expect("the owner sees this hostel's log through the Data API", (await (await realFetch(`${API}/wa_outbox?select=id&org_id=eq.${ORG}`, { headers: { authorization: `Bearer ${owner}` } })).json()).length >= 5);
  expect("other hostels' people can't", (await (await realFetch(`${API}/wa_outbox?select=id&org_id=eq.${ORG}`, { headers: { authorization: `Bearer ${resident}` } })).json()).length === 0);
} catch (e) {
  failures++;
  console.error(e);
} finally {
  await q("delete from public.orgs where id = $1", [ORG]);
  await db.end();
}
console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
