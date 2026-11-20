// Signs in as each demo account through Neon Auth and checks what row-level security lets it see and do.
//   npm run db:check
import dotenv from "dotenv";
dotenv.config({ path: ".env.local", quiet: true });
const AUTH = process.env.NEXT_PUBLIC_NEON_AUTH_URL, API = process.env.NEXT_PUBLIC_NEON_DATA_API_URL;
const DEMO = "00000000-0000-0000-0000-0000000000d0";
const ORIGIN = { origin: "http://localhost:3000" };

async function login(email) {
  const r = await fetch(`${AUTH}/sign-in/email`, { method: "POST", headers: { ...ORIGIN, "content-type": "application/json" }, body: JSON.stringify({ email, password: "stayos-demo-2026" }) });
  if (!r.ok) throw new Error(`sign-in ${email}: ${r.status}`);
  const cookie = r.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  const jwt = (await fetch(`${AUTH}/get-session`, { headers: { ...ORIGIN, cookie } })).headers.get("set-auth-jwt");
  if (!jwt) throw new Error(`no token for ${email}`);
  return jwt;
}
async function api(jwt, path, init = {}) {
  const r = await fetch(`${API}/${path}`, { ...init, headers: { authorization: `Bearer ${jwt}`, "content-type": "application/json", prefer: "return=minimal", ...(init.headers || {}) } });
  const text = await r.text();
  return { status: r.status, data: text ? JSON.parse(text) : null };
}

const tables = ["beds", "residents", "invoices", "expenses", "staff", "complaints", "gate_events", "meal_optouts", "activity", "wa_threads"];
const rows = [];
let failures = 0;
const expect = (label, ok) => { if (!ok) failures++; console.log(`${ok ? "ok  " : "FAIL"} ${label}`); };

for (const [role, email] of [["owner", "owner@demo.stayos.space"], ["warden", "warden@demo.stayos.space"], ["resident", "anjali@demo.stayos.space"], ["parent", "parent@demo.stayos.space"]]) {
  const jwt = await login(email);
  const row = { role };
  for (const t of tables) {
    const r = await api(jwt, `${t}?select=id&org_id=eq.${DEMO}`);
    row[t] = r.status === 200 ? r.data.length : `ERR ${r.status}`;
  }
  rows.push(row);
  if (role === "resident" || role === "parent") {
    const exp = await api(jwt, "expenses", { method: "POST", body: JSON.stringify({ org_id: DEMO, id: "CHECK", date: "2026-11-27", category: "food", vendor: "x", amount: 1 }) });
    expect(`${role} cannot add expenses`, exp.status === 403);
    const cmp = await api(jwt, "complaints", { method: "POST", body: JSON.stringify({ org_id: DEMO, id: "CHECK", resident_id: "R-1001", room_id: "A-101", category: "other", title: "x", channel: "app", status: "new", created_at: "2026-11-27T10:00:00+05:30", sla_hours: 4 }) });
    expect(`${role} cannot file a complaint as another resident`, cmp.status === 403);
    const plan = await api(jwt, "rpc/checkout_plan", { method: "POST", body: JSON.stringify({ p_org: DEMO, p_plan: "scale", p_cycle: "monthly" }) });
    expect(`${role} cannot change the plan`, plan.status >= 400);
    expect(`${role} sees only own invoices`, row.invoices > 0 && row.invoices < 20);
    expect(`${role} sees no expenses or salaries`, row.expenses === 0 && row.staff === 0);
  } else {
    expect(`${role} sees the whole hostel`, row.residents > 300 && row.invoices > 1000);
    const direct = await api(jwt, `orgs?id=eq.${DEMO}`, { method: "PATCH", body: JSON.stringify({ plan: "scale" }) });
    expect(`${role} cannot set the plan directly`, direct.status === 403);
  }
}
console.table(rows);

