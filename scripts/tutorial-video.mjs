// Malayalam tutorial videos of StayOS, recorded from the live demo.
//
// It drives the demo as an iPhone (WebKit, the engine inside Safari), shows the app in Malayalam with a caption
// and a tap marker on screen, puts a Malayalam voice under every step, and writes MP4s to tutorial-videos/.
//
//   npm run tutorial:video                    record all four parts and the full video
//   npm run tutorial:video -- resident        record one part (owner, resident, parent, install)
//   npm run tutorial:video -- all --dry       quick check: runs every step, saves a screenshot per step, no video
//
// One-time setup (see README → Tutorial videos):
//   npx playwright install webkit
//   python3 -m venv .venv-tts && .venv-tts/bin/pip install edge-tts
//
// Env: TUTORIAL_BASE (default https://stayos.space), EDGE_TTS (path to edge-tts), TUTORIAL_VOICE
// (default ml-IN-SobhanaNeural; ml-IN-MidhunNeural is the male voice).
//
// The demo hostel is shared. The parts only look around, except the resident part, which skips a meal and changes
// where lunch is had on screen; it notes how that day was before recording and puts it back afterwards.
// The owner part's second clip checks in a resident the way a real hostel does (Aadhaar seen in person, police
// reference number). It films a temporary hostel that it creates in the database for the demo owner and deletes
// afterwards, so it needs DATABASE_URL in .env.local. Other people trying the demo still land in the sample hostel.
import { webkit, devices } from "playwright";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import FFMPEG from "ffmpeg-static";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.TUTORIAL_BASE ?? "https://stayos.space";
const VOICE = process.env.TUTORIAL_VOICE ?? "ml-IN-SobhanaNeural";
const LOCAL_TTS = path.join(ROOT, ".venv-tts/bin/edge-tts");
const TTS = process.env.EDGE_TTS ?? (fs.existsSync(LOCAL_TTS) ? LOCAL_TTS : "edge-tts");
const OUT = path.join(ROOT, "tutorial-videos");
const WORK = path.join(OUT, ".work");
fs.mkdirSync(WORK, { recursive: true });

const argv = process.argv.slice(2);
const DRY = argv.includes("--dry");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// On-screen kit, injected into every page: caption box, full-screen title card, tap marker
// ---------------------------------------------------------------------------
const PAGE_KIT = () => {
  const css = `
  #tut-cap{position:fixed;left:12px;right:12px;bottom:calc(96px + env(safe-area-inset-bottom));z-index:2147483646;pointer-events:none;
    background:rgba(16,16,15,.88);color:#fff;font-family:inherit;font-weight:600;font-size:17px;line-height:1.5;padding:11px 15px;border-radius:16px;
    text-align:center;box-shadow:0 10px 30px -8px rgba(0,0,0,.45);transition:opacity .25s}
  #tut-cap:empty{opacity:0}
  #tut-title{position:fixed;inset:0;z-index:2147483647;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;
    background:var(--canvas,#f7f7f5);color:var(--fg,#191917);font-family:inherit;text-align:center;padding:32px;transition:opacity .35s}
  #tut-title h1{font-size:30px;line-height:1.35;font-weight:700;margin:0;letter-spacing:-.01em}
  #tut-title p{font-size:18px;line-height:1.55;margin:0;color:var(--fg-2,#6e6c65)}
  #tut-title .tag{font-size:15px;font-weight:600;color:var(--brand,#0c7366);letter-spacing:.02em}
  .tut-tap{position:fixed;z-index:2147483647;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;pointer-events:none;
    background:rgba(12,115,102,.28);border:3px solid rgba(12,115,102,.9);animation:tut-tap .7s ease-out forwards}
  @keyframes tut-tap{from{transform:scale(.5);opacity:1}to{transform:scale(1.5);opacity:0}}`;
  const logo = `<svg viewBox="0 0 24 24" width="84" height="84"><rect width="24" height="24" rx="6" fill="#0c7366"/><path d="M8 18.5V10a4 4 0 0 1 8 0v8.5" fill="none" stroke="white" stroke-width="1.75" stroke-linecap="round"/><circle cx="12" cy="12.6" r="1.35" fill="white"/><rect x="11.4" y="13.2" width="1.2" height="2.6" rx="0.6" fill="white"/></svg>`;
  const render = () => {
    if (!document.body || location.protocol === "about:") return;
    if (!document.getElementById("tut-style")) {
      const s = document.createElement("style");
      s.id = "tut-style";
      s.textContent = css;
      document.head.appendChild(s);
    }
    let cap = document.getElementById("tut-cap");
    if (!cap) { cap = document.createElement("div"); cap.id = "tut-cap"; document.body.appendChild(cap); }
    cap.textContent = sessionStorage.getItem("tut-cap") ?? "";
    const t = JSON.parse(sessionStorage.getItem("tut-title") ?? "null");
    let el = document.getElementById("tut-title");
    if (t && !el) { el = document.createElement("div"); el.id = "tut-title"; document.body.appendChild(el); }
    if (t) el.innerHTML = `${logo}<div class="tag">${t.tag}</div><h1>${t.title}</h1><p>${t.sub ?? ""}</p>`;
    else if (el) el.remove();
  };
  window.__tutRender = render;
  document.addEventListener("DOMContentLoaded", render);
  // React replaces the body while it loads, which drops anything added before; put the kit back
  setInterval(() => {
    if (!document.body || location.protocol === "about:") return;
    const wantTitle = JSON.parse(sessionStorage.getItem("tut-title") ?? "null");
    if (!document.getElementById("tut-cap") || (wantTitle && !document.getElementById("tut-title"))) render();
  }, 150);
  window.addEventListener("pointerdown", (e) => {
    const d = document.createElement("div");
    d.className = "tut-tap";
    d.style.left = e.clientX + "px";
    d.style.top = e.clientY + "px";
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 800);
  }, true);
};

