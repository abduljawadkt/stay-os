// Static export for the iOS app: the same pages without server routes. The /api/auth route only exists
// on the web (Vercel); the iOS app talks to Neon Auth directly through native HTTP.
import { execSync } from "node:child_process";
import fs from "node:fs";

const api = "app/api";
const parked = ".api-parked";
if (fs.existsSync(api)) fs.renameSync(api, parked);
try {
  execSync("next build", { stdio: "inherit", env: { ...process.env, STATIC_EXPORT: "1" } });
} finally {
  if (fs.existsSync(parked)) fs.renameSync(parked, api);
}
