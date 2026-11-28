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
    // activity about their own resident only (db/migrations/009)
    const mine = await api(jwt, "activity?on_conflict=org_id,id", { method: "POST", headers: { prefer: "resolution=merge-duplicates" }, body: JSON.stringify({ org_id: DEMO, id: `CHECK-${role}`, at: "2026-11-27T10:00:00+05:30", kind: "optout", data: { residentId: "R-1042", meals: ["lunch"] } }) });
    expect(`${role} can record activity about their own resident`, mine.status < 300);
    const other = await api(jwt, "activity", { method: "POST", body: JSON.stringify({ org_id: DEMO, id: `CHECK-${role}-other`, at: "2026-11-27T10:00:00+05:30", kind: "optout", data: { residentId: "R-1001", meals: ["lunch"] } }) });
    expect(`${role} cannot record activity about another resident`, other.status === 403);
    // where each meal is had (db/migrations/015)
    if (role === "resident") {
      const row = (meal_at) => ({ org_id: DEMO, id: "CHECK-MP", resident_id: "R-1042", date: "2026-12-20", meals: [], reason: "", source: "app", meal_at });
      const save = (body) => api(jwt, "meal_optouts?on_conflict=org_id,id", { method: "POST", headers: { prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify(body) });
      const ok = await save(row({ breakfast: "institute", lunch: "block:B", dinner: "hostel" }));
      expect("resident can choose where each meal is had", ok.status < 300 && ok.data?.[0]?.meal_at?.lunch === "block:B");
      expect("lunch at a block counts as lunch at the hostel for older apps", ok.data?.[0]?.lunch_at === "hostel");
      const bad = await save(row({ dinner: "kitchen" }));
      expect("a made-up meal place is refused", bad.status >= 400);
      const old = await save({ ...row({}), lunch_at: "institute" });
      expect("an older app setting lunch keeps both in step", old.status < 300 && old.data?.[0]?.lunch_at === "institute" && !old.data?.[0]?.meal_at?.lunch);
      // residents can't delete; the office can
      await api(await login("owner@demo.stayos.space"), `meal_optouts?org_id=eq.${DEMO}&id=eq.CHECK-MP`, { method: "DELETE" });
    }
  } else {
    expect(`${role} sees the whole hostel`, row.residents > 300 && row.invoices > 1000);
    // expenses are the owner's (db/migrations/008)
    if (role === "warden") {
      expect("warden sees no expenses", row.expenses === 0);
      const exp = await api(jwt, "expenses", { method: "POST", body: JSON.stringify({ org_id: DEMO, id: "CHECK", date: "2026-11-27", category: "food", vendor: "x", amount: 1 }) });
      expect("warden cannot add expenses", exp.status === 403);
    } else expect("owner sees the expenses", row.expenses > 100);
    // staff pay is the owner's too (db/migrations/014): wardens see staff and attendance, never salary or advance
    const pay = await api(jwt, `staff_pay?select=salary&org_id=eq.${DEMO}`);
    const staffRows = await api(jwt, `staff?select=id,salary,advance,attendance&org_id=eq.${DEMO}`);
    const snap = await api(jwt, "rpc/org_snapshot", { method: "POST", body: JSON.stringify({ p_org: DEMO }) });
    const snapPaid = (snap.data?.staff ?? []).filter((x) => x.salary > 0).length;
    expect(`${role}: the staff table itself holds no pay`, staffRows.data?.length > 0 && staffRows.data.every((x) => x.salary === 0 && x.advance === 0));
    if (role === "warden") {
      expect("warden can't read staff pay", pay.status === 200 && pay.data.length === 0);
      expect("warden's hostel data has no salaries", snapPaid === 0 && snap.data?.staff?.length > 0);
      // the app saves the whole staff row when a warden marks attendance; the pay in it must be ignored
      const s0 = staffRows.data[0];
      const owner = await login("owner@demo.stayos.space");
      const before = (await api(owner, `staff_pay?select=salary,advance&org_id=eq.${DEMO}&staff_id=eq.${s0.id}`)).data?.[0];
      const up = await api(jwt, "staff?on_conflict=org_id,id", { method: "POST", headers: { prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ ...(await api(jwt, `staff?select=*&org_id=eq.${DEMO}&id=eq.${s0.id}`)).data[0], salary: 1, advance: 999 }) });
      const after = (await api(owner, `staff_pay?select=salary,advance&org_id=eq.${DEMO}&staff_id=eq.${s0.id}`)).data?.[0];
      const kept = up.status < 300 && before && after && after.salary === before.salary && after.advance === before.advance;
      expect("a warden saving a staff row can't change pay", kept);
      if (!kept) console.log("     ", up.status, JSON.stringify(up.data)?.slice(0, 200), JSON.stringify(before), JSON.stringify(after));
    } else {
      expect("owner reads staff pay", pay.status === 200 && pay.data.length > 0 && pay.data.every((x) => x.salary > 0));
      expect("owner's hostel data has the salaries", snapPaid === snap.data?.staff?.length && snapPaid > 0);
      const s0 = staffRows.data[0];
      const full = (await api(jwt, `staff?select=*&org_id=eq.${DEMO}&id=eq.${s0.id}`)).data[0];
      const was = (await api(jwt, `staff_pay?select=salary,advance&org_id=eq.${DEMO}&staff_id=eq.${s0.id}`)).data[0];
      const save = (body) => api(jwt, "staff?on_conflict=org_id,id", { method: "POST", headers: { prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(body) });
      await save({ ...full, salary: was.salary + 500, advance: was.advance });
      const changed = (await api(jwt, `staff_pay?select=salary&org_id=eq.${DEMO}&staff_id=eq.${s0.id}`)).data[0];
      await save({ ...full, salary: was.salary, advance: was.advance });
      const back = (await api(jwt, `staff_pay?select=salary&org_id=eq.${DEMO}&staff_id=eq.${s0.id}`)).data[0];
      expect("owner changes a salary the way the app saves", changed?.salary === was.salary + 500 && back?.salary === was.salary);
      expect("nobody can write staff pay directly", (await api(jwt, "staff_pay", { method: "POST", body: JSON.stringify({ org_id: DEMO, staff_id: s0.id, salary: 1 }) })).status >= 400);
    }
    const direct = await api(jwt, `orgs?id=eq.${DEMO}`, { method: "PATCH", body: JSON.stringify({ plan: "scale" }) });
    expect(`${role} cannot set the plan directly`, direct.status === 403);
  }
}
console.table(rows);
// remove the activity entries the checks above added
await api(await login("owner@demo.stayos.space"), `activity?org_id=eq.${DEMO}&id=like.CHECK-*`, { method: "DELETE" });

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
    // the app saves with "insert, or update if it's there" (upsert); the guard must judge that as an update (db/migrations/010)
    await api(owner, `leaves?org_id=eq.${DEMO}&id=eq.${leave.id}`, { method: "PATCH", body: JSON.stringify({ status: "awaiting_parent", parent_decision_at: null }) });
    const full = (await api(owner, `leaves?select=*&org_id=eq.${DEMO}&id=eq.${leave.id}`)).data?.[0];
    const { updated_at: _u, ...row } = full ?? {};
    const upsert = (who, body) => api(who, "leaves?on_conflict=org_id,id", { method: "POST", headers: { prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(body) });
    const selfUp = await upsert(resident, { ...row, status: "approved", parent_decision_at: new Date().toISOString() });
    expect("resident cannot approve own leave the way the app saves", selfUp.status >= 400);
    const parentUp = await upsert(parent, { ...row, status: "approved", parent_decision_at: new Date().toISOString() });
    expect("parent can approve the leave the way the app saves", parentUp.status < 300);
  }
  const fake = await api(resident, "complaints", { method: "POST", body: JSON.stringify({ org_id: DEMO, id: "CHECK-R", resident_id: "R-1042", room_id: "C-207", category: "other", title: "x", channel: "app", status: "resolved", created_at: new Date().toISOString(), sla_hours: 4 }) });
  expect("resident cannot file a complaint as already resolved", fake.status >= 400);
  const gate = await api(resident, "gate_events", { method: "POST", body: JSON.stringify({ org_id: DEMO, id: "CHECK-G", resident_id: "R-1042", type: "in", at: new Date().toISOString() }) });
  expect("resident cannot write the gate log", gate.status >= 400);
  // put the demo back the way it was
  if (mineBefore) { const { id: _i, ...rest } = mineBefore; await api(owner, `invoices?org_id=eq.${DEMO}&id=eq.${mineBefore.id}`, { method: "PATCH", body: JSON.stringify(rest) }); }
  if (leaveBefore) { const { id: _l, ...rest } = leaveBefore; await api(owner, `leaves?org_id=eq.${DEMO}&id=eq.${leaveBefore.id}`, { method: "PATCH", body: JSON.stringify(rest) }); }
}
// ---- free trial, then StayOS approval (db/migrations/011)
// A temporary hostel whose trial has ended, owned by the demo owner; removed at the end.
{
  const { default: pg } = await import("pg");
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL?.replace("sslmode=require", "sslmode=verify-full") });
  await db.connect();
  const LOCKED = "00000000-0000-0000-0000-00000000c4ec";
  const owner = await login("owner@demo.stayos.space");
  const ownerId = (await db.query(`select id::text from neon_auth."user" where email = 'owner@demo.stayos.space'`)).rows[0].id;
  try {
    await db.query("delete from public.orgs where id = $1", [LOCKED]);
    await db.query(`insert into public.orgs (id, name, city, subscription_status, trial_ends_at) values ($1, 'Check: trial ended', 'Kozhikode', 'trialing', now() - interval '1 day')`, [LOCKED]);
    await db.query(`insert into public.members (org_id, user_id, role, name, email) values ($1, $2, 'owner', 'Check', 'owner@demo.stayos.space')`, [LOCKED, ownerId]);
    await db.query(`insert into public.rooms (org_id, id, block, floor, number, type, rent, capacity, bath) values ($1, 'X-101', 'X', 1, 101, 'single', 5000, 1, 'attached')`, [LOCKED]);

    const mine = (await api(owner, "rpc/my_memberships", { method: "POST", body: "{}" })).data?.find((m) => m.org_id === LOCKED);
    expect("an ended trial shows as not active", mine && mine.active === false);
    const rooms = await api(owner, `rooms?select=id&org_id=eq.${LOCKED}`);
    expect("an ended trial's data can't be read", rooms.status === 200 && rooms.data.length === 0);
    const add = await api(owner, "rooms", { method: "POST", body: JSON.stringify({ org_id: LOCKED, id: "X-102", block: "X", floor: 1, number: 102, type: "single", rent: 5000, capacity: 1, bath: "attached" }) });
    expect("an ended trial's data can't be changed", add.status === 403);
    const snap = await api(owner, "rpc/org_snapshot", { method: "POST", body: JSON.stringify({ p_org: LOCKED }) });
    expect("loading an ended trial says it is locked", snap.status >= 400 && JSON.stringify(snap.data).includes("hostel_locked"));
    const own = await api(owner, "rpc/checkout_plan", { method: "POST", body: JSON.stringify({ p_org: LOCKED, p_plan: "growth", p_cycle: "monthly" }) });
    expect("owners can't switch a plan on by themselves", own.status >= 400);
    const ask = await api(owner, "rpc/request_approval", { method: "POST", body: JSON.stringify({ p_org: LOCKED, p_plan: "growth", p_cycle: "yearly" }) });
    const asked = (await db.query("select approval_requested_at is not null as asked, requested_plan from public.orgs where id = $1", [LOCKED])).rows[0];
    expect("the owner can ask StayOS for approval", ask.status === 200 && asked.asked && asked.requested_plan === "growth");
    const notAdmin = await api(owner, "rpc/admin_hostels", { method: "POST", body: "{}" });
    expect("hostel owners can't use the StayOS admin list", notAdmin.status >= 400);
    const notAdminSet = await api(owner, "rpc/admin_set_access", { method: "POST", body: JSON.stringify({ p_org: LOCKED, p_action: "approve", p_months: 12 }) });
    expect("hostel owners can't approve themselves", notAdminSet.status >= 400);
    const amAdmin = await api(owner, "rpc/am_platform_admin", { method: "POST", body: "{}" });
    expect("the demo owner is not a StayOS admin", amAdmin.status === 200 && amAdmin.data === false);

    // the admin side, with the demo owner made an admin for a moment
    await db.query("insert into public.platform_admins (email) values ('owner@demo.stayos.space') on conflict do nothing");
    try {
      const list = await api(owner, "rpc/admin_hostels", { method: "POST", body: "{}" });
      const row = list.data?.find?.((h) => h.id === LOCKED);
      expect("an admin sees every hostel, with requests first", list.status === 200 && row && row.active === false && !!row.approval_requested_at && list.data[0].approval_requested_at);
      const ok = await api(owner, "rpc/admin_set_access", { method: "POST", body: JSON.stringify({ p_org: LOCKED, p_action: "approve", p_months: 3 }) });
      const after = await api(owner, `rooms?select=id&org_id=eq.${LOCKED}`);
      expect("approving switches the hostel back on, data intact", ok.status === 200 && ok.data?.subscription_status === "active" && after.data?.length === 1);
      const months = (await db.query("select round(extract(epoch from current_period_end - now()) / 86400) as days, plan, billing_cycle from public.orgs where id = $1", [LOCKED])).rows[0];
      expect("approval runs for the months picked, on the plan asked for", Number(months.days) >= 88 && Number(months.days) <= 93 && months.plan === "growth" && months.billing_cycle === "yearly");
      await api(owner, "rpc/admin_set_access", { method: "POST", body: JSON.stringify({ p_org: LOCKED, p_action: "suspend" }) });
      const suspended = await api(owner, `rooms?select=id&org_id=eq.${LOCKED}`);
      expect("suspending locks it again", suspended.data?.length === 0);
      await api(owner, "rpc/admin_set_access", { method: "POST", body: JSON.stringify({ p_org: LOCKED, p_action: "extend_trial", p_days: 7 }) });
      const extended = await api(owner, `rooms?select=id&org_id=eq.${LOCKED}`);
      expect("extending the trial opens it for those days", extended.data?.length === 1);
    } finally {
      await db.query("delete from public.platform_admins where email = 'owner@demo.stayos.space'");
    }
    const demo = await api(owner, `rooms?select=id&org_id=eq.${DEMO}&limit=1`);
    expect("the shared demo never locks", demo.data?.length === 1);
  } finally {
    await db.query("delete from public.orgs where id = $1", [LOCKED]);
    await db.end();
  }
}