async function setCap(p, text) {
  await p.evaluate((t) => { sessionStorage.setItem("tut-cap", t ?? ""); window.__tutRender?.(); }, text ?? "").catch(() => {});
}
async function setTitle(p, t) {
  await p.evaluate((t) => { sessionStorage.setItem("tut-title", JSON.stringify(t)); window.__tutRender?.(); }, t).catch(() => {});
}
async function tap(p, locator) {
  await locator.first().scrollIntoViewIfNeeded().catch(() => {});
  await sleep(250);
  await locator.first().click();
}
/** Taps a switch or radio until it reports the wanted state (a tap can land while the page is still updating). */
async function setChecked(p, locator, want) {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (((await locator.getAttribute("aria-checked")) === "true") === want) return;
    await tap(p, locator);
    for (let i = 0; i < 20; i++) {
      await sleep(100);
      if (((await locator.getAttribute("aria-checked")) === "true") === want) return;
    }
  }
  console.log(`  warning: ${locator} did not become ${want}`);
}
async function scrollBy(p, dy, steps = 12) {
  // the dashboard scrolls the window; the resident and parent apps scroll #app-scroll
  for (let i = 0; i < steps; i++) {
    await p.evaluate((d) => {
      const el = document.getElementById("app-scroll");
      if (el && el.scrollHeight > el.clientHeight) el.scrollTop += d; else window.scrollBy(0, d);
    }, dy / steps);
    await sleep(40);
  }
}
const tab = (p, name) => p.locator('nav[aria-label="App"] a').filter({ hasText: name });
async function signIn(p, person, home) {
  await p.goto(BASE + "/demo/", { waitUntil: "domcontentloaded" });
  await p.waitForLoadState("networkidle").catch(() => {});
  await p.getByRole("button").filter({ hasText: person }).first().click();
  await p.waitForURL(home, { timeout: 40000 });
  await sleep(2500);
}

// The resident part changes these on screen; they are noted before recording and put back after.
const DEMO_DAY = 6; // the 7th day on the resident's Mess screen
const residentMeals = (p) => {
  // breakfast, lunch and dinner each have a place picker; the videos use lunch's
  const place = p.getByRole("radiogroup", { name: /^ഉച്ചഭക്ഷണം എവിടെ/ });
  return {
    dinner: p.getByRole("switch", { name: /അത്താഴം/ }),
    lunch: p.getByRole("switch", { name: /ഉച്ചഭക്ഷണം/ }),
    hostel: place.getByRole("radio", { name: "ഹോസ്റ്റലിൽ" }),
    institute: place.getByRole("radio", { name: "സ്ഥാപനത്തിൽ" }),
    // shown once lunch is at the hostel: the resident's own block first ("· നിങ്ങളുടേത്"), then the others
    blocks: p.getByRole("radiogroup", { name: /^ഉച്ചഭക്ഷണം ഏത് ബ്ലോക്കിൽ/ }).getByRole("radio"),
  };
};
/** Where lunch is on the demo day: "institute", or the name on the block chip that is on. */
async function lunchPlace(p) {
  const m = residentMeals(p);
  if ((await m.institute.getAttribute("aria-checked")) === "true") return "institute";
  for (const chip of await m.blocks.all()) if ((await chip.getAttribute("aria-checked")) === "true") return (await chip.innerText()).trim();
  return "hostel";
}
async function setLunchPlace(p, where) {
  const m = residentMeals(p);
  if (where === "institute") return setChecked(p, m.institute, true);
  await setChecked(p, m.hostel, true);
  await sleep(400);
  const chip = where === "hostel" ? m.blocks.first() : m.blocks.filter({ hasText: where }).first();
  if (await chip.count()) await setChecked(p, chip, true);
}
async function openDemoDay(p) {
  await p.goto(BASE + "/resident/mess/", { waitUntil: "domcontentloaded" });
  await sleep(3000);
  await p.getByRole("tab").nth(DEMO_DAY).click();
  await sleep(600);
}

// The owner part's second clip films a real (not sample) hostel: check-in asks for the original Aadhaar card and the
// police form takes the station's reference number. This makes one for the demo owner, set up like a new sign-up
// with an empty layout (Block A for men, Block B for women), and deletes it afterwards.
const REAL_ORG = "00000000-0000-0000-0000-0000007e0201";
async function realHostel(action) {
  const { default: pg } = await import("pg");
  const { default: dotenv } = await import("dotenv");
  dotenv.config({ path: path.join(ROOT, ".env.local"), quiet: true });
  if (!process.env.DATABASE_URL) throw new Error("The owner part needs DATABASE_URL in .env.local (it makes a temporary hostel)");
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL.replace("sslmode=require", "sslmode=verify-full") });
  await db.connect();
  try {
    await db.query("delete from public.orgs where id = $1", [REAL_ORG]);
    if (action !== "create") return;
    const { rows: [owner] } = await db.query(`select m.user_id, m.name, m.email from public.members m join public.orgs o on o.id = m.org_id where o.is_demo and m.role = 'owner' limit 1`);
    await db.query(`insert into public.orgs (id, name, city, owner_name, created_by, settings, trial_ends_at)
      values ($1, 'Green Valley Hostel', 'Kozhikode', $2, $3, '{"clock": {"mode": "real"}, "blocks": []}', now() + interval '14 days')`, [REAL_ORG, owner.name, owner.user_id]);
    await db.query(`insert into public.members (org_id, user_id, role, name, email) values ($1, $2, 'owner', $3, $4)`, [REAL_ORG, owner.user_id, owner.name, owner.email]);
    await db.query("select app.build_layout($1, 2, 2, 4, 0)", [REAL_ORG]);
    await db.query(`update public.orgs set settings = settings || jsonb_build_object('blocks', jsonb_build_array(
      jsonb_build_object('id', 'A', 'name', 'Block A', 'gender', 'M', 'floors', 2, 'curfew', '22:00'),
      jsonb_build_object('id', 'B', 'name', 'Block B', 'gender', 'F', 'floors', 2, 'curfew', '21:30'))) where id = $1`, [REAL_ORG]);
  } finally { await db.end(); }
}

// ---------------------------------------------------------------------------
// The videos. Each scene: cap (caption), say (narration), act (what happens on screen while it is said).
// A part can have several segments (the install part films an iPhone, then an Android phone).
// ---------------------------------------------------------------------------
const END = (say) => ({
  say,
  act: async (p) => { await setCap(p, ""); await setTitle(p, { tag: "stayos.space", title: "നന്ദി", sub: "14 ദിവസം സൗജന്യമായി പരീക്ഷിക്കാം" }); },
});

