// End-to-end check of functions/payments against the real database and real Neon Auth sign-ins.
// Only Razorpay is faked (its API answers locally), so no keys are needed. Everything is undone at the end.
//   npm run payments:check
import { createHmac } from "node:crypto";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local", quiet: true });

const AUTH = process.env.NEXT_PUBLIC_NEON_AUTH_URL;
const DEMO = "00000000-0000-0000-0000-0000000000d0";
process.env.NEON_AUTH_URL = AUTH;
process.env.APP_URL = "https://stayos.space";
process.env.PUBLIC_URL = "https://payments.example.test";

// fake Razorpay, real everything else
const realFetch = globalThis.fetch;
let created = 0;
globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === "string" ? input : input.url;
  if (url.startsWith("https://api.razorpay.com/")) {
    if (url.includes("/payment_links?count=1")) return Response.json({ items: [] });
    if (url.endsWith("/payment_links") && init.method === "POST") {
      created++;
      return Response.json({ id: `plink_check${Date.now()}`, short_url: "https://rzp.io/i/check", status: "created" });
    }
    return Response.json({ error: { description: "unexpected call" } }, { status: 400 });
  }
  return realFetch(input, init);
};
const { default: handler } = await import("../functions/payments/index.mjs");

async function token(email) {
  const r = await realFetch(`${AUTH}/sign-in/email`, { method: "POST", headers: { origin: "http://localhost:3000", "content-type": "application/json" }, body: JSON.stringify({ email, password: "stayos-demo-2026" }) });
  const cookie = r.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  return (await realFetch(`${AUTH}/get-session`, { headers: { origin: "http://localhost:3000", cookie } })).headers.get("set-auth-jwt");
}
const call = async (path, { jwt, body, method = body ? "POST" : "GET", headers = {} } = {}) => {
  const res = await handler(new Request(`https://payments.example.test${path}`, {
    method, headers: { "content-type": "application/json", ...(jwt ? { authorization: `Bearer ${jwt}` } : {}), ...headers }, body: typeof body === "string" ? body : body ? JSON.stringify(body) : undefined,
  }));
  return { status: res.status, data: await res.json() };
};
async function sql(query, params = []) {
  const host = new URL(process.env.DATABASE_URL).hostname;
  const res = await realFetch(`https://${host}/sql`, { method: "POST", headers: { "Neon-Connection-String": process.env.DATABASE_URL, "content-type": "application/json" }, body: JSON.stringify({ query, params }) });
  return (await res.json()).rows ?? [];
}

let failures = 0;
const expect = (label, ok, extra = "") => { if (!ok) failures++; console.log(`${ok ? "ok  " : "FAIL"} ${label}${ok ? "" : `  ${extra}`}`); };

const owner = await token("owner@demo.stayos.space");
const warden = await token("warden@demo.stayos.space");
const resident = await token("anjali@demo.stayos.space");
const [inv] = await sql("select id, status, paid_on, method, utr, paid_via from public.invoices where org_id = $1 and resident_id = 'R-1042' order by issued_on desc limit 1", [DEMO]);
const settingsBefore = (await sql("select settings -> 'payments' as p from public.orgs where id = $1", [DEMO]))[0]?.p ?? null;