// ---- hostel setup: rents, blocks, meal cut-offs, rooms (db/migrations/016)
// A temporary hostel owned by the demo owner, with the demo warden on its staff; removed at the end.
{
  const { default: pg } = await import("pg");
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL?.replace("sslmode=require", "sslmode=verify-full") });
  await db.connect();
  const SETUP = "00000000-0000-0000-0000-00000005e7c0";
  const owner = await login("owner@demo.stayos.space");
  const warden = await login("warden@demo.stayos.space");
  const idOf = async (email) => (await db.query(`select id::text from neon_auth."user" where email = $1`, [email])).rows[0].id;
  const rpc = (jwt, fn, body) => api(jwt, `rpc/${fn}`, { method: "POST", body: JSON.stringify({ p_org: SETUP, ...body }) });
  const org = async () => (await db.query("select rent_by_type, settings from public.orgs where id = $1", [SETUP])).rows[0];
  const bedsOf = async (room) => (await db.query("select id from public.beds where org_id = $1 and room_id = $2 order by id", [SETUP, room])).rows.map((r) => r.id);
  try {
    await db.query("delete from public.orgs where id = $1", [SETUP]);
    await db.query(`insert into public.orgs (id, name, city, settings) values ($1, 'Check: setup', 'Kozhikode', '{"clock":{"mode":"real"}}')`, [SETUP]);
    await db.query(`insert into public.members (org_id, user_id, role, name, email) values ($1, $2, 'owner', 'Check', 'owner@demo.stayos.space'), ($1, $3, 'warden', 'Check', 'warden@demo.stayos.space')`,
      [SETUP, await idOf("owner@demo.stayos.space"), await idOf("warden@demo.stayos.space")]);
    await db.query("select app.build_layout($1, 2, 1, 2, 2)", [SETUP]);
    await db.query(`update public.orgs set settings = settings || '{"blocks":[{"id":"A","name":"Block A","gender":"M","floors":1,"curfew":"22:00","wardenId":"S-01"},{"id":"B","name":"Block B","gender":"M","floors":1,"curfew":"22:00"}]}' where id = $1`, [SETUP]);
    const rents = { single: 8000, double: 6500, triple: 5500, six: 4000 };

    const demoRents = await api(owner, "rpc/set_rents", { method: "POST", body: JSON.stringify({ p_org: DEMO, p_rents: rents }) });
    expect("the shared live demo's setup can't be changed", demoRents.status >= 400);
    const byWarden = await rpc(warden, "set_rents", { p_rents: rents });
    expect("a warden can't change rents", byWarden.status >= 400 && (await org()).rent_by_type.double === 7000);

    const since = (await db.query("select now() as t")).rows[0].t;
    const set = await rpc(owner, "set_rents", { p_rents: rents });
    const roomRents = (await db.query("select distinct rent from public.rooms where org_id = $1 and type = 'double'", [SETUP])).rows.map((r) => r.rent);
    expect("the owner sets rent per room type, and every room of that type follows", set.status === 200 && (await org()).rent_by_type.double === 6500 && roomRents.join() === "6500");
    const badRent = await rpc(owner, "set_rents", { p_rents: { ...rents, single: 1e12 } });
    expect("a rent that isn't a sensible amount is refused", badRent.status >= 400);
    const ch = await api(owner, "rpc/changes_since", { method: "POST", body: JSON.stringify({ p_org: SETUP, p_since: since }) });
    expect("other devices are told to load the hostel again", ch.data?.reload === true);

    const blocks = [
      { id: "A", name: "Boys block", gender: "M", curfew: "22:00" },
      { id: "B", name: "Ladies block", gender: "F", curfew: "21:30" },
      { id: "C", name: "Annexe", gender: "F", curfew: "21:30" },
    ];
    const setBlocks = await rpc(owner, "set_blocks", { p_blocks: blocks });
    const saved = (await org()).settings.blocks;
    expect("the owner names blocks, sets men or women and gate times, and adds a block",
      setBlocks.status === 200 && saved.length === 3 && saved[1].gender === "F" && saved[1].curfew === "21:30" && saved[0].name === "Boys block" && saved[0].wardenId === "S-01");
    const dropB = await rpc(owner, "set_blocks", { p_blocks: blocks.filter((b) => b.id !== "B") });
    expect("a block with rooms can't be removed", dropB.status >= 400 && (await org()).settings.blocks.length === 3);
    const badTime = await rpc(owner, "set_blocks", { p_blocks: [{ ...blocks[0], curfew: "25:00" }, blocks[1], blocks[2]] });
    expect("a gate time that isn't a time is refused", badTime.status >= 400);

    const add = await rpc(owner, "add_room", { p_block: "C", p_floor: 2, p_number: "201", p_type: "triple" });
    const c201 = (await db.query("select rent, capacity from public.rooms where org_id = $1 and id = 'C-201'", [SETUP])).rows[0];
    expect("the owner adds a room, with its beds and the type's rent", add.status === 200 && c201?.capacity === 3 && c201?.rent === 5500 && (await bedsOf("C-201")).length === 3);
    expect("the block's floors grow with the room", (await org()).settings.blocks.find((b) => b.id === "C").floors === 2);
    const again = await rpc(owner, "add_room", { p_block: "C", p_floor: 2, p_number: "201", p_type: "single" });
    expect("a room number can't be used twice in a block", again.status >= 400);
    const byWardenRoom = await rpc(warden, "add_room", { p_block: "C", p_floor: 1, p_number: "101", p_type: "single" });
    expect("a warden can't add rooms", byWardenRoom.status >= 400);

    await db.query("update public.beds set status = 'occupied', resident_id = 'R-CHECK' where org_id = $1 and id = 'C-201-3'", [SETUP]);
    const shrink = await rpc(owner, "set_room", { p_room: "C-201", p_type: "double" });
    expect("a room can't lose a bed someone sleeps in", shrink.status >= 400 && (await bedsOf("C-201")).length === 3);
    const remove = await rpc(owner, "remove_room", { p_room: "C-201" });
    expect("a room with someone in it can't be removed", remove.status >= 400);
    await db.query("update public.beds set status = 'vacant', resident_id = null where org_id = $1 and id = 'C-201-3'", [SETUP]);
    const toDouble = await rpc(owner, "set_room", { p_room: "C-201", p_type: "double" });
    const toSix = await rpc(owner, "set_room", { p_room: "C-201", p_type: "six" });
    expect("the owner changes how many share a room; beds follow", toDouble.status < 300 && toSix.status < 300 && (await bedsOf("C-201")).length === 6);
    const removed = await rpc(owner, "remove_room", { p_room: "C-201" });
    expect("an empty room can be removed with its beds", removed.status < 300 && (await bedsOf("C-201")).length === 0);

    const cutoffs = { breakfast: "20:30 previous day", lunch: "09:30", snacks: "14:00", dinner: "17:00" };
    const cut = await rpc(owner, "set_cutoffs", { p_cutoffs: cutoffs });
    expect("the owner sets meal cut-off times", cut.status === 200 && (await org()).settings.mess.cutoffs.lunch === "09:30");
    const badCut = await rpc(owner, "set_cutoffs", { p_cutoffs: { ...cutoffs, dinner: "late" } });
    expect("a cut-off that isn't a time is refused", badCut.status >= 400);
  } finally {
    await db.query("delete from public.orgs where id = $1", [SETUP]);
    await db.end();
  }
}

const bad = await api("not-a-token", "residents?select=id&limit=1");
expect("requests without a valid token are rejected", bad.status === 401);
process.exit(failures ? 1 : 0);