const VIDEOS = {
  owner: { file: "1-owner-warden", segments: [{
    device: "iPhone 15",
    start: "/",
    scenes: [
      { title: { tag: "StayOS ട്യൂട്ടോറിയൽ · ഭാഗം 1", title: "ഉടമയും വാർഡനും", sub: "ഹോസ്റ്റൽ നടത്തിപ്പ് ഫോണിൽ നിന്ന്" },
        say: "സ്റ്റേ ഒ.എസ്. ട്യൂട്ടോറിയലിലേക്ക് സ്വാഗതം. ഈ ഭാഗത്തിൽ, ഹോസ്റ്റൽ ഉടമയും വാർഡനും ആപ്പ് എങ്ങനെ ഉപയോഗിക്കാമെന്ന് നോക്കാം." },
      { cap: "stayos.space തുറന്ന് ‘ലൈവ് ഡെമോ പരീക്ഷിക്കുക’ ടാപ്പ് ചെയ്യുക",
        say: "ആദ്യം, ഫോണിൽ സ്റ്റേ ഒ.എസ്. ഡോട്ട് സ്പേസ് തുറക്കുക. സാമ്പിൾ ഹോസ്റ്റൽ കാണാൻ, ലൈവ് ഡെമോ പരീക്ഷിക്കുക എന്ന ബട്ടൺ ടാപ്പ് ചെയ്യുക.",
        act: async (p) => { await setTitle(p, null); await sleep(2600); await tap(p, p.getByRole("link", { name: "ലൈവ് ഡെമോ പരീക്ഷിക്കുക" })); } },
      { cap: "‘ഉടമ’ ആയി സൈൻ ഇൻ ചെയ്യുക",
        say: "ഇവിടെ ഉടമ, വാർഡൻ, താമസക്കാരി, രക്ഷിതാവ് എന്നിങ്ങനെ നാല് പേരായി ആപ്പ് കാണാം. നമുക്ക് ഉടമയായി തുടങ്ങാം.",
        act: async (p) => { await sleep(3800); await tap(p, p.getByRole("button").filter({ hasText: "റഷീദ്" })); await p.waitForURL(/\/dashboard\//, { timeout: 40000 }); } },
      { cap: "ഹോം: ഒക്യുപൻസി, വാടക, ലാഭം, പരാതികൾ — ഒറ്റനോട്ടത്തിൽ",
        say: "ഇതാണ് ഉടമയുടെ ഹോം സ്ക്രീൻ. എത്ര കിടക്കകളിൽ ആളുണ്ട്, ഈ മാസം എത്ര വാടക പിരിഞ്ഞു, എത്ര ബാക്കിയുണ്ട്, ലാഭം എത്ര, തുറന്ന പരാതികൾ എത്ര — എല്ലാം ഇവിടെ ഒറ്റനോട്ടത്തിൽ കാണാം.",
        act: async (p) => { await sleep(4500); await scrollBy(p, 700, 20); await sleep(1500); await scrollBy(p, -700, 14); } },
      { cap: "മുറികൾ: ഓരോ കിടക്കയുടെയും നില",
        say: "താഴെയുള്ള മുറികൾ ടാബിൽ, ഓരോ ബ്ലോക്കിലെയും കിടക്കകൾ കാണാം. നിറമുള്ളത് ആളുള്ള കിടക്ക, വരയിട്ടത് ഒഴിവുള്ളത്. ഒരു കിടക്ക ടാപ്പ് ചെയ്താൽ, അവിടെ താമസിക്കുന്ന ആളുടെ വിവരങ്ങൾ കാണാം.",
        act: async (p) => {
          await tap(p, tab(p, "മുറികൾ")); await sleep(4500);
          await tap(p, p.locator('button[aria-label^="A-102"]'));
          await sleep(3500); await p.keyboard.press("Escape");
        } },
      { cap: "വാടക: ആരൊക്കെ അടച്ചു, ആര് ബാക്കി",
        say: "വാടക ടാബിൽ, ഈ മാസത്തെ ബില്ലുകളും, പിരിഞ്ഞ തുകയും, വൈകിയവരുടെ ലിസ്റ്റും കാണാം. യു.പി.ഐ. വഴി അടച്ചാൽ, തുക തനിയെ ഇവിടെ രേഖപ്പെടുത്തും. വൈകിയവർക്ക് ഒറ്റ ടാപ്പിൽ വാട്സ്ആപ്പ് ഓർമ്മപ്പെടുത്തൽ അയയ്ക്കാം.",
        act: async (p) => { await tap(p, tab(p, "വാടക")); await sleep(4000); await scrollBy(p, 520, 16); } },
      { cap: "പരാതികൾ: ആപ്പിലും വാട്സ്ആപ്പിലും വരുന്നവ",
        say: "പരാതികൾ ടാബിൽ, താമസക്കാർ ആപ്പിലൂടെയും വാട്സ്ആപ്പിലൂടെയും നൽകുന്ന പരാതികൾ കാണാം. ഓരോന്നും ശരിയാക്കാൻ എത്ര സമയം ബാക്കിയുണ്ടെന്നും അറിയാം.",
        act: async (p) => { await tap(p, tab(p, "പരാതികൾ")); await sleep(4200); await scrollBy(p, 380, 12); } },
      { cap: "മുകളിലെ ✦ ബട്ടൺ: ആപ്പിനോട് മലയാളത്തിൽ ചോദിക്കാം",
        say: "മുകളിലെ നക്ഷത്ര ബട്ടൺ ടാപ്പ് ചെയ്ത്, ആപ്പിനോട് മലയാളത്തിൽ ചോദ്യങ്ങൾ ചോദിക്കാം. ഉദാഹരണത്തിന്, ആരൊക്കെ വാടക അടയ്ക്കാനുണ്ട് എന്ന് ചോദിക്കാം.",
        act: async (p) => {
          await tap(p, p.getByRole("button", { name: "Ask StayOS" }));
          await sleep(1500);
          const input = p.getByPlaceholder(/ചോദിക്കൂ/);
          await input.click(); await input.pressSequentially("ആരൊക്കെ വാടക അടയ്ക്കാനുണ്ട്?", { delay: 60 });
          await sleep(500); await p.keyboard.press("Enter"); await sleep(3500);
        } },
      { cap: "‘ഉടമ’ ബട്ടൺ → വാർഡൻ കാണുന്നത് പോലെ കാണാം",
        say: "മുകളിൽ ഉടമ എന്നെഴുതിയ ബട്ടൺ ടാപ്പ് ചെയ്താൽ, വാർഡൻ കാണുന്നത് പോലെ ആപ്പ് കാണാം. പണവും റിപ്പോർട്ടുകളും സെറ്റിംഗ്സും വാർഡന് കാണില്ല.",
        act: async (p) => {
          await p.keyboard.press("Escape"); await sleep(900);
          await tap(p, p.getByRole("button", { name: /ആരായി കാണണം/ })); await sleep(2600);
          await tap(p, p.getByRole("radio", { name: /^വാർഡൻ/ })); await sleep(1500);
        } },
      { cap: "കൂടുതൽ → മെസ്സ്: ഇന്നത്തെ അടുക്കള എണ്ണം",
        say: "കൂടുതൽ ടാബിൽ നിന്ന് മെസ്സ് തുറക്കാം. ഓരോ നേരവും എത്ര പേർക്ക് ഭക്ഷണം വേണമെന്ന് ഇവിടെ തത്സമയം കാണാം. ഓരോ നേരവും സ്ഥാപനത്തിൽ എത്ര, ഹോസ്റ്റലിൽ എത്ര, ഓരോ ബ്ലോക്കിലും എത്ര എന്നും വേർതിരിച്ച് കാണിക്കും.",
        act: async (p) => {
          await tap(p, tab(p, "കൂടുതൽ")); await sleep(1800);
          await tap(p, p.getByRole("link", { name: /^മെസ്സ്/ })); await sleep(2500); await scrollBy(p, 330, 10);
        } },
    ],
  }, {
    // A real hostel: the same check-in an owner does when someone moves in
    device: "iPhone 15",
    start: "/dashboard/rooms/",
    prepare: async (p, state) => {
      await realHostel("create");
      await signIn(p, "റഷീദ്", /\/dashboard\//);
      await p.evaluate((org) => localStorage.setItem("stayos-org", org), REAL_ORG);
      await p.goto(BASE + "/dashboard/rooms/", { waitUntil: "domcontentloaded" });
      // the hostel's name is in the sidebar, which a phone hides: wait for it to load, then for the check-in button
      await p.getByText("Green Valley Hostel").first().waitFor({ state: "attached", timeout: 30000 });
      await p.locator('[data-tour="checkin-button"]').waitFor({ timeout: 30000 });
      state.storage = await p.context().storageState();
    },
    cleanup: async () => { await realHostel("delete"); },
    scenes: [
      { title: { tag: "StayOS ട്യൂട്ടോറിയൽ · ഭാഗം 1", title: "പുതിയ താമസക്കാരെ ചേർക്കാം", sub: "ആധാർ പരിശോധന, കിടക്ക, ആദ്യ ബില്ല്, പോലീസ് ഫോം" },
        say: "ഇനി, നിങ്ങളുടെ സ്വന്തം ഹോസ്റ്റലിൽ ഒരു പുതിയ താമസക്കാരിയെ എങ്ങനെ ചേർക്കാമെന്ന് നോക്കാം." },
      { cap: "മുറികൾ → ‘പുതിയ താമസക്കാരെ ചേർക്കുക’",
        say: "മുറികൾ ടാബിൽ, പുതിയ താമസക്കാരെ ചേർക്കുക എന്ന ബട്ടൺ ടാപ്പ് ചെയ്യുക.",
        act: async (p) => { await setTitle(p, null); await sleep(2400); await tap(p, p.locator('[data-tour="checkin-button"]')); } },
      { cap: "വിവരങ്ങൾ: പേര്, ഫോൺ, ജനന തീയതി, കോളേജ്, രക്ഷിതാവ്",
        say: "ആധാറിലുള്ളതുപോലെ മുഴുവൻ പേര്, മൊബൈൽ നമ്പർ, ജനന തീയതി, കോളേജ്, രക്ഷിതാവിന്റെ പേരും നമ്പറും നൽകി, തുടരുക ടാപ്പ് ചെയ്യുക. ഈ വിവരങ്ങളിൽ നിന്നാണ് പോലീസ് ഫോമും തയ്യാറാകുന്നത്.",
        act: async (p) => {
          const name = p.locator("#ci-name");
          await name.click(); await name.pressSequentially("Fathima Rahman", { delay: 70 });
          await tap(p, p.locator("#ci-gender")); await sleep(400);
          await tap(p, p.getByRole("option", { name: "സ്ത്രീ" })); await sleep(300);
          await p.locator("#ci-dob").fill("2006-03-14");
          await p.locator("#ci-phone").fill("9847012345");
          await p.locator("#ci-inst").scrollIntoViewIfNeeded(); await p.locator("#ci-inst").fill("Farook College · BCom");
          await p.locator("#ci-blood").fill("B+");
          await p.locator("#ci-home").fill("Tirur, Malappuram");
          await p.locator("#ci-pname").scrollIntoViewIfNeeded(); await p.locator("#ci-pname").fill("Abdul Rahman");
          await p.locator("#ci-pphone").fill("9847054321");
          await sleep(900);
          await tap(p, p.locator('[data-tour="checkin-next0"]'));
        } },
      { cap: "ആധാർ: ഒറിജിനൽ കാർഡ് നോക്കി, അവസാന 4 അക്കങ്ങൾ",
        say: "അടുത്തത് ആധാർ പരിശോധന. താമസക്കാരിയുടെ ഒറിജിനൽ ആധാർ കാർഡ് നോക്കി, പേരും ഫോട്ടോയും ഒത്തുനോക്കുക. കാർഡിന്റെ അവസാന നാല് അക്കങ്ങൾ മാത്രം നൽകിയാൽ മതി. കാർഡ് കണ്ടു എന്ന് ടിക്ക് ചെയ്ത് തുടരുക.",
        act: async (p) => {
          await sleep(3800);
          const last4 = p.locator("#ci-last4");
          await last4.click(); await last4.pressSequentially("4321", { delay: 160 });
          await sleep(1200); await tap(p, p.locator("#ci-seen")); await sleep(1500);
          await tap(p, p.locator('[data-tour="checkin-next"]'));
        } },
      { cap: "കിടക്ക: ഒഴിവുള്ളവ, അനുയോജ്യമായത് ആദ്യം",
        say: "ഒഴിവുള്ള കിടക്കകൾ കാണിക്കും. സ്ത്രീകൾക്ക് സ്ത്രീകളുടെ ബ്ലോക്കിലെ കിടക്കകൾ, ഏറ്റവും അനുയോജ്യമായത് ആദ്യം. ഒന്ന് തിരഞ്ഞെടുത്ത് തുടരുക.",
        act: async (p) => { await sleep(4500); await tap(p, p.locator('[data-tour="checkin-next2"]')); } },
      { cap: "ആദ്യ ബില്ല് → ‘ചെക്ക്-ഇൻ പൂർത്തിയാക്കുക’",
        say: "ആദ്യ മാസത്തെ വാടകയും, മെസ്സ് ഫീസും, ഡെപ്പോസിറ്റും ഇവിടെ കാണാം. ചെക്ക്-ഇൻ പൂർത്തിയാക്കുക ടാപ്പ് ചെയ്താൽ, ആദ്യ ബില്ല് തയ്യാറാകും.",
        act: async (p) => { await sleep(4800); await tap(p, p.locator('[data-tour="checkin-complete"]')); await sleep(1200); } },
      { cap: "പോലീസ് വെരിഫിക്കേഷൻ: പ്രിന്റ് ചെയ്ത് സ്റ്റേഷനിൽ നൽകുക",
        say: "പോലീസ് വെരിഫിക്കേഷൻ ഫോം, ചെക്ക്-ഇൻ വിവരങ്ങളിൽ നിന്ന് തനിയെ പൂരിപ്പിക്കും. പ്രിന്റ് ചെയ്ത് ഒപ്പിട്ട്, നിങ്ങളുടെ പോലീസ് സ്റ്റേഷനിൽ നൽകുക.",
        act: async (p) => {
          await sleep(2200);
          await tap(p, p.getByRole("button", { name: "പോലീസ് വെരിഫിക്കേഷൻ ഫോം" }));
          await p.waitForURL(/tab=police/, { timeout: 30000 }); await sleep(1500);
        } },
      { cap: "സ്റ്റേഷനിൽ നിന്നുള്ള റഫറൻസ് നമ്പർ രേഖപ്പെടുത്തുക",
        say: "ഫോം നൽകിയ ശേഷം, സ്റ്റേഷനിൽ നിന്ന് ലഭിക്കുന്ന റഫറൻസ് നമ്പർ ഇവിടെ നൽകി, സമർപ്പിച്ചു എന്ന് രേഖപ്പെടുത്തുക. ഫോം ബാക്കിയുള്ളവരെ താമസക്കാരുടെ ലിസ്റ്റിൽ വേഗം കണ്ടെത്താം.",
        act: async (p) => {
          const ref = p.getByPlaceholder("റഫറൻസ് നമ്പർ (ഐച്ഛികം)");
          await ref.scrollIntoViewIfNeeded(); await sleep(1200);
          await ref.click(); await ref.pressSequentially("KZD-2611-0457", { delay: 90 });
          await sleep(900); await tap(p, p.getByRole("button", { name: "സമർപ്പിച്ചു എന്ന് രേഖപ്പെടുത്തുക" })); await sleep(1800);
        } },
      END("ഈ ഭാഗം ഇവിടെ തീരുന്നു. അടുത്ത ഭാഗത്തിൽ, താമസക്കാർ ഫോണിൽ ആപ്പ് എങ്ങനെ ഉപയോഗിക്കുന്നു എന്ന് നോക്കാം."),
    ],
  }] },

  resident: { file: "2-residents", segments: [{
    device: "iPhone 15",
    start: "/demo/",
    // Before recording: note the demo day's meals, then make it "eating everything, lunch at the institute"
    // so the switches on screen change when tapped.
    prepare: async (p, state) => {
      await signIn(p, "അഞ്ജലി", /\/resident\//);
      await openDemoDay(p);
      const m = residentMeals(p);
      state.dinner = (await m.dinner.getAttribute("aria-checked")) === "true";
      state.lunch = (await m.lunch.getAttribute("aria-checked")) === "true";
      await setChecked(p, m.lunch, true);
      await setChecked(p, m.dinner, true);
      state.lunchPlace = await lunchPlace(p);
      await setLunchPlace(p, "institute");
      await sleep(3500); // let it save
    },
    cleanup: async (p, state) => {
      await openDemoDay(p);
      const m = residentMeals(p);
      await setChecked(p, m.lunch, true);
      await setLunchPlace(p, state.lunchPlace ?? "institute");
      await setChecked(p, m.lunch, state.lunch);
      await setChecked(p, m.dinner, state.dinner);
      await sleep(3500);
    },
    scenes: [
      { title: { tag: "StayOS ട്യൂട്ടോറിയൽ · ഭാഗം 2", title: "താമസക്കാരുടെ ആപ്പ്", sub: "വാടക, ഭക്ഷണം, ഗേറ്റ് പാസ്, പരാതി" },
        say: "ഈ ഭാഗത്തിൽ, ഹോസ്റ്റലിൽ താമസിക്കുന്നവർ ഫോണിൽ ആപ്പ് എങ്ങനെ ഉപയോഗിക്കുന്നു എന്ന് നോക്കാം." },
      { cap: "ഡെമോയിൽ ‘താമസക്കാരി’ തിരഞ്ഞെടുക്കുക",
        say: "ഡെമോ പേജിൽ, താമസക്കാരി എന്നത് ടാപ്പ് ചെയ്യുക. നമ്മൾ അഞ്ജലിയായി സൈൻ ഇൻ ചെയ്യും.",
        act: async (p) => { await setTitle(p, null); await sleep(2400); await tap(p, p.getByRole("button").filter({ hasText: "അഞ്ജലി" })); await p.waitForURL(/\/resident\//, { timeout: 40000 }); } },
      { cap: "ഹോം: വാടക, ഗേറ്റ് പാസ്, ഇന്നത്തെ മെനു",
        say: "ഹോം സ്ക്രീനിൽ, വാടക അടച്ചോ എന്നും, ഗേറ്റ് പാസിന്റെ നിലയും, ഇന്നത്തെ ഭക്ഷണ മെനുവും കാണാം. വാടക ബാക്കിയുണ്ടെങ്കിൽ, ഇവിടെ നിന്ന് തന്നെ ഏത് യു.പി.ഐ. ആപ്പ് വഴിയും അടയ്ക്കാം.",
        act: async (p) => { await sleep(4000); await scrollBy(p, 600, 18); await sleep(1200); } },
      { cap: "മെസ്സ്: വേണ്ടാത്ത നേരത്തെ ഭക്ഷണം ഓഫ് ചെയ്യുക",
        say: "മെസ്സ് ടാബിൽ, ഏഴ് ദിവസത്തെ മെനു കാണാം. ഒരു നേരം ഭക്ഷണം വേണ്ടെങ്കിൽ, കട്ട്-ഓഫ് സമയത്തിന് മുമ്പ് സ്വിച്ച് ഓഫ് ചെയ്താൽ മതി. അടുക്കളയിൽ അത്രയും കുറച്ച് പാചകം ചെയ്യും.",
        act: async (p) => {
          await tap(p, tab(p, "മെസ്സ്")); await sleep(2200);
          await tap(p, p.getByRole("tab").nth(DEMO_DAY)); await sleep(1500);
          const { dinner } = residentMeals(p);
          await setChecked(p, dinner, false); await sleep(2400); await setChecked(p, dinner, true); await sleep(600);
        } },
      { cap: "ഓരോ നേരവും എവിടെ: സ്ഥാപനത്തിൽ / ഹോസ്റ്റലിൽ",
        say: "പ്രഭാതഭക്ഷണം, ഉച്ചഭക്ഷണം, അത്താഴം — ഓരോന്നും എവിടെ കഴിക്കുമെന്ന് തിരഞ്ഞെടുക്കാം. സ്ഥാപനത്തിലോ, ഹോസ്റ്റലിലോ. ഉദാഹരണത്തിന്, ഇന്ന് ഉച്ചഭക്ഷണം ഹോസ്റ്റലിൽ ആണെങ്കിൽ, ഹോസ്റ്റലിൽ എന്നത് ടാപ്പ് ചെയ്യുക.",
        act: async (p) => {
          const { hostel } = residentMeals(p);
          await hostel.scrollIntoViewIfNeeded(); await scrollBy(p, 160, 5); await sleep(3200);
          await setChecked(p, hostel, true); await sleep(1500);
        } },
      { cap: "ഏത് ബ്ലോക്കിലെ മെസ്സിൽ: സ്വന്തം ബ്ലോക്ക് ആദ്യം",
        say: "ഹോസ്റ്റലിൽ ഒന്നിലധികം ബ്ലോക്കുകൾ ഉണ്ടെങ്കിൽ, ഏത് ബ്ലോക്കിലെ മെസ്സിലാണ് കഴിക്കുന്നതെന്നും തിരഞ്ഞെടുക്കാം. സ്വന്തം ബ്ലോക്ക് ആദ്യം കാണിക്കും. ഓരോ ബ്ലോക്കിലെയും അടുക്കളയ്ക്ക് എത്ര പേർ വരുമെന്ന് കൃത്യമായി അറിയാം.",
        act: async (p) => {
          const { blocks } = residentMeals(p);
          await blocks.first().scrollIntoViewIfNeeded().catch(() => {}); await sleep(3800);
          await setChecked(p, blocks.nth(1), true); await sleep(1800);
        } },
      { cap: "ഗേറ്റ് പാസ്: രക്ഷിതാവ് അംഗീകരിച്ചാൽ QR കോഡ്",
        say: "ഗേറ്റ് പാസ് ടാബിൽ, വീട്ടിൽ പോകാൻ ലീവിന് അപേക്ഷിക്കാം. രക്ഷിതാവ് വാട്സ്ആപ്പിൽ അംഗീകരിച്ചാൽ, ഒരു ക്യു.ആർ. കോഡ് ലഭിക്കും. പുറത്ത് പോകുമ്പോഴും തിരികെ വരുമ്പോഴും ഗേറ്റിൽ ഇത് കാണിച്ചാൽ മതി.",
        act: async (p) => { await tap(p, tab(p, "ഗേറ്റ് പാസ്")); await sleep(2000); } },
      { cap: "സഹായം: പരാതി നൽകുക",
        say: "എന്തെങ്കിലും കേടായാൽ, സഹായം ടാബിൽ നിന്ന് പരാതി നൽകാം. പ്രശ്നം തിരഞ്ഞെടുത്ത്, ഫോട്ടോ ചേർത്ത് അയച്ചാൽ മതി. പരാതി എവിടെ എത്തി എന്നും ഇവിടെ തന്നെ അറിയാം.",
        act: async (p) => {
          await tap(p, tab(p, "സഹായം")); await sleep(3000);
          await tap(p, p.getByRole("link", { name: /പരാതി നൽകുക/ })); await sleep(3500);
        } },
      END("അടുത്ത ഭാഗത്തിൽ, രക്ഷിതാക്കളുടെ ആപ്പ് നോക്കാം."),
    ],
  }] },

  parent: { file: "3-parents", segments: [{
    device: "iPhone 15",
    start: "/demo/",
    scenes: [
      { title: { tag: "StayOS ട്യൂട്ടോറിയൽ · ഭാഗം 3", title: "രക്ഷിതാക്കളുടെ ആപ്പ്", sub: "കുട്ടി സുരക്ഷിതമാണോ എന്ന് ഫോണിൽ അറിയാം" },
        say: "ഈ ഭാഗത്തിൽ, രക്ഷിതാക്കൾക്കുള്ള ആപ്പ് നോക്കാം. കുട്ടി സുരക്ഷിതമാണോ എന്ന് ഫോണിൽ തന്നെ അറിയാം." },
      { cap: "ഡെമോയിൽ ‘രക്ഷിതാവ്’ തിരഞ്ഞെടുക്കുക",
        say: "ഡെമോ പേജിൽ, രക്ഷിതാവ് ടാപ്പ് ചെയ്യുക. നമ്മൾ അഞ്ജലിയുടെ അച്ഛൻ രാജേഷ് ആയി സൈൻ ഇൻ ചെയ്യും.",
        act: async (p) => { await setTitle(p, null); await sleep(2400); await tap(p, p.getByRole("button").filter({ hasText: "രാജേഷ്" })); await p.waitForURL(/\/parent\//, { timeout: 40000 }); } },
      { cap: "ഹോം: കുട്ടി ഹോസ്റ്റലിലാണോ, ലീവ്, ഫീസ്",
        say: "ഹോം സ്ക്രീനിൽ, കുട്ടി ഇപ്പോൾ ഹോസ്റ്റലിൽ ഉണ്ടോ എന്നും, ലീവിന്റെ നിലയും, ഫീസ് അടച്ചോ എന്നും കാണാം. ഒറ്റ ടാപ്പിൽ കുട്ടിയെയോ വാർഡനെയോ വിളിക്കാം.",
        act: async (p) => { await sleep(4500); await scrollBy(p, 520, 16); } },
      { cap: "ലീവ്: അംഗീകരിക്കുക അല്ലെങ്കിൽ നിരസിക്കുക",
        say: "കുട്ടി ലീവിന് അപേക്ഷിച്ചാൽ, ആപ്പിലും വാട്സ്ആപ്പിലും അറിയിപ്പ് ലഭിക്കും. ലീവ് ടാബിൽ നിന്ന് അംഗീകരിക്കുകയോ നിരസിക്കുകയോ ചെയ്യാം.",
        act: async (p) => { await tap(p, tab(p, "ലീവ്")); await sleep(2000); } },
      { cap: "അറിയിപ്പ്: ഗേറ്റ് കടന്ന സമയം, രസീതുകൾ",
        say: "അറിയിപ്പ് ടാബിൽ, കുട്ടി ഗേറ്റ് കടന്ന സമയവും, ഫീസ് രസീതുകളും, ഹോസ്റ്റലിൽ നിന്നുള്ള അറിയിപ്പുകളും കാണാം.",
        act: async (p) => { await tap(p, tab(p, "അറിയിപ്പ്")); await sleep(2000); } },
      { cap: "ഫീസ്: UPI വഴി നേരിട്ട് അടയ്ക്കാം",
        say: "ഫീസ് ടാബിൽ, ബില്ലുകൾ കാണാനും, യു.പി.ഐ. വഴി നേരിട്ട് ഹോസ്റ്റലിന്റെ അക്കൗണ്ടിലേക്ക് അടയ്ക്കാനും കഴിയും.",
        act: async (p) => { await tap(p, tab(p, "ഫീസ്")); await sleep(2000); } },
      END("അടുത്ത ഭാഗത്തിൽ, ഫോണിൽ ആപ്പ് എങ്ങനെ ഇൻസ്റ്റാൾ ചെയ്യാം എന്ന് നോക്കാം."),
    ],
  }] },

  install: { file: "4-install-on-phone", segments: [
    { device: "iPhone 15", start: "/", installSheet: true,
      scenes: [
        { title: { tag: "StayOS ട്യൂട്ടോറിയൽ · ഭാഗം 4", title: "ഫോണിൽ ആപ്പ് ഇൻസ്റ്റാൾ ചെയ്യാം", sub: "ആപ്പ് സ്റ്റോർ വേണ്ട" },
          say: "സ്റ്റേ ഒ.എസ്. ഉപയോഗിക്കാൻ ആപ്പ് സ്റ്റോർ വേണ്ട. ബ്രൗസറിൽ നിന്ന് തന്നെ, ഫോണിന്റെ ഹോം സ്ക്രീനിൽ ആപ്പായി ചേർക്കാം." },
        { cap: "ഐഫോൺ: Safari-യിൽ stayos.space തുറക്കുക",
          say: "ഐഫോണിൽ, സഫാരിയിൽ സ്റ്റേ ഒ.എസ്. ഡോട്ട് സ്പേസ് തുറക്കുക. കുറച്ച് സെക്കൻഡിനുള്ളിൽ, ഇൻസ്റ്റാൾ ചെയ്യേണ്ട വിധം കാണിക്കും.",
          act: async (p) => { await setTitle(p, null); await p.getByText(/ഇൻസ്റ്റാൾ/).first().waitFor({ timeout: 15000 }).catch(() => {}); } },
        { cap: "ഷെയർ ⬆︎ → ‘Add to Home Screen’ → ‘Add’",
          say: "ഷെയർ ബട്ടൺ ടാപ്പ് ചെയ്യുക. പിന്നെ, ആഡ് ടു ഹോം സ്ക്രീൻ തിരഞ്ഞെടുത്ത്, ആഡ് ടാപ്പ് ചെയ്യുക. ഇനി ഹോം സ്ക്രീനിലെ ഐക്കണിൽ നിന്ന്, സാധാരണ ആപ്പ് പോലെ തുറക്കാം." },
      ] },
    { device: "Pixel 7", start: "/", installSheet: true,
      scenes: [
        { cap: "ആൻഡ്രോയിഡ്: Chrome-ൽ ⋮ മെനു → ‘Install app’",
          say: "ആൻഡ്രോയിഡ് ഫോണിൽ, ക്രോമിൽ സൈറ്റ് തുറന്ന്, മുകളിലെ മൂന്ന് കുത്തുള്ള മെനു ടാപ്പ് ചെയ്യുക. ഇൻസ്റ്റാൾ ആപ്പ് തിരഞ്ഞെടുത്ത്, ഇൻസ്റ്റാൾ ടാപ്പ് ചെയ്യുക.",
          act: async (p) => { await p.getByText(/ഇൻസ്റ്റാൾ/).first().waitFor({ timeout: 15000 }).catch(() => {}); } },
        END("സ്റ്റേ ഒ.എസ്. ഡോട്ട് സ്പേസിൽ, പതിനാല് ദിവസം സൗജന്യമായി പരീക്ഷിക്കാം. നന്ദി."),
      ] },
  ] },
};
const FULL = "stayos-tutorial-malayalam-full";

// ---------------------------------------------------------------------------
// Voice: one clip per scene, cached by its text
// ---------------------------------------------------------------------------
function duration(file) {
  let info = "";
  try { execFileSync(FFMPEG, ["-hide_banner", "-i", file], { stdio: "pipe" }); } catch (e) { info = String(e.stderr); }
  const m = info.match(/Duration: (\d+):(\d+):([\d.]+)/);
  return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : 3;
}
function voice(text) {
  const id = crypto.createHash("sha1").update(VOICE + text).digest("hex").slice(0, 12);
  const file = path.join(WORK, `voice-${id}.mp3`);
  if (!fs.existsSync(file)) {
    try {
      execFileSync(TTS, ["--voice", VOICE, "--rate=-4%", "--text", text, "--write-media", file], { stdio: "ignore" });
    } catch {
      throw new Error(`Could not run edge-tts (${TTS}). Set it up with: python3 -m venv .venv-tts && .venv-tts/bin/pip install edge-tts`);
    }
  }
  return { file, secs: duration(file) };
}

// ---------------------------------------------------------------------------
// Recording: 2x screenshots as frames (WebKit's own recorder can't scale up, so it pads the picture into a corner)
// ---------------------------------------------------------------------------
async function newContext(browser, seg, storageState) {
  const ctx = await browser.newContext({ ...devices[seg.device], deviceScaleFactor: 2, timezoneId: "Asia/Kolkata", locale: "ml-IN", colorScheme: "light", storageState });
  await ctx.addInitScript(({ snooze }) => {
    try {
      localStorage.setItem("stayos-locale", "ml");
      localStorage.setItem("theme", "light");
      if (snooze) localStorage.setItem("stayos-install-dismissed", String(Date.now() + 7 * 864e5));
      else localStorage.removeItem("stayos-install-dismissed");
    } catch {}
  }, { snooze: !seg.installSheet });
  await ctx.addInitScript(PAGE_KIT);
  return ctx;
}

async function recordSegment(name, seg, idx) {
  const label = `${name}${idx ? `/${idx + 1}` : ""}`;
  const voices = seg.scenes.map((sc) => (DRY ? { secs: 1.2 } : voice(sc.say)));
  const browser = await webkit.launch();
  const state = {};
  try {
    if (seg.prepare) {
      const ctx = await newContext(browser, seg);
      try {
        await seg.prepare(await ctx.newPage(), state);
      } catch (e) {
        if (seg.cleanup) await seg.cleanup(await ctx.newPage(), state).catch(() => {});
        throw e;
      } finally {
        await ctx.close();
      }
    }
    // a prepare step can leave the recording signed in (state.storage)
    const ctx = await newContext(browser, seg, state.storage);
    const p = await ctx.newPage();
    p.on("pageerror", (e) => console.log("  page error:", e.message.split("\n")[0]));
    await p.goto(BASE + seg.start, { waitUntil: "domcontentloaded" });
    if (seg.scenes[0].title) await setTitle(p, seg.scenes[0].title);
    await p.waitForLoadState("networkidle").catch(() => {});
    await sleep(600);

    const frameDir = path.join(WORK, `frames-${name}-${idx}`);
    fs.rmSync(frameDir, { recursive: true, force: true });
    fs.mkdirSync(frameDir, { recursive: true });
    const frames = [];
    let capturing = !DRY;
    const capStart = Date.now();
    const loop = (async () => {
      while (capturing) {
        try {
          const buf = await p.screenshot({ type: "jpeg", quality: 86 });
          const f = path.join(frameDir, `f${String(frames.length).padStart(6, "0")}.jpg`);
          fs.writeFileSync(f, buf);
          frames.push({ f, ts: (Date.now() - capStart) / 1000 });
        } catch { await sleep(40); }
      }
    })();

    const marks = [];
    try {
      for (const [i, sc] of seg.scenes.entries()) {
        if (sc.title && i > 0) await setTitle(p, sc.title);
        await setCap(p, sc.cap ?? "");
        const start = (Date.now() - capStart) / 1000;
        const t = Date.now();
        // the scene lasts as long as its narration (or its taps, if those take longer)
        await Promise.all([(sc.act ?? (async () => {}))(p), sleep(voices[i].secs * 1000 + 450)]);
        marks.push({ start, file: voices[i].file });
        console.log(`  ${label} step ${i + 1}: ${((Date.now() - t) / 1000).toFixed(1)}s (voice ${voices[i].secs.toFixed(1)}s)`);
        if (DRY) await p.screenshot({ path: path.join(WORK, `check-${name}-${idx}-${i + 1}.png`) });
      }
      await sleep(DRY ? 0 : 900);
    } finally {
      capturing = false;
      await loop;
      await p.close();
      if (seg.cleanup) {
        const c = await ctx.newPage();
        await seg.cleanup(c, state).catch((e) => console.log(`  warning: could not put the demo back (${e.message}). Check it by hand.`));
        await c.close();
      }
      await ctx.close();
    }
    if (DRY) return null;

    // frames → a timed list (each frame shows until the next was taken), voice clips at their scene times → MP4
    const list = path.join(frameDir, "list.txt");
    const lines = [];
    frames.forEach((fr, i) => lines.push(`file '${fr.f}'`, `duration ${Math.max(0.01, (frames[i + 1]?.ts ?? fr.ts + 0.5) - fr.ts).toFixed(3)}`));
    lines.push(`file '${frames[frames.length - 1].f}'`);
    fs.writeFileSync(list, lines.join("\n"));
    const dur = frames[frames.length - 1].ts + 0.5;
    console.log(`  ${label}: ${frames.length} frames, ${(frames.length / dur).toFixed(1)} fps, ${dur.toFixed(0)}s`);
    const out = path.join(WORK, `${name}-${idx}.mp4`);
    const args = ["-y", "-hide_banner", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list];
    marks.forEach((m) => args.push("-i", m.file));
    const delays = marks.map((m, i) => `[${i + 1}:a]adelay=${Math.max(0, Math.round(m.start * 1000 + 150))}[a${i}]`).join(";");
    // apad to the video's length: -shortest alone never ends when the video comes through a filter
    const mix = marks.map((_, i) => `[a${i}]`).join("") + `amix=inputs=${marks.length}:normalize=0:dropout_transition=0,apad=whole_dur=${dur.toFixed(2)}[a]`;
    args.push("-t", dur.toFixed(2), "-filter_complex", `[0:v]fps=30,format=yuv420p[v];${delays};${mix}`, "-map", "[v]", "-map", "[a]",
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-pix_fmt", "yuv420p", "-r", "30",
      "-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-movflags", "+faststart", out);
    execFileSync(FFMPEG, args, { stdio: "inherit" });
    fs.rmSync(frameDir, { recursive: true, force: true });
    return out;
  } finally {
    await browser.close();
  }
}

/** Joins MP4s one after another, fitting each into a 786×1318 frame (an Android phone is a little taller). */
function join(parts, out) {
  if (parts.length === 1) return fs.copyFileSync(parts[0], out);
  const [W, H] = [786, 1318];
  const args = ["-y", "-hide_banner", "-loglevel", "error"];
  parts.forEach((f) => args.push("-i", f));
  const fit = parts.map((_, i) => `[${i}:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=0xF7F7F5,setsar=1,fps=30[v${i}]`).join(";");
  const inputs = parts.map((_, i) => `[v${i}][${i}:a]`).join("");
  args.push("-filter_complex", `${fit};${inputs}concat=n=${parts.length}:v=1:a=1[v][a]`, "-map", "[v]", "-map", "[a]",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", out);
  execFileSync(FFMPEG, args, { stdio: "inherit" });
}

// ---------------------------------------------------------------------------
const names = argv.filter((a) => !a.startsWith("--"));
const wanted = names.length === 0 || names.includes("all") ? Object.keys(VIDEOS) : names;
for (const n of wanted) if (!VIDEOS[n]) throw new Error(`Unknown part "${n}". Parts: ${Object.keys(VIDEOS).join(", ")}, or all`);
for (const n of wanted) {
  console.log(`${DRY ? "Checking" : "Recording"} ${n}…`);
  const parts = [];
  for (const [i, seg] of VIDEOS[n].segments.entries()) parts.push(await recordSegment(n, seg, i));
  if (DRY) continue;
  const out = path.join(OUT, `${VIDEOS[n].file}.mp4`);
  join(parts, out);
  console.log(`  wrote ${path.relative(ROOT, out)}`);
}
if (DRY) console.log(`Screenshots of every step: ${path.relative(ROOT, WORK)}/check-*.png`);
else if (wanted.length === Object.keys(VIDEOS).length) {
  const out = path.join(OUT, `${FULL}.mp4`);
  join(Object.values(VIDEOS).map((v) => path.join(OUT, `${v.file}.mp4`)), out);
  console.log(`  wrote ${path.relative(ROOT, out)}`);
}