try {
  await sql("update public.invoices set status = 'unpaid', paid_on = null, method = null, utr = null, paid_via = null where org_id = $1 and id = $2", [DEMO, inv.id]);

  expect("health", (await call("/health")).status === 200);
  expect("no sign-in is refused", (await call(`/connection?org=${DEMO}`)).status === 401);
  const [th, tp, ts] = resident.split(".");
  const forged = `${th}.${tp}.${ts.slice(0, 20)}${ts[20] === "A" ? "B" : "A"}${ts.slice(21)}`;
  expect("a forged token is refused", (await call(`/connection?org=${DEMO}`, { jwt: forged })).status === 401);
  const tampered = `${th}.${Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(tp, "base64url")), sub: "someone-else" })).toString("base64url")}.${ts}`;
  expect("a token with a changed user is refused", (await call(`/connection?org=${DEMO}`, { jwt: tampered })).status === 401);
  expect("residents can't see the payment connection", (await call(`/connection?org=${DEMO}`, { jwt: resident })).status === 403);
  expect("not connected yet", (await call(`/connection?org=${DEMO}`, { jwt: owner })).data.connected === false);
  expect("a link can't be made before connecting", (await call("/link", { jwt: resident, body: { org: DEMO, invoice: inv.id } })).data.error === "not_connected");
  expect("wardens can't connect payments", (await call("/connect", { jwt: warden, body: { org: DEMO, keyId: "rzp_test_ABCDEFGH1234", keySecret: "secret_check_123" } })).status === 403);
  expect("bad key format is refused", (await call("/connect", { jwt: owner, body: { org: DEMO, keyId: "nope", keySecret: "x" } })).status === 400);

  const conn = await call("/connect", { jwt: owner, body: { org: DEMO, keyId: "rzp_test_ABCDEFGH1234", keySecret: "secret_check_123" } });
  expect("owner connects Razorpay", conn.status === 200 && conn.data.mode === "test" && !!conn.data.webhookSecret, JSON.stringify(conn.data));
  const stored = (await sql("select key_secret_enc from public.payment_settings where org_id = $1", [DEMO]))[0];
  expect("the key secret is stored encrypted", !!stored && !String(stored.key_secret_enc).includes("secret_check_123"));
  const warn = await call(`/connection?org=${DEMO}`, { jwt: warden });
  expect("wardens see the connection but not the webhook secret", warn.data.connected === true && !warn.data.webhookSecret);

  const link = await call("/link", { jwt: resident, body: { org: DEMO, invoice: inv.id } });
  expect("resident gets a payment link for own invoice", link.status === 200 && link.data.url === "https://rzp.io/i/check", JSON.stringify(link.data));
  expect("the same link is reused", (await call("/link", { jwt: resident, body: { org: DEMO, invoice: inv.id } })).data.reused === true && created === 1);
  const [other] = await sql("select id from public.invoices where org_id = $1 and resident_id <> 'R-1042' and status = 'unpaid' limit 1", [DEMO]);
  if (other) expect("resident can't get a link for someone else's invoice", (await call("/link", { jwt: resident, body: { org: DEMO, invoice: other.id } })).status === 403);

  const [p] = await sql("select id, amount from public.payments where org_id = $1 and invoice_id = $2 and status = 'created'", [DEMO, inv.id]);
  const event = JSON.stringify({
    event: "payment_link.paid",
    payload: {
      payment_link: { entity: { id: p.id, amount: p.amount * 100, amount_paid: p.amount * 100, status: "paid", notes: { org: DEMO, invoice: inv.id } } },
      payment: { entity: { id: "pay_check123", method: "upi", amount: p.amount * 100, acquirer_data: { rrn: "412345678901" } } },
    },
  });
  const sign = (body, secret) => createHmac("sha256", secret).update(body).digest("hex");
  expect("a webhook with a wrong signature is refused", (await call(`/webhook/${DEMO}`, { body: event, headers: { "x-razorpay-signature": sign(event, "wrong") } })).status === 400);
  const cheap = event.replace(`"amount_paid":${p.amount * 100}`, '"amount_paid":100');
  expect("an underpaid confirmation is refused", (await call(`/webhook/${DEMO}`, { body: cheap, headers: { "x-razorpay-signature": sign(cheap, conn.data.webhookSecret) } })).status === 400);
  const ok = await call(`/webhook/${DEMO}`, { body: event, headers: { "x-razorpay-signature": sign(event, conn.data.webhookSecret) } });
  expect("a signed confirmation marks the invoice paid", ok.status === 200 && ok.data.marked === true, JSON.stringify(ok.data));
  const [after] = await sql("select status, method, utr from public.invoices where org_id = $1 and id = $2", [DEMO, inv.id]);
  expect("invoice shows paid by UPI with the bank reference", after.status === "paid" && after.method === "upi" && after.utr === "412345678901", JSON.stringify(after));
  expect("a repeated confirmation is harmless", (await call(`/webhook/${DEMO}`, { body: event, headers: { "x-razorpay-signature": sign(event, conn.data.webhookSecret) } })).data.marked === false);
  expect("no new link for a paid invoice", (await call("/link", { jwt: resident, body: { org: DEMO, invoice: inv.id } })).data.error === "already_paid");

  expect("owner disconnects", (await call("/disconnect", { jwt: owner, body: { org: DEMO } })).data.connected === false);
} finally {
  // put everything back
  await sql("delete from public.payments where org_id = $1 and id like 'plink_check%'", [DEMO]);
  await sql("delete from public.payment_settings where org_id = $1", [DEMO]);
  await sql("delete from public.activity where org_id = $1 and kind = 'payment' and data ->> 'invoiceId' = $2 and at > now() - interval '10 minutes'", [DEMO, inv.id]);
  await sql(
    settingsBefore ? "update public.orgs set settings = settings || jsonb_build_object('payments', $2::jsonb) where id = $1" : "update public.orgs set settings = settings - 'payments' where id = $1",
    settingsBefore ? [DEMO, JSON.stringify(settingsBefore)] : [DEMO]
  );
  await sql("update public.invoices set status = $3, paid_on = $4, method = $5, utr = $6, paid_via = $7 where org_id = $1 and id = $2", [DEMO, inv.id, inv.status, inv.paid_on, inv.method, inv.utr, inv.paid_via]);
}
process.exit(failures ? 1 : 0);
