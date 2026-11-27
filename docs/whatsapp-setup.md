# WhatsApp: connecting the StayOS number

StayOS sends every hostel's WhatsApp messages from **one StayOS number** through Meta's WhatsApp Cloud API.
Each message carries the hostel's name. Hostel owners only switch it on (Settings → WhatsApp); they don't need a Meta account.

How it works:

- The app writes messages into each conversation, as it always has (welcome, rent bill, receipt, complaint
  updates, leave requests for parents, gate in/out).
- After they are saved, the app asks the `whatsapp` Neon Function to send the new ones. The function looks up the
  phone number in the `residents` table (never from the app), so it can only message a hostel's own residents and parents.
- Every day at 9 AM IST a schedule (`whatsapp-daily-9am-ist`) adds rent reminders: on the due date, then 1, 4, 7, 14, 21 and 30 days late.
- Replies come back through Meta's webhook into the same conversation in StayOS. A parent tapping **Approve** or
  **Reject** on a leave request decides it, but only when the tap comes from that resident's parent's number.
- Office replies typed in the inbox go out as free text only if the person wrote in the last 24 hours (Meta's rule).
- Nothing is sent from sample or demo hostels, or from a hostel that has WhatsApp switched off.
- Each send is logged in `wa_outbox`, which the owner sees under Settings → WhatsApp → Sent messages.

Until the keys below are set, the function runs in **test mode**: it records every message as "Test mode" and sends nothing.

## 1. Meta account and app

1. Create or open a Meta Business account at business.facebook.com and complete **business verification**
   (needed for the display name and to message more than 250 people a day).
2. At developers.facebook.com → **My Apps → Create app** → type **Business**, then add the **WhatsApp** product.
3. **WhatsApp → API Setup → Add phone number**: use a number that is not already on WhatsApp, verify it by SMS,
   and set the display name to **StayOS** (Meta reviews it).
4. **WhatsApp Manager → Payment settings**: add a payment method. Meta charges per utility message; check the
   current India rate on Meta's WhatsApp pricing page.

## 2. The three keys

| Key | Where to find it |
| --- | --- |
| `WA_PHONE_ID` | WhatsApp → API Setup → **Phone number ID** (not the phone number itself) |
| `WA_TOKEN` | Business settings → Users → **System users** → add an admin system user → assign the app and the WhatsApp account (full control) → **Generate token**, expiry **Never**, permissions `whatsapp_business_messaging` and `whatsapp_business_management` |
| `WA_APP_SECRET` | App settings → Basic → **App secret** |

Set them on the function: **Neon Console → project → Functions → whatsapp → Environment variables**, keep the
existing ones (`NEON_AUTH_URL`, `APP_URL`, `ALLOWED_ORIGINS`, `WA_VERIFY_TOKEN`, `WA_LANG`) and redeploy.
Keep these keys out of the repo and out of chat. Rotate the token if it ever leaks.

The StayOS admin page (`/admin`) shows **StayOS WhatsApp number → Setup details**: which keys are set, the callback
URL and the verify token.

## 3. Webhook

WhatsApp → **Configuration → Webhook → Edit**:

- **Callback URL**: `https://br-winter-silence-a17azhbc-whatsapp.compute.c-1.ap-southeast-1.aws.neon.tech/webhook`
- **Verify token**: the one shown on `/admin` → Setup details (it is the function's `WA_VERIFY_TOKEN`)

Then **Webhook fields → messages → Subscribe**. Messages Meta sends to the webhook are checked against
`WA_APP_SECRET` (the `X-Hub-Signature-256` header); unsigned ones are refused.

## 4. Message templates

WhatsApp Manager → **Message templates → Create template**. For each one: category **Utility**, language
**English** (`en`, matching `WA_LANG`), the name exactly as below, and the body text exactly as below.
Meta asks for a sample value for every `{{n}}`; the examples are in brackets. Templates must be approved before
they send; until then their messages show as **Failed** in the log with Meta's reason.

**stayos_welcome**: to a new resident
> Welcome to {{1}}, {{2}}! Your bed is {{3}}. You'll get your rent bills, receipts and complaint updates on this number. Reply here any time to reach the hostel office.

[Green Valley Hostel] [Arjun] [A-204-B]

**stayos_welcome_parent**: to the new resident's parent
> Hello from {{1}}. {{2}} has joined the hostel, bed {{3}}. You'll get gate in/out alerts, leave requests to approve and rent updates on this number.

[Green Valley Hostel] [Arjun] [A-204-B]

**stayos_rent_invoice**: the monthly bill
> Hi {{1}}, your {{2}} bill from {{3}} is ready: {{4}}, due on {{5}}. Bill number {{6}}. Pay here: {{7}} Thank you.

[Arjun] [December] [Green Valley Hostel] [₹8,500] [5 Dec] [INV-2412-014] [https://stayos.space/resident/pay/?invoice=INV-2412-014]

**stayos_rent_due**: 9 AM on the due date
> Hi {{1}}, a reminder from {{2}}: your rent of {{3}} (bill {{4}}) is due today, {{5}}. Pay here: {{6}} Thank you.

[Arjun] [Green Valley Hostel] [₹8,500] [INV-2412-014] [5 Dec] [https://stayos.space/resident/pay/?invoice=INV-2412-014]

**stayos_rent_overdue**: 9 AM, 1, 4, 7, 14, 21 and 30 days late
> Hi {{1}}, your rent of {{2}} at {{3}} is {{4}} days late (bill {{5}}). Please pay here: {{6}} If you have already paid, reply with the UTR number and the office will check.

[Arjun] [₹8,500] [Green Valley Hostel] [4] [INV-2412-014] [https://stayos.space/resident/pay/?invoice=INV-2412-014]

**stayos_payment_receipt**: after a payment is recorded
> Payment received at {{1}}: {{2}} for {{3}}. Bill {{4}}, UTR {{5}}. Thank you!

[Green Valley Hostel] [₹8,500] [December] [INV-2412-014] [412345678901]

**stayos_complaint_received**
> Your complaint at {{1}} is registered. Ticket {{2}}: {{3}} in room {{4}}. We aim to fix it within {{5}}. You'll get updates on this number.

[Green Valley Hostel] [C-1042] [Electrical] [A-204] [24 hours]

**stayos_complaint_update**
> Update from {{1}} on ticket {{2}}: {{3}} is on the way to fix this: {{4}}. We'll message you when it's done.

[Green Valley Hostel] [C-1042] [Suresh] [Fan not working]

**stayos_complaint_resolved**
> Good news from {{1}}: ticket {{2}} is fixed. If anything is still wrong, reply to this message.

[Green Valley Hostel] [C-1042]

**stayos_leave_request**: to the parent, with two **Quick reply** buttons, in this order: `Approve`, `Reject`
> Leave request from {{1}}: {{2}} wants to go out from {{3}} to {{4}}, to {{5}}. Reason: {{6}}. Please approve or reject below.

[Green Valley Hostel] [Arjun] [Fri, 4 Dec, 5:00 pm] [Sun, 6 Dec, 7:00 pm] [Kozhikode] [Going home for the weekend]

The button order matters: the first button approves, the second rejects.

**stayos_leave_decision**
> Update from {{1}}: {{2}}'s leave request is {{3}}. Thank you.

[Green Valley Hostel] [Arjun] [approved]

**stayos_gate_update**: to the parent
> Gate update from {{1}}: {{2}} {{3}} at {{4}}. This is an automatic message.

[Green Valley Hostel] [Arjun] [left the hostel] [5:12 pm]

## 5. Check it works

1. On `/admin`, **StayOS WhatsApp number** should say **Connected**.
2. In a real hostel (not the sample one): Settings → WhatsApp → switch on **Send WhatsApp messages**.
3. Add a test resident with your own phone number (and a parent number you can check).
4. Settings → WhatsApp → **Sent messages** should show the welcome messages as Sent, then Delivered and Read
   as Meta reports them. A **Failed** row shows Meta's reason (usually a template that isn't approved yet, or a
   wording that doesn't match).
5. Reply from your phone: the message appears in the StayOS WhatsApp inbox for that resident.

## Endpoints (for reference)

| | |
| --- | --- |
| `GET /health` | `{ configured }` |
| `POST /flush` `{ org }` | the app, after saving messages (signed-in member of that hostel) |
| `GET /cron/daily` | the 9 AM schedule; reminders only go out between 9 AM and 8 PM IST, each at most once a day |
| `GET/POST /webhook` | Meta |
| `GET /setup` | StayOS admins |

Code: `functions/whatsapp/index.mjs`, table and switch: `db/migrations/013_whatsapp.sql`, app side: `lib/whatsapp.ts`.