// ---- what residents and parents may change (db/migrations/003)
{
  const owner = await login("owner@demo.stayos.space");
  const resident = await login("anjali@demo.stayos.space");
  const parent = await login("parent@demo.stayos.space");
  const rep = { prefer: "return=representation" };
  // set up: one of Anjali's invoices unpaid and one leave awaiting the parent (restored afterwards)
  const invFields = "id,status,paid_on,method,utr,paid_via";
  const mineBefore = (await api(owner, `invoices?select=${invFields}&org_id=eq.${DEMO}&resident_id=eq.R-1042&order=issued_on.desc&limit=1`)).data?.[0];
  const leaveBefore = (await api(owner, `leaves?select=id,status,parent_decision_at&org_id=eq.${DEMO}&resident_id=eq.R-1042&order=requested_at.desc&limit=1`)).data?.[0];
  if (mineBefore) await api(owner, `invoices?org_id=eq.${DEMO}&id=eq.${mineBefore.id}`, { method: "PATCH", body: JSON.stringify({ status: "unpaid", paid_on: null, method: null, utr: null, paid_via: null }) });
  if (leaveBefore) await api(owner, `leaves?org_id=eq.${DEMO}&id=eq.${leaveBefore.id}`, { method: "PATCH", body: JSON.stringify({ status: "awaiting_parent", parent_decision_at: null }) });
  const mine = mineBefore && { id: mineBefore.id };
  const other = (await api(owner, `invoices?select=id&org_id=eq.${DEMO}&resident_id=neq.R-1042&status=eq.unpaid&limit=1`)).data?.[0];
  if (mine) {
    const p = await api(resident, `invoices?org_id=eq.${DEMO}&id=eq.${mine.id}`, { method: "PATCH", headers: rep, body: JSON.stringify({ status: "paid" }) });
    expect("resident cannot mark own invoice paid", p.status >= 400 || (Array.isArray(p.data) && p.data.length === 0));
    const pay = await api(resident, "rpc/pay_invoice_test", { method: "POST", body: JSON.stringify({ p_org: DEMO, p_invoice: mine.id, p_via: "app" }) });
    expect("resident can pay own invoice through the test payment (sample hostel)", pay.status === 200 && pay.data?.status === "paid");
  }
  if (other) {
    const pay = await api(resident, "rpc/pay_invoice_test", { method: "POST", body: JSON.stringify({ p_org: DEMO, p_invoice: other.id }) });
    expect("resident cannot pay someone else's invoice", pay.status >= 400);
  }
  const leave = leaveBefore && { id: leaveBefore.id };
  if (leave) {
    const self = await api(resident, `leaves?org_id=eq.${DEMO}&id=eq.${leave.id}`, { method: "PATCH", body: JSON.stringify({ status: "approved" }) });
    expect("resident cannot approve own leave", self.status >= 400);
    const byParent = await api(parent, `leaves?org_id=eq.${DEMO}&id=eq.${leave.id}`, { method: "PATCH", headers: rep, body: JSON.stringify({ status: "approved", parent_decision_at: new Date().toISOString() }) });
    expect("parent can approve the leave", byParent.status === 200 && byParent.data?.[0]?.status === "approved");
  }
  const fake = await api(resident, "complaints", { method: "POST", body: JSON.stringify({ org_id: DEMO, id: "CHECK-R", resident_id: "R-1042", room_id: "C-207", category: "other", title: "x", channel: "app", status: "resolved", created_at: new Date().toISOString(), sla_hours: 4 }) });
  expect("resident cannot file a complaint as already resolved", fake.status >= 400);
  const gate = await api(resident, "gate_events", { method: "POST", body: JSON.stringify({ org_id: DEMO, id: "CHECK-G", resident_id: "R-1042", type: "in", at: new Date().toISOString() }) });
  expect("resident cannot write the gate log", gate.status >= 400);
  // put the demo back the way it was
  if (mineBefore) { const { id: _i, ...rest } = mineBefore; await api(owner, `invoices?org_id=eq.${DEMO}&id=eq.${mineBefore.id}`, { method: "PATCH", body: JSON.stringify(rest) }); }
  if (leaveBefore) { const { id: _l, ...rest } = leaveBefore; await api(owner, `leaves?org_id=eq.${DEMO}&id=eq.${leaveBefore.id}`, { method: "PATCH", body: JSON.stringify(rest) }); }
}
const bad = await api("not-a-token", "residents?select=id&limit=1");
expect("requests without a valid token are rejected", bad.status === 401);
process.exit(failures ? 1 : 0);
