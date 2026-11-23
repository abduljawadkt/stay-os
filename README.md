# StayOS

Hostel and PG management as a SaaS: rent by UPI with WhatsApp reminders, rooms and beds, residents with
DigiLocker KYC, mess, complaints, gate passes, staff and reports, in English and Malayalam. One static
Next.js build serves the web app (Vercel) and the iOS app (Capacitor).

## How it fits together

| Part | What it does |
|---|---|
| **Neon Postgres** | One database for every hostel. Each row belongs to an org (hostel); row-level security decides who sees it. Schema in `db/schema.sql`. |
| **Neon Auth** (Better Auth) | Email sign-in for owners, wardens, residents and parents. Its JWT carries the user id that the policies check. |
| **Neon Data API** | The browser reads and writes rows directly with the user's JWT. No server of our own. |
| **App** | Loads a hostel once, saves every change within a moment (`lib/sync.ts`), and pulls other people's changes every 4 seconds. |

Roles: **owner** (everything, billing), **warden** (operations, no P&L or billing), **resident** (own invoices, room, mess, complaints, leave),
**parent** (their child's fees, leave and alerts). Staff can preview the resident and parent apps.

Billing is in **test mode**: plans (Starter ₹1,999 / Growth ₹4,999 / Scale ₹9,999 per month + 18% GST, yearly = 10 months),
a 14-day trial, checkout and GST invoices, with no money moving. A Razorpay webhook would replace `public.checkout_plan()`.

## Run it

```bash
npm install
npm run db:setup      # schema, policies, the sample hostel and the demo sign-ins (needs DATABASE_URL in .env.local)
npm run db:check      # signs in as each demo role and checks what row-level security allows
npm run dev           # http://localhost:3000
```

`.env.local` holds `DATABASE_URL` (used only by the scripts, never shipped). `.env.production` holds the two public URLs the browser needs.

## Demo accounts

All share the password `stayos-demo-2026` and the hostel *Al Noor Residency* (300 beds, 6 months of history).
The login page signs in to any of them with one click.

| Role | Email |
|---|---|
| Owner | owner@demo.stayos.space |
| Warden | warden@demo.stayos.space |
| Resident (Anjali, R-1042) | anjali@demo.stayos.space |
| Parent (Rajesh) | parent@demo.stayos.space |

New sign-ups get their own hostel: a copy of the sample data, or an empty layout of blocks × floors.

## Rent payments (Razorpay)

Each hostel connects its own Razorpay account in **Settings → Payments**, so rent goes straight to the hostel's bank and
StayOS never holds money.

- `functions/payments/index.mjs` is a Neon Function (no dependencies) that stores each hostel's Razorpay keys encrypted,
  creates payment links, and verifies Razorpay's signed webhook before marking an invoice paid. Nothing else can mark an
  invoice paid online: residents and parents can't write invoices (see `db/migrations/003`).
- After connecting, the owner adds the webhook URL and secret shown in Settings → Payments to Razorpay
  (Account & Settings → Webhooks, events `payment_link.paid`, `payment_link.expired`, `payment_link.cancelled`).
- Hostels without Razorpay show their own UPI QR; the office marks those paid. Sample hostels use a test payment.
- `npm run payments:check` runs the whole flow against the real database with Razorpay faked (22 checks, cleans up after itself).
- Redeploy the function after changing it: `neon functions deploy payments --src functions/payments/index.mjs --no-bundle`
  (environment: `NEON_AUTH_URL`, `APP_URL`, `ALLOWED_ORIGINS`; `DATABASE_URL` is injected by Neon).

## Database changes

Schema changes after the first setup live in `db/migrations/` and are applied with `npm run db:migrate -- <file>`.
`npm run db:setup` applies them all on a fresh database. After adding or changing a function, refresh the Data API schema
cache (Neon Console → Data API).

## Tutorial videos (Malayalam)

`npm run tutorial:video` records the Malayalam tutorial from the live demo at stayos.space: four parts (owner and warden,
residents, parents, installing on a phone) plus one full video, in `tutorial-videos/` (not in git). It drives the
demo as an iPhone in WebKit, shows Malayalam captions and a tap marker, and narrates each step with Microsoft's
Malayalam voice (`ml-IN-SobhanaNeural`, via edge-tts). The narration and the steps are in `scripts/tutorial-video.mjs`;
re-record after the app changes.

One-time setup:

```bash
npx playwright install webkit
python3 -m venv .venv-tts && .venv-tts/bin/pip install edge-tts
```

```bash
npm run tutorial:video                  # all four parts and the full video (about 10 minutes)
npm run tutorial:video -- resident      # one part: owner, resident, parent or install
npm run tutorial:video -- all --dry     # check every step quickly; screenshots in tutorial-videos/.work/
```

The demo hostel is shared. The resident part skips a meal and changes a lunch spot on screen; it notes how that day
was first and puts it back afterwards. For paid ads, use a human voice-over or a licensed voice service instead of
edge-tts.

## Deploy

```bash
npm run deploy        # npx vercel --prod
```

Then add the production domain (for example `https://stayos.vercel.app`) to **Neon Console → Auth → Domains**, so sign-in accepts it.

iOS: `npm run ios` builds, syncs and opens Xcode. Sign-in goes through native HTTP (`CapacitorHttp`) so the session survives WebKit's cookie rules.
