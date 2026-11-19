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

for (const [role, email] of [["owner", "owner@demo.stayos.app"], ["warden", "warden@demo.stayos.app"], ["resident", "anjali@demo.stayos.app"], ["parent", "parent@demo.stayos.app"]]) {
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
const bad = await api("not-a-token", "residents?select=id&limit=1");
expect("requests without a valid token are rejected", bad.status === 401);
process.exit(failures ? 1 : 0);
