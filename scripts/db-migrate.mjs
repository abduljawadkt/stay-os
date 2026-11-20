// Applies one SQL file to the database without touching data.
//   npm run db:migrate -- db/migrations/002_identity_guard_and_snapshot.sql
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import dotenv from "dotenv";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env.local"), quiet: true });
const file = process.argv[2];
if (!file) throw new Error("Pass the SQL file to apply");
const db = new pg.Client({ connectionString: process.env.DATABASE_URL?.replace("sslmode=require", "sslmode=verify-full") });
await db.connect();
await db.query(fs.readFileSync(path.resolve(root, file), "utf8"));
await db.end();
console.log(`Applied ${file}`);
