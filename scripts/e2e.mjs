// End-to-end check of StayOS against a running site (default: the live https://stayos.space).
//
//   npm run test:e2e -- sweep     every screen, every role: iPhone (WebKit), Android (Chromium), desktop Chrome and Safari,
//                                 English and Malayalam. Looks for crashes, console errors, failed requests, sideways
//                                 overflow, error screens, missing headings, and slow loads.
//   npm run test:e2e -- flows     the main jobs across roles (complaint, gate pass, rent, meals, check-in, expense…).
//                                 These change the shared demo hostel, so it is snapshotted first and restored after.
//   npm run test:e2e              both
//
// Setup once: npx playwright install webkit chromium. Flows need DATABASE_URL in .env.local (for the snapshot).
// Env: E2E_BASE to test another deployment. Failures leave screenshots in .e2e/.
import { webkit, chromium, devices } from "playwright";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.E2E_BASE ?? "https://stayos.space";
const OUT = path.join(ROOT, ".e2e");
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const args = process.argv.slice(2);
const RUN_SWEEP = args.length === 0 || args.includes("sweep");
const RUN_FLOWS = args.length === 0 || args.includes("flows");
const ONLY = args.find((a) => a.startsWith("--only="))?.slice(7).toLowerCase();

// ---------------------------------------------------------------------------
// Devices, people, screens
// ---------------------------------------------------------------------------
export const DEVICES = {
  iphone: { engine: webkit, opts: devices["iPhone 15"], locales: ["en", "ml"] },
  android: { engine: chromium, opts: devices["Pixel 7"], locales: ["en"] },
  "desktop-chrome": { engine: chromium, opts: { viewport: { width: 1440, height: 900 } }, locales: ["en", "ml"] },
  "desktop-safari": { engine: webkit, opts: { ...devices["Desktop Safari"], viewport: { width: 1440, height: 900 } }, locales: ["en"] },
};
// the demo role list shows each person's name in their line
export const PEOPLE = {
  owner: { en: "Rasheed", ml: "റഷീദ്", home: /\/dashboard\// },
  warden: { en: "Ashraf", ml: "റഫ്", home: /\/dashboard\// },
  resident: { en: "Anjali", ml: "അഞ്ജലി", home: /\/resident\// },
  parent: { en: "Rajesh", ml: "രാജേഷ്", home: /\/parent\// },
};
const STAFF_SCREENS = ["/dashboard/", "/dashboard/rooms/", "/dashboard/residents/", "/dashboard/residents/profile/?id=R-1042", "/dashboard/rent/",
  "/dashboard/mess/", "/dashboard/complaints/", "/dashboard/gate/", "/dashboard/expenses/", "/dashboard/staff/", "/dashboard/reports/",
  "/dashboard/settings/", "/dashboard/more/"];
const SCREENS = {
  public: ["/", "/demo/", "/login/", "/signup/", "/forgot-password/", "/features/", "/pricing/", "/terms/", "/privacy/"],
  owner: STAFF_SCREENS,
  warden: STAFF_SCREENS,
  resident: ["/resident/", "/resident/room/", "/resident/mess/", "/resident/gate/", "/resident/help/", "/resident/help/new/", "/resident/notices/", "/resident/pay/"],
  parent: ["/parent/", "/parent/alerts/", "/parent/leave/", "/parent/notices/", "/parent/pay/"],
};
const ERROR_TEXT = [/Couldn't load/i, /This page could not be found/i, /Application error/i, /Something went wrong/i, /\[object Object\]/, /ലോഡ് ചെയ്യാനായില്ല/];

export async function newContext(browser, device, locale, extra = {}) {
  const ctx = await browser.newContext({ ...DEVICES[device].opts, timezoneId: "Asia/Kolkata", ignoreHTTPSErrors: BASE.includes("localhost"), ...extra });
  await ctx.addInitScript(({ locale, install }) => {
    try {
      // only the first time: a language the person picks in the app must survive reloads
      if (!localStorage.getItem("stayos-locale")) localStorage.setItem("stayos-locale", locale);
      if (!install) localStorage.setItem("stayos-install-dismissed", String(Date.now() + 7 * 864e5));
    } catch {}
  }, { locale, install: !!extra.install });
  return ctx;
}

export async function signIn(page, role, locale = "en") {
  const who = PEOPLE[role];
  await page.goto(BASE + "/demo/", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.getByRole("button").filter({ hasText: who[locale] }).first().click();
  await page.waitForURL(who.home, { timeout: 45000 });
  await page.waitForLoadState("networkidle").catch(() => {});
  // let the hostel's data finish loading, so the next page doesn't cut that request off mid-way
  await page.locator("h1").first().waitFor({ timeout: 20000 }).catch(() => {});
  await sleep(2500);
}

/** Collects what goes wrong on a page while `fn` runs. */
function watch(page) {
  const problems = [];
  const onError = (e) => problems.push(`crash: ${e.message.split("\n")[0]}`);
  const onConsole = (m) => { if (m.type() === "error") problems.push(`console: ${m.text().slice(0, 200)}`); };
  const onResponse = (r) => {
    const u = r.url();
    if (r.status() >= 400 && !u.includes("_rsc=")) problems.push(`http ${r.status()}: ${u.replace(BASE, "").slice(0, 120)}`);
  };
  const onFailed = (r) => {
    const t = r.failure()?.errorText ?? "";
    // requests cut short by the next navigation are normal
    if (/cancel|abort|access control checks|ERR_ABORTED/i.test(t) || r.url().includes("_rsc=")) return;
    problems.push(`request failed: ${t} ${r.url().replace(BASE, "").slice(0, 120)}`);
  };
  page.on("pageerror", onError); page.on("console", onConsole); page.on("response", onResponse); page.on("requestfailed", onFailed);
  return { problems, stop: () => { page.off("pageerror", onError); page.off("console", onConsole); page.off("response", onResponse); page.off("requestfailed", onFailed); } };
}

async function checkScreen(page, url) {
  const w = watch(page);
  const t = Date.now();
  let finalUrl = "";
  try {
    await page.goto(BASE + url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => w.problems.push("slow: still loading after 20s"));
    await sleep(900);
    finalUrl = page.url().replace(BASE, "");
    const info = await page.evaluate((errs) => {
      const vw = document.documentElement.clientWidth;
      const text = document.body.innerText;
      // something sticking out sideways that isn't inside a horizontal scroller
      const wide = [...document.querySelectorAll("body *")].filter((el) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.right <= vw + 2) return false;
        for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(p).overflowX)) return false;
        return true;
      }).slice(0, 2).map((el) => `${el.tagName.toLowerCase()}.${String(el.className).split(" ").slice(0, 3).join(".")}`);
      return {
        overflow: document.documentElement.scrollWidth > vw + 2 ? `page is ${document.documentElement.scrollWidth}px wide on a ${vw}px screen ${wide.join(" ")}` : wide.length ? `sticks out: ${wide.join(", ")}` : "",
        errorText: errs.find((re) => new RegExp(re.source, re.flags).test(text))?.source ?? "",
        heading: !!document.querySelector("h1"),
      };
    }, ERROR_TEXT.map((r) => ({ source: r.source, flags: r.flags })));
    if (info.overflow) w.problems.push(`overflow: ${info.overflow}`);
    if (info.errorText) w.problems.push(`error on screen: ${info.errorText}`);
    if (!info.heading) w.problems.push("no heading (h1)");
  } catch (e) {
    w.problems.push(`did not load: ${e.message.split("\n")[0]}`);
  }
  w.stop();
  return { url, finalUrl, ms: Date.now() - t, problems: w.problems };
}

// ---------------------------------------------------------------------------
// Sweep
// ---------------------------------------------------------------------------
async function sweepDevice(device) {
  const { engine, locales } = DEVICES[device];
  const browser = await engine.launch();
  const results = [];
  try {
    for (const role of Object.keys(SCREENS)) {
      const ctx = await newContext(browser, device, locales[0]);
      const page = await ctx.newPage();
      if (role !== "public") {
        try { await signIn(page, role, locales[0]); } catch (e) { results.push({ device, role, locale: locales[0], url: "(sign in)", problems: [`could not sign in: ${e.message.split("\n")[0]}`], ms: 0 }); await ctx.close(); continue; }
      }
      for (const locale of locales) {
        await page.evaluate((l) => localStorage.setItem("stayos-locale", l), locale).catch(() => {});
        for (const url of SCREENS[role]) {
          const r = await checkScreen(page, url);
          results.push({ device, role, locale, ...r });
          if (r.problems.length) await page.screenshot({ path: path.join(OUT, `sweep-${device}-${role}-${locale}-${url.replace(/[^a-z0-9]+/gi, "_")}.png`) }).catch(() => {});
          process.stdout.write(r.problems.length ? "x" : ".");
        }
      }
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
  return results;
}

async function sweep() {
  console.log(`Sweep of ${BASE}: ${Object.keys(DEVICES).join(", ")}`);
  const all = (await Promise.all(Object.keys(DEVICES).map(sweepDevice))).flat();
  console.log("");
  fs.writeFileSync(path.join(OUT, "sweep.json"), JSON.stringify(all, null, 1));
  const bad = all.filter((r) => r.problems.length);
  // group identical problems so one bug shows once with where it happens
  const groups = new Map();
  for (const r of bad) for (const p of r.problems) {
    const key = `${r.role} ${r.url} → ${p.replace(/\d{3,}ms/g, "")}`;
    const g = groups.get(key) ?? [];
    g.push(`${r.device}/${r.locale}`);
    groups.set(key, g);
  }
  const slow = [...all].sort((a, b) => b.ms - a.ms).slice(0, 6).map((r) => `${(r.ms / 1000).toFixed(1)}s ${r.device}/${r.locale} ${r.role} ${r.url}`);
  console.log(`\n${all.length} screen loads, ${bad.length} with problems`);
  for (const [k, where] of groups) console.log(`  ✗ ${k}  [${[...new Set(where)].join(", ")}]`);
  const median = [...all].map((r) => r.ms).sort((a, b) => a - b)[Math.floor(all.length / 2)];
  console.log(`  median load ${(median / 1000).toFixed(1)}s; slowest:\n    ${slow.join("\n    ")}`);
  return bad.length === 0;
}

// ---------------------------------------------------------------------------
// Flows: the main jobs, each across the people involved, on the shared demo hostel
// ---------------------------------------------------------------------------
const MSG = (file) => JSON.parse(fs.readFileSync(path.join(ROOT, `messages/en/${file}.json`), "utf8"));
const M = MSG("mobile").mobile;
const STAMP = new Date().toISOString().slice(5, 16).replace(/[-T:]/g, "");
const browsers = {};
const browserFor = async (device) => {
  const name = DEVICES[device].engine === webkit ? "webkit" : "chromium";
  return (browsers[name] ??= await DEVICES[device].engine.launch());
};
/** A signed-in (or signed-out) page for one person on one device. */
async function as(role, device, { locale = "en", install = false } = {}) {
  const ctx = await newContext(await browserFor(device), device, locale, { install, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log(`    (${role} page error: ${e.message.split("\n")[0]})`));
  if (process.env.E2E_DEBUG) page.on("response", async (r) => {
    const u = r.url();
    if (u.includes("/rest/v1/") && r.request().method() !== "GET" && !u.includes("/rpc/")) console.log(`    [${role} save] ${u.split("/rest/v1/")[1].split("?")[0]} ${r.status()} ${(await r.text().catch(() => "")).slice(0, 160)}`);
  });
  if (role) await signIn(page, role, locale);
  return { page, close: () => ctx.close() };
}
const go = async (page, url) => {
  await page.goto(BASE + url, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  // wait for the hostel's data: loading placeholders gone
  await page.waitForFunction(() => document.querySelectorAll(".animate-pulse").length === 0, null, { timeout: 15000 }).catch(() => {});
  await sleep(800);
};
/** Waits until `check` returns something truthy, reloading now and then (live updates arrive every few seconds). */
async function eventually(page, check, what, { timeout = 30000, reloadEvery = 10000 } = {}) {
  const t0 = Date.now();
  let lastReload = Date.now();
  while (Date.now() - t0 < timeout) {
    const v = await check().catch(() => null);
    if (v) return v;
    if (Date.now() - lastReload > reloadEvery) { await page.reload({ waitUntil: "domcontentloaded" }); await page.waitForLoadState("networkidle").catch(() => {}); lastReload = Date.now(); }
    await sleep(700);
  }
  await page.screenshot({ path: path.join(OUT, `flow-${what.replace(/[^a-z0-9]+/gi, "_").slice(0, 60)}.png`) }).catch(() => {});
  throw new Error(`timed out: ${what}`);
}
const flow = (name, run) => FLOWS.push({ name, run });
export const FLOWS = [];

/** Puts the demo in the state the flows need (the snapshot restore undoes it): Anjali has a bill to pay and eats tonight. */
async function setUpDemo() {
  const { default: pg } = await import("pg");
  const { default: dotenv } = await import("dotenv");
  dotenv.config({ path: path.join(ROOT, ".env.local"), quiet: true });
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL?.replace("sslmode=require", "sslmode=verify-full") });
  await db.connect();
  try {
    // a fresh browser starts the sample hostel's clock at Fri 27 Nov 2026, 10:24
    const today = "2026-11-27";
    const [{ id: org }] = (await db.query("select id from public.orgs where is_demo limit 1")).rows;
    await db.query(`update public.invoices set status = 'unpaid', paid_on = null, method = null, utr = null, paid_via = null
      where org_id = $1 and id = (select id from public.invoices where org_id = $1 and resident_id = 'R-1042' order by month desc limit 1)`, [org]);
    await db.query(`update public.meal_optouts set meals = array_remove(meals, 'dinner') where org_id = $1 and resident_id = 'R-1042' and date between $2::date - 1 and $2::date + 1`, [org, today]);
  } finally { await db.end(); }
}

flow("Sign-in errors are readable", async () => {
  const { page, close } = await as(null, "desktop-chrome");
  try {
    await go(page, "/login/");
    await page.locator("#email").fill("nobody-e2e@example.com");
    await page.locator("#password").fill("wrong-password-123");
    await page.locator("form").getByRole("button", { name: /^sign in$/i }).click();
    const msg = await eventually(page, async () => {
      const t = await page.locator('[role="alert"]').first().textContent({ timeout: 500 });
      return t?.trim();
    }, "login error message", { timeout: 20000, reloadEvery: 1e9 });
    if (/object Object|undefined|null/.test(msg)) throw new Error(`unreadable error: ${msg}`);
    return `"${msg}"`;
  } finally { await close(); }
});

flow("Sign-up and password-reset forms check what is typed", async () => {
  const { page, close } = await as(null, "iphone");
  try {
    await go(page, "/signup/");
    await page.locator("form").getByRole("button").last().click();
    await eventually(page, async () => (await page.locator('[aria-invalid="true"], [role="alert"]').count()) > 0, "signup errors", { timeout: 8000, reloadEvery: 1e9 });
    await go(page, "/forgot-password/");
    await page.locator("#email").fill("not-an-email");
    await page.locator("form").getByRole("button").last().click();
    await eventually(page, async () => page.getByText("Enter a valid email address.").isVisible(), "reset email check", { timeout: 8000, reloadEvery: 1e9 });
  } finally { await close(); }
});

flow("Each person only reaches their own app", async () => {
  const out = [];
  const cases = [[null, "/dashboard/", (u) => !u.includes("/dashboard")], ["resident", "/dashboard/rent/", (u) => !u.includes("/dashboard")],
    ["parent", "/resident/", (u) => u.includes("/parent")], ["resident", "/parent/", (u) => u.includes("/resident")]];
  for (const [role, url, okUrl] of cases) {
    const { page, close } = await as(role, "desktop-chrome");
    try {
      await go(page, url);
      await sleep(1500);
      const final = page.url().replace(BASE, "");
      if (!okUrl(final)) throw new Error(`${role ?? "signed out"} opening ${url} stayed on ${final}`);
      out.push(`${role ?? "signed out"} ${url}→${final}`);
    } finally { await close(); }
  }
  return out.join("; ");
});

flow("Resident's complaint reaches the warden, and the fix reaches the resident", async () => {
  const res = await as("resident", "iphone");
  const war = await as("warden", "desktop-chrome");
  try {
    await go(res.page, "/resident/help/new/");
    await res.page.getByRole("radiogroup", { name: M.help.what }).getByRole("radio").first().click();
    await res.page.locator("#cm-desc").fill(`E2E test ${STAMP}: tap in the bathroom is leaking`);
    await res.page.getByRole("button", { name: M.help.submit }).click();
    const id = await eventually(res.page, async () => (await res.page.getByText(/Complaint (CMP-[\w-]+) sent/).textContent({ timeout: 500 }))?.match(/CMP-[\w-]+/)?.[0], "complaint sent", { reloadEvery: 1e9 });

    await go(war.page, "/dashboard/complaints/");
    const card = war.page.getByText(`E2E test ${STAMP}`).first();
    await eventually(war.page, () => card.isVisible(), `warden sees ${id}`);
    await card.click();
    await war.page.getByRole("button", { name: "Start work" }).click();
    await war.page.getByRole("button", { name: "Mark resolved" }).click();
    await sleep(1500);

    await go(res.page, "/resident/help/");
    const fixed = M.help.status.resolved;
    await eventually(res.page, async () => {
      const item = res.page.locator("li, a, div").filter({ hasText: `E2E test ${STAMP}` }).last();
      return (await item.textContent({ timeout: 500 }))?.includes(fixed);
    }, `resident sees ${id} as ${fixed}`);
    return id;
  } finally { await res.close(); await war.close(); }
});

flow("Gate pass: resident asks, parent approves, resident has the pass", async () => {
  const res = await as("resident", "iphone");
  const par = await as("parent", "android");
  const dest = `E2E trip ${STAMP}`;
  try {
    await go(res.page, "/resident/gate/");
    await res.page.getByRole("button", { name: M.gate.request }).click();
    await res.page.locator("#gp-dest").fill(dest);
    await res.page.getByRole("button", { name: /Send to .* for approval/ }).click();
    await sleep(1500);

    await go(par.page, "/parent/");
    const ask = par.page.locator("section, div").filter({ hasText: dest }).filter({ has: par.page.getByRole("button", { name: M.parent.approve }) }).last();
    await eventually(par.page, () => ask.isVisible(), "parent sees the request");
    await ask.getByRole("button", { name: M.parent.approve }).click();
    await eventually(par.page, async () => !(await ask.isVisible()), "parent's approve card goes away", { reloadEvery: 1e9 });
    await sleep(1500);

    // after a reload (server data only): the request is no longer waiting
    await go(res.page, "/resident/gate/");
    await eventually(res.page, async () => {
      const t = await res.page.locator("body").innerText();
      return t.includes(dest) && !t.includes("Waiting for");
    }, "resident's request no longer waiting");
  } finally { await res.close(); await par.close(); }
});

flow("Resident pays rent and the owner's books show it", async () => {
  const res = await as("resident", "iphone");
  try {
    await go(res.page, "/resident/pay/");
    if (await res.page.getByText(M.pay.nothingDue).isVisible().catch(() => false)) return "nothing due for Anjali, skipped";
    const inv = (await res.page.locator("body").textContent()).match(/INV-\d{4}-\d{4}/)?.[0];
    await res.page.getByRole("button", { name: /^Pay ₹/ }).click();
    await eventually(res.page, () => res.page.getByText(/₹[\d,]+ paid/).isVisible(), "payment done", { timeout: 30000, reloadEvery: 1e9 });
    const own = await as("owner", "desktop-chrome");
    try {
      await go(own.page, "/dashboard/rent/");
      const search = own.page.getByPlaceholder(/invoice|search/i).first();
      await search.fill(inv);
      await eventually(own.page, async () => {
        const row = own.page.locator("tr, li").filter({ hasText: inv }).first();
        return /paid/i.test((await row.textContent({ timeout: 500 })) ?? "");
      }, `owner sees ${inv} paid`, { timeout: 40000 });
    } finally { await own.close(); }
    return inv;
  } finally { await res.close(); }
});

flow("Skipping a meal lowers the kitchen count, undoing raises it", async () => {
  const res = await as("resident", "iphone");
  const war = await as("warden", "desktop-chrome");
  const dinnerCount = async () => {
    const nums = await war.page.locator('[data-tour="headcount"] .text-kpi').allTextContents();
    return Number((nums[3] ?? "").replace(/\D/g, "")) || null;
  };
  try {
    await go(war.page, "/dashboard/mess/");
    await sleep(2500);
    const before = await dinnerCount();
    await go(res.page, "/resident/mess/");
    const dinner = res.page.getByRole("switch", { name: /Eating Dinner/i });
    if ((await dinner.getAttribute("aria-checked")) !== "true") return "Anjali already skips tonight's dinner, skipped";
    await dinner.click();
    await eventually(war.page, async () => { await sleep(1800); return (await dinnerCount()) === before - 1; }, `kitchen dinner ${before} → ${before - 1}`, { timeout: 40000 });
    await dinner.click();
    await eventually(war.page, async () => { await sleep(1800); return (await dinnerCount()) === before; }, `kitchen dinner back to ${before}`, { timeout: 40000 });
    return `dinner ${before} → ${before - 1} → ${before}`;
  } finally { await res.close(); await war.close(); }
});

flow("Owner checks in a new resident; the warden sees them", async () => {
  const own = await as("owner", "desktop-chrome");
  const war = await as("warden", "iphone");
  const name = `E2E Tester ${STAMP}`;
  try {
    await go(own.page, "/dashboard/rooms/");
    await own.page.locator('[data-tour="checkin-button"]').click();
    await own.page.locator("#ci-name").fill(name);
    await own.page.locator('[data-tour="checkin-next0"]').click();
    await own.page.locator('[data-tour="kyc-start"]').click();
    await eventually(own.page, () => own.page.locator('[data-tour="checkin-next"]').isEnabled(), "KYC finished", { timeout: 20000, reloadEvery: 1e9 });
    await own.page.locator('[data-tour="checkin-next"]').click();
    await own.page.locator('[data-tour="checkin-next2"]').click();
    await own.page.locator('[data-tour="checkin-complete"]').click();
    const done = await eventually(own.page, async () => (await own.page.getByText(/checked in to [A-C]-\d{3}-\d/).first().textContent({ timeout: 500 })), "check-in done", { reloadEvery: 1e9 });

    await go(war.page, "/dashboard/residents/");
    await war.page.getByPlaceholder(/search|name/i).first().fill("E2E Tester");
    await eventually(war.page, () => war.page.getByText(name).first().isVisible(), "warden sees the new resident");
    return done.trim();
  } finally { await own.close(); await war.close(); }
});

flow("Owner adds an expense", async () => {
  const own = await as("owner", "desktop-safari");
  try {
    await go(own.page, "/dashboard/expenses/");
    await own.page.getByRole("button", { name: "Add expense" }).first().click();
    await own.page.locator("#ex-vendor").fill(`E2E Vendor ${STAMP}`);
    await own.page.locator("#ex-amount").fill("1234");
    await own.page.locator("#ex-desc").fill("E2E test expense");
    await own.page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
    // the name is also in a hidden announcement for screen readers; look for the visible row
    await eventually(own.page, async () => (await own.page.getByText(`E2E Vendor ${STAMP}`).filter({ visible: true }).count()) > 0, "expense listed", { reloadEvery: 1e9 });
  } finally { await own.close(); }
});

flow("Ask StayOS answers in English and Malayalam", async () => {
  const answers = [];
  for (const [locale, q] of [["en", "Who hasn't paid rent?"], ["ml", "ആരൊക്കെ വാടക അടയ്ക്കാനുണ്ട്?"]]) {
    const own = await as("owner", "iphone", { locale });
    try {
      await go(own.page, "/dashboard/");
      await own.page.getByRole("button", { name: "Ask StayOS" }).first().click();
      const input = own.page.locator('input[data-tour="ask-input"]');
      await input.fill(q);
      await input.press("Enter");
      const a = await eventually(own.page, async () => {
        const t = await own.page.getByRole("dialog").textContent({ timeout: 500 });
        return /₹[\d,]+/.test(t ?? "") ? t.match(/₹[\d,]+/)[0] : null;
      }, `assistant answers in ${locale}`, { timeout: 20000, reloadEvery: 1e9 });
      answers.push(`${locale}: ${a}`);
    } finally { await own.close(); }
  }
  return answers.join(", ");
});

flow("Owner switches views on the phone", async () => {
  const own = await as("owner", "iphone");
  try {
    await go(own.page, "/dashboard/");
    await own.page.getByRole("button", { name: /View as: Owner/ }).click();
    await own.page.getByRole("radio", { name: /^Warden/ }).click();
    await go(own.page, "/dashboard/more/");
    if (await own.page.getByText("Settings & billing").isVisible().catch(() => false)) throw new Error("warden view still shows Settings & billing");
    await own.page.getByRole("button", { name: /View as: Warden/ }).click();
    await own.page.getByRole("radio", { name: /^Resident/ }).click();
    await own.page.waitForURL(/\/resident\//, { timeout: 15000 });
    await sleep(1500);
    await own.page.getByRole("button", { name: "Open settings" }).click();
    await own.page.getByRole("dialog").getByRole("button", { name: "Owner", exact: true }).click();
    await own.page.waitForURL(/\/dashboard\//, { timeout: 15000 });
    await eventually(own.page, () => own.page.getByRole("button", { name: /View as: Owner/ }).isVisible(), "back to owner", { timeout: 8000, reloadEvery: 1e9 });
  } finally { await own.close(); }
});

flow("A warden can't open the hostel's money", async () => {
  const war = await as("warden", "desktop-chrome");
  try {
    for (const url of ["/dashboard/expenses/", "/dashboard/reports/", "/dashboard/settings/"]) {
      await go(war.page, url);
      if (!(await war.page.getByText("Only the owner sees this page").filter({ visible: true }).count())) throw new Error(`${url} is not locked for the warden`);
      if (await war.page.getByRole("button", { name: /Switch to owner/i }).isVisible().catch(() => false)) throw new Error(`${url} offers the warden a switch to the owner's view`);
    }
    await go(war.page, "/dashboard/");
    await war.page.getByRole("button", { name: "Ask StayOS" }).first().click();
    const input = war.page.locator('input[data-tour="ask-input"]');
    await input.fill("What is this month's profit?");
    await input.press("Enter");
    await eventually(war.page, async () => /Only the hostel owner/.test((await war.page.getByRole("dialog").textContent({ timeout: 500 })) ?? ""), "assistant keeps profit to the owner", { timeout: 15000, reloadEvery: 1e9 });
    return "expenses, reports, settings locked; assistant declines profit";
  } finally { await war.close(); }
});

flow("Every settings tab opens for the owner", async () => {
  const own = await as("owner", "desktop-chrome");
  try {
    await go(own.page, "/dashboard/settings/");
    const tabs = own.page.getByRole("tab");
    const n = await tabs.count();
    const names = [];
    for (let i = 0; i < n; i++) {
      await tabs.nth(i).click();
      await sleep(700);
      names.push((await tabs.nth(i).textContent()).trim());
      const text = await own.page.locator("main").textContent();
      if (/Couldn't load|object Object/.test(text)) throw new Error(`settings tab ${names.at(-1)} shows an error`);
    }
    return names.join(", ");
  } finally { await own.close(); }
});

flow("Language and dark mode stay after reloading", async () => {
  const own = await as("owner", "iphone");
  try {
    await go(own.page, "/dashboard/more/");
    // dark first: once the app is in Malayalam the "Dark" option is labelled in Malayalam too
    for (const name of ["Dark", "മലയാളം"]) {
      const r = own.page.getByRole("radio", { name }).first();
      await r.evaluate((el) => el.scrollIntoView({ block: "center" }));
      await r.click();
      await sleep(600);
    }
    await own.page.reload({ waitUntil: "domcontentloaded" });
    // the page's text appears once the hostel has loaded, which can take a few seconds on a phone
    await own.page.waitForFunction(() => /കൂടുതൽ/.test(document.body.innerText), null, { timeout: 15000 }).catch(() => {});
    const state = await own.page.evaluate(() => ({ dark: document.documentElement.classList.contains("dark"), ml: /കൂടുതൽ/.test(document.body.innerText) }));
    if (!state.dark || !state.ml) throw new Error(`after reload: dark ${state.dark}, Malayalam ${state.ml}`);
  } finally { await own.close(); }
});

flow("The install offer shows on phones, not on desktops", async () => {
  const phone = await as(null, "android", { install: true });
  const desk = await as(null, "desktop-chrome", { install: true });
  try {
    await go(phone.page, "/");
    await go(desk.page, "/");
    await eventually(phone.page, () => phone.page.getByText(/Install StayOS/).isVisible(), "install offer on the phone", { timeout: 12000, reloadEvery: 1e9 });
    await sleep(3500);
    if (await desk.page.getByText(/Install StayOS/).isVisible().catch(() => false)) throw new Error("the install offer popped up on a desktop");
  } finally { await phone.close(); await desk.close(); }
});

flow("Residents list exports a CSV", async () => {
  const own = await as("owner", "desktop-chrome");
  try {
    await go(own.page, "/dashboard/residents/");
    const [dl] = await Promise.all([own.page.waitForEvent("download", { timeout: 15000 }), own.page.getByRole("button", { name: /Export/i }).first().click()]);
    const file = path.join(OUT, dl.suggestedFilename());
    await dl.saveAs(file);
    const lines = fs.readFileSync(file, "utf8").trim().split(/\r?\n/);
    if (lines.length < 10) throw new Error(`only ${lines.length} lines in ${dl.suggestedFilename()}`);
    return `${dl.suggestedFilename()}, ${lines.length - 1} residents`;
  } finally { await own.close(); }
});

flow("WhatsApp inbox opens and sends", async () => {
  const own = await as("owner", "desktop-chrome");
  try {
    await go(own.page, "/dashboard/");
    await own.page.getByRole("button", { name: /WhatsApp/ }).first().click();
    const panel = own.page.locator('[aria-label*="WhatsApp" i]').last();
    await sleep(800);
    await own.page.getByRole("button").filter({ hasText: /Anjali|Rajesh|Menon/ }).first().click();
    const box = own.page.getByPlaceholder(/message/i).last();
    await box.fill(`E2E test message ${STAMP}`);
    await box.press("Enter");
    await eventually(own.page, () => own.page.getByText(`E2E test message ${STAMP}`).first().isVisible(), "message in the chat", { timeout: 10000, reloadEvery: 1e9 });
    void panel;
  } finally { await own.close(); }
});

flow("Public pages have their own titles, search files, safe headers and a 404 that leads home", async () => {
  const titles = new Map();
  for (const url of SCREENS.public) {
    const html = await (await fetch(BASE + url)).text();
    const title = html.match(/<title>([^<]*)/)?.[1] ?? "";
    if (titles.has(title)) throw new Error(`${url} has the same title as ${titles.get(title)}: "${title}"`);
    titles.set(title, url);
  }
  const robots = await fetch(BASE + "/robots.txt");
  if (robots.status !== 200 || !(await robots.text()).includes("Disallow: /dashboard/")) throw new Error(`robots.txt: ${robots.status}`);
  const sitemap = await fetch(BASE + "/sitemap.xml");
  if (sitemap.status !== 200 || !(await sitemap.text()).includes("/pricing/</loc>")) throw new Error(`sitemap.xml: ${sitemap.status}`);
  const res = await fetch(BASE + "/dashboard/");
  for (const h of ["x-frame-options", "x-content-type-options", "referrer-policy", "content-security-policy"]) if (!res.headers.get(h)) throw new Error(`no ${h} header`);
  const visitor = await as(null, "iphone");
  try {
    const r = await visitor.page.goto(BASE + "/no-such-page/", { waitUntil: "domcontentloaded" });
    if (r?.status() !== 404) throw new Error(`unknown page answered ${r?.status()}`);
    await visitor.page.getByRole("link", { name: "Go to the home page" }).click();
    await visitor.page.waitForURL(BASE + "/", { timeout: 15000 });
  } finally { await visitor.close(); }
  return `${titles.size} titles, robots, sitemap, headers, 404 → home`;
});

flow("Payment service is up and only answers StayOS", async () => {
  const env = fs.readFileSync(path.join(ROOT, ".env.production"), "utf8");
  const url = env.match(/NEXT_PUBLIC_PAYMENTS_URL="?([^"\n]+)/)?.[1];
  if (!url) return "no payments URL configured, skipped";
  const health = await fetch(`${url}/health`, { headers: { Origin: BASE } });
  if (!health.ok) throw new Error(`health ${health.status}`);
  const evil = await fetch(`${url}/health`, { headers: { Origin: "https://evil.example" } });
  const acao = evil.headers.get("access-control-allow-origin");
  if (acao && acao !== BASE && acao !== "null") throw new Error(`answers other sites: ${acao}`);
  const anon = await fetch(`${url}/connection`, { headers: { Origin: BASE } });
  if (anon.status < 400) throw new Error(`/connection without sign-in returned ${anon.status}`);
  return `health ${health.status}, foreign origin not allowed, no sign-in → ${anon.status}`;
});
async function flows() {
  console.log(`\nFlows on ${BASE}`);
  execFileSync("node", [path.join(ROOT, "scripts/demo-snapshot.mjs"), "save"], { stdio: "inherit" });
  let ok = true;
  try {
    await setUpDemo();
    for (const f of FLOWS.filter((x) => !ONLY || new RegExp(ONLY, "i").test(x.name))) {
      const t = Date.now();
      try {
        const notes = (await f.run()) ?? "";
        console.log(`  ✓ ${f.name} (${((Date.now() - t) / 1000).toFixed(0)}s)${notes ? ` · ${notes}` : ""}`);
      } catch (e) {
        ok = false;
        console.log(`  ✗ ${f.name}: ${e.message.split("\n")[0]}`);
      }
    }
  } finally {
    for (const b of Object.values(browsers)) await b.close().catch(() => {});
    execFileSync("node", [path.join(ROOT, "scripts/demo-snapshot.mjs"), "restore"], { stdio: "inherit" });
  }
  return ok;
}

let pass = true;
if (RUN_SWEEP) pass = (await sweep()) && pass;
if (RUN_FLOWS && FLOWS.length) pass = (await flows()) && pass;
console.log(pass ? "\nAll checks passed" : "\nSome checks failed (screenshots in .e2e/)");
process.exit(pass ? 0 : 1);
