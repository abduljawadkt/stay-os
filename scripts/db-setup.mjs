// Creates the StayOS schema in Neon and loads the sample hostel.
//   npm run db:setup            first run (refuses if real customer hostels exist)
//   npm run db:setup -- --force  wipe and rebuild everything
// Needs DATABASE_URL and NEXT_PUBLIC_NEON_AUTH_URL in .env.local. The connection string never leaves this script.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import dotenv from "dotenv";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env.local"), quiet: true });
const force = process.argv.includes("--force");

const TEMPLATE = "00000000-0000-0000-0000-000000000001";
const DEMO = "00000000-0000-0000-0000-0000000000d0";
export const DEMO_PASSWORD = "stayos-demo-2026";
const DEMO_USERS = [
  { key: "owner", email: "owner@demo.stayos.app", name: "Rasheed Koya", role: "owner" },
  { key: "warden", email: "warden@demo.stayos.app", name: "Mohammed Ashraf P.", role: "warden" },
  { key: "resident", email: "anjali@demo.stayos.app", name: "Anjali Menon", role: "resident", residentId: "R-1042" },
  { key: "parent", email: "parent@demo.stayos.app", name: "Rajesh Menon", role: "parent", residentId: "R-1042" },
];

const url = process.env.DATABASE_URL?.replace("sslmode=require", "sslmode=verify-full");
const authUrl = process.env.NEXT_PUBLIC_NEON_AUTH_URL;
if (!url || !authUrl) throw new Error("DATABASE_URL and NEXT_PUBLIC_NEON_AUTH_URL must be set in .env.local");

const db = new pg.Client({ connectionString: url });
await db.connect();
const q = (sql, params) => db.query(sql, params);

// ---- safety: never wipe real hostels by accident
const exists = (await q(`select to_regclass('public.orgs') as t`)).rows[0].t;
if (exists && !force) {
  const real = (await q(`select count(*)::int as n from public.orgs where not is_demo and not is_template`)).rows[0].n;
  if (real > 0) {
    console.error(`There are ${real} customer hostels in this database. Re-run with --force to wipe and rebuild everything.`);
    process.exit(1);
  }
}

console.log("Applying db/schema.sql");
await q(fs.readFileSync(path.join(root, "db/schema.sql"), "utf8"));

// ---- sample data, camelCase JSON -> snake_case rows
const read = (f) => JSON.parse(fs.readFileSync(path.join(root, "data", f), "utf8"));
const snake = (k) => k.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase());
const toRow = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [snake(k), v === undefined ? null : v]));

const hostel = read("hostel.json");
const mess = read("mess.json");
const { optOuts, ...messSettings } = mess;

await q(
  `insert into public.orgs (id, name, city, address, phone, whatsapp, upi_id, bank, owner_name, owner_phone, rent_by_type, mess_fee, deposit, due_day,
     settings, plan, subscription_status, trial_ends_at, is_template)
   values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'scale','active',null,true)`,
  [TEMPLATE, hostel.name, hostel.city, hostel.address, hostel.phone, hostel.whatsapp, hostel.upiId, hostel.bank, hostel.owner.name, hostel.owner.phone,
    hostel.rentByType, hostel.messFee, hostel.deposit, hostel.dueDay,
    { clock: { mode: "demo", now: hostel.now }, months: hostel.months, blocks: hostel.blocks, wardenId: hostel.wardenId, mess: messSettings }],
);

async function load(table, rows) {
  if (!rows.length) return;
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const list = cols.map((c) => `"${c}"`).join(", ");
  for (let i = 0; i < rows.length; i += 1000) {
    const chunk = rows.slice(i, i + 1000).map((r) => ({ org_id: TEMPLATE, ...r }));
    await q(`insert into public.${table} (org_id, ${list}) select org_id, ${list} from jsonb_populate_recordset(null::public.${table}, $1)`, [JSON.stringify(chunk)]);
  }
  console.log(`  ${table}: ${rows.length}`);
}

console.log("Loading the sample hostel (template)");
await load("rooms", read("rooms.json").map(toRow));
await load("beds", read("beds.json").map(toRow));
await load("residents", read("residents.json").map(toRow));
await load("invoices", read("invoices.json").map(toRow));
await load("expenses", read("expenses.json").map(toRow));
await load("staff", read("staff.json").map(toRow));
await load("complaints", read("complaints.json").map(toRow));
await load("gate_events", read("gate.json").map(toRow));
await load("leaves", read("leaves.json").map(toRow));
await load("visitors", read("visitors.json").map(toRow));
await load("meal_optouts", optOuts.map(toRow));
await load("notices", read("notices.json").map(toRow));
await load("activity", read("activity.json").map(({ id, at, kind, ...data }) => ({ id, at, kind, data })));
await load("wa_threads", read("whatsapp.json").map(toRow));

console.log("Creating the shared live-demo hostel");
await q(
  `insert into public.orgs (id, name, city, plan, subscription_status, trial_ends_at, is_demo) values ($1, $2, $3, 'growth', 'trialing', now() + interval '14 days', true)`,
  [DEMO, hostel.name, hostel.city],
);
await q(`select app.copy_template($1)`, [DEMO]);

// ---- demo sign-ins through Neon Auth (Better Auth), then memberships
async function ensureUser(u) {
  const res = await fetch(`${authUrl}/sign-up/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost:3000" },
    body: JSON.stringify({ email: u.email, password: DEMO_PASSWORD, name: u.name }),
  });
  if (!res.ok && res.status !== 422 && res.status !== 400) throw new Error(`sign-up ${u.email}: ${res.status} ${await res.text()}`);
  const row = (await q(`select id::text from neon_auth."user" where email = $1`, [u.email])).rows[0];
  if (!row) throw new Error(`could not create ${u.email}: ${res.status} ${await res.text()}`);
  return row.id;
}

console.log("Creating demo accounts");
for (const u of DEMO_USERS) {
  const id = await ensureUser(u);
  await q(`insert into public.members (org_id, user_id, role, resident_id, name, email) values ($1,$2,$3,$4,$5,$6)`, [DEMO, id, u.role, u.residentId ?? null, u.name, u.email]);
  console.log(`  ${u.role.padEnd(8)} ${u.email}`);
}

const counts = (await q(`select (select count(*) from public.beds where org_id = $1)::int as beds, (select count(*) from public.residents where org_id = $1 and status <> 'checked_out')::int as residents, (select count(*) from public.invoices where org_id = $1)::int as invoices`, [DEMO])).rows[0];
console.log(`Done. Demo hostel: ${counts.beds} beds, ${counts.residents} current residents, ${counts.invoices} invoices.`);
await db.end();
