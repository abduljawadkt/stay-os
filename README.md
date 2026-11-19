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
| Owner | owner@demo.stayos.app |
| Warden | warden@demo.stayos.app |
| Resident (Anjali, R-1042) | anjali@demo.stayos.app |
| Parent (Rajesh) | parent@demo.stayos.app |

New sign-ups get their own hostel: a copy of the sample data, or an empty layout of blocks × floors.

## Deploy

```bash
npm run deploy        # npx vercel --prod
```

Then add the production domain (for example `https://stayos.vercel.app`) to **Neon Console → Auth → Domains**, so sign-in accepts it.

iOS: `npm run ios` builds, syncs and opens Xcode. Sign-in goes through native HTTP (`CapacitorHttp`) so the session survives WebKit's cookie rules.
