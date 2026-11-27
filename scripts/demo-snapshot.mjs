// Saves and restores the shared demo hostel exactly, so tests that change it can be undone.
//   node scripts/demo-snapshot.mjs save      → .e2e/demo-snapshot.json
//   node scripts/demo-snapshot.mjs diff      → what changed since the snapshot
//   node scripts/demo-snapshot.mjs restore   → rows added since are deleted, changed rows put back, deleted rows re-added
// Uses DATABASE_URL from .env.local. Only the demo org (orgs.is_demo) is touched; the sample template is not.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import dotenv from "dotenv";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env.local"), quiet: true });
const FILE = path.join(root, ".e2e/demo-snapshot.json");
const IGNORE = new Set(["updated_at"]); // touched by triggers on every write

const db = new pg.Client({ connectionString: process.env.DATABASE_URL?.replace("sslmode=require", "sslmode=verify-full") });
await db.connect();
const q = (sql, params) => db.query(sql, params).then((r) => r.rows);
const ident = (s) => `"${s.replace(/"/g, '""')}"`;

const [{ id: org } = {}] = await q("select id from public.orgs where is_demo limit 1");
if (!org) throw new Error("No demo hostel found");

// every public table with an org_id column, with its primary key (minus org_id) and columns
const tables = await q(`
  select c.relname as name,
    array(select a.attname from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
          where i.indrelid = c.oid and i.indisprimary and a.attname <> 'org_id' order by a.attnum)::text[] as key,
    array(select a.attname from pg_attribute a where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped order by a.attnum)::text[] as cols
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
    and exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'org_id' and not a.attisdropped)
  order by c.relname`);

const keyOf = (t, row) => t.key.map((k) => String(row[k])).join("|");
const strip = (row) => JSON.stringify(Object.fromEntries(Object.entries(row).filter(([k]) => !IGNORE.has(k)).sort(([a], [b]) => a.localeCompare(b))));

async function read() {
  const out = { org, at: new Date().toISOString(), orgRow: (await q("select to_jsonb(o) as j from public.orgs o where id = $1", [org]))[0].j, tables: {} };
  for (const t of tables) out.tables[t.name] = (await q(`select to_jsonb(t) as j from public.${ident(t.name)} t where org_id = $1`, [org])).map((r) => r.j);
  return out;
}

function diff(before, now) {
  const changes = [];
  for (const t of tables) {
    const a = new Map((before.tables[t.name] ?? []).map((r) => [keyOf(t, r), r]));
    const b = new Map((now.tables[t.name] ?? []).map((r) => [keyOf(t, r), r]));
    for (const [k, r] of b) if (!a.has(k)) changes.push({ t, kind: "added", k, row: r });
    for (const [k, r] of a) if (!b.has(k)) changes.push({ t, kind: "deleted", k, row: r });
      else if (strip(r) !== strip(b.get(k))) changes.push({ t, kind: "changed", k, row: r });
  }
  if (strip(before.orgRow) !== strip(now.orgRow)) changes.push({ t: null, kind: "changed", k: "orgs", row: before.orgRow });
  return changes;
}

const cmd = process.argv[2];
if (cmd === "save") {
  const snap = await read();
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(snap));
  console.log(`Saved the demo hostel: ${Object.entries(snap.tables).map(([n, r]) => `${n} ${r.length}`).join(", ")}`);
} else if (cmd === "diff" || cmd === "restore") {
  if (!fs.existsSync(FILE)) throw new Error("No snapshot yet: run save first");
  const snap = JSON.parse(fs.readFileSync(FILE, "utf8"));
  if (snap.org !== org) throw new Error("The snapshot is of a different demo hostel");
  const changes = diff(snap, await read());
  const summary = {};
  for (const c of changes) summary[`${c.t?.name ?? "orgs"} ${c.kind}`] = (summary[`${c.t?.name ?? "orgs"} ${c.kind}`] ?? 0) + 1;
  console.log(changes.length ? `Changed since ${snap.at}: ${Object.entries(summary).map(([k, n]) => `${k} ${n}`).join(", ")}` : "No changes since the snapshot");
  if (cmd === "restore" && changes.length) {
    await db.query("begin");
    try {
      for (const c of changes) {
        if (!c.t) {
          const cols = Object.keys(c.row).filter((k) => k !== "id" && !IGNORE.has(k));
          await db.query(`update public.orgs o set (${cols.map(ident).join(",")}) = (select ${cols.map((k) => `r.${ident(k)}`).join(",")} from jsonb_populate_record(null::public.orgs, $1) r) where o.id = $2`, [c.row, org]);
          continue;
        }
        const T = `public.${ident(c.t.name)}`;
        const where = c.t.key.map((k, i) => `t.${ident(k)} = (jsonb_populate_record(null::${T}, $1)).${ident(k)}`).join(" and ");
        if (c.kind === "added") await db.query(`delete from ${T} t where t.org_id = $2 and ${where}`, [c.row, org]);
        else if (c.kind === "deleted") await db.query(`insert into ${T} select * from jsonb_populate_record(null::${T}, $1)`, [c.row]);
        else {
          const cols = c.t.cols.filter((k) => k !== "org_id" && !c.t.key.includes(k) && !IGNORE.has(k));
          await db.query(`update ${T} t set (${cols.map(ident).join(",")}) = (select ${cols.map((k) => `r.${ident(k)}`).join(",")} from jsonb_populate_record(null::${T}, $1) r) where t.org_id = $2 and ${where}`, [c.row, org]);
        }
      }
      await db.query("commit");
    } catch (e) {
      await db.query("rollback");
      throw e;
    }
    const left = diff(snap, await read());
    console.log(left.length ? `Restore left ${left.length} differences` : "Restored: the demo hostel matches the snapshot");
  }
} else {
  console.log("Usage: node scripts/demo-snapshot.mjs save | diff | restore");
}
await db.end();
