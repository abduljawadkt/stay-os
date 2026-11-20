"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CircleCheck, Copy, CreditCard, Download, MessageCircle, RotateCcw, Smartphone, UserMinus, UserPlus } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardHeader, PageHeader } from "@/components/common/card";
import { Avatar } from "@/components/common/avatar";
import { OwnerOnly } from "@/components/common/owner-only";
import { Field } from "@/components/auth/auth-shell";
import { CycleToggle, PricingTable, type Cycle } from "@/components/marketing/pricing-table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDemo } from "@/lib/store";
import { neon, errorText } from "@/lib/neon";
import { refreshMemberships, refreshOrgRow, useSession, type OrgRow } from "@/lib/session";
import { useFormat } from "@/lib/hooks";
import { TOTAL_BEDS } from "@/lib/selectors";
import { planById, price, type PlanDef } from "@/config/plans";
import { brand } from "@/config/brand";
import { hostel } from "@/data";
import { cn } from "@/lib/utils";

type Tab = "hostel" | "team" | "billing" | "data";

export function SettingsScreen() {
  const role = useSession((s) => s.membership?.role);
  if (role !== "owner") return <OwnerOnly />;
  return <Settings />;
}

function Settings() {
  const t = useTranslations("settings");
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>((params.get("tab") as Tab) || "hostel");
  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle", { hostel: hostel.name })} />
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList className="no-scrollbar mb-5 max-w-full justify-start overflow-x-auto">
          {(["hostel", "team", "billing", "data"] as const).map((k) => (
            <TabsTrigger key={k} value={k}>{t(`tabs.${k}`)}</TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="hostel"><HostelProfile /></TabsContent>
        <TabsContent value="team"><Team /></TabsContent>
        <TabsContent value="billing"><Billing /></TabsContent>
        <TabsContent value="data"><SampleData /></TabsContent>
      </Tabs>
    </>
  );
}

// ---------------------------------------------------------------------------
function HostelProfile() {
  const t = useTranslations("settings.hostel");
  const org = useSession((s) => s.org)!;
  const [form, setForm] = useState(() => ({
    name: org.name, city: org.city, address: org.address, phone: org.phone, whatsapp: org.whatsapp, upi_id: org.upi_id,
    mess_fee: String(org.mess_fee), deposit: String(org.deposit), due_day: String(org.due_day),
  }));
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const patch = {
      name: form.name.trim() || org.name, city: form.city.trim(), address: form.address.trim(), phone: form.phone.trim(), whatsapp: form.whatsapp.trim(),
      upi_id: form.upi_id.trim(), mess_fee: Number(form.mess_fee) || 0, deposit: Number(form.deposit) || 0, due_day: Math.min(28, Math.max(1, Number(form.due_day) || 7)),
    };
    const { error } = await neon().from("orgs").update(patch).eq("id", org.id);
    setBusy(false);
    if (error) {
      toast.error(errorText(error));
      return;
    }
    Object.assign(hostel, { name: patch.name, city: patch.city, address: patch.address, phone: patch.phone, whatsapp: patch.whatsapp, upiId: patch.upi_id, messFee: patch.mess_fee, deposit: patch.deposit, dueDay: patch.due_day });
    await Promise.all([refreshOrgRow(), refreshMemberships()]);
    toast(t("saved"));
  }

  return (
    <Card>
      <CardHeader title={t("title")} meta={t("body")} />
      <form onSubmit={save} className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
        <Field id="s-name" label={t("name")} value={form.name} onChange={set("name")} />
        <Field id="s-city" label={t("city")} value={form.city} onChange={set("city")} />
        <Field id="s-address" label={t("address")} value={form.address} onChange={set("address")} className="sm:col-span-2" />
        <Field id="s-phone" label={t("phone")} value={form.phone} onChange={set("phone")} inputMode="tel" />
        <Field id="s-wa" label={t("whatsapp")} value={form.whatsapp} onChange={set("whatsapp")} inputMode="tel" />
        <Field id="s-upi" label={t("upi")} value={form.upi_id} onChange={set("upi_id")} />
        <Field id="s-due" label={t("dueDay")} value={form.due_day} onChange={set("due_day")} inputMode="numeric" />
        <Field id="s-mess" label={t("messFee")} value={form.mess_fee} onChange={set("mess_fee")} inputMode="numeric" />
        <Field id="s-dep" label={t("deposit")} value={form.deposit} onChange={set("deposit")} inputMode="numeric" />
        <div className="sm:col-span-2">
          <Button type="submit" variant="primary" loading={busy}>{t("save")}</Button>
        </div>
      </form>
    </Card>
  );
}

// ---------------------------------------------------------------------------
interface MemberRow { user_id: string; role: string; resident_id: string | null; name: string; email: string }
interface InviteRow { code: string; role: string; resident_id: string | null; created_at: string }

function Team() {
  const t = useTranslations("settings.team");
  const tr = useTranslations("roles");
  const orgId = useSession((s) => s.orgId)!;
  const me = useSession((s) => s.user?.id);
  const residents = useDemo((s) => s.residents);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [role, setRole] = useState<"warden" | "resident" | "parent">("warden");
  const [residentId, setResidentId] = useState("");
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<MemberRow | null>(null);

  async function remove(m: MemberRow) {
    const { error } = await neon().from("members").delete().eq("org_id", orgId).eq("user_id", m.user_id);
    setRemoving(null);
    if (error) toast.error(errorText(error));
    else {
      toast(t("removed", { name: m.name || m.email }));
      load();
    }
  }
  async function revoke(c: string) {
    const { error } = await neon().from("invites").delete().eq("code", c);
    if (error) toast.error(errorText(error));
    else {
      toast(t("revoked", { code: c }));
      if (code === c) setCode(null);
      load();
    }
  }

  const load = useCallback(async () => {
    const [m, i] = await Promise.all([
      neon().from("members").select("user_id,role,resident_id,name,email").eq("org_id", orgId).order("created_at"),
      neon().from("invites").select("code,role,resident_id,created_at").eq("org_id", orgId).is("used_at", null).order("created_at", { ascending: false }),
    ]);
    setMembers((m.data ?? []) as MemberRow[]);
    setInvites((i.data ?? []) as InviteRow[]);
  }, [orgId]);
  useEffect(() => {
    load();
  }, [load]);

  const current = useMemo(() => residents.filter((r) => r.status !== "checked_out").sort((a, b) => a.name.localeCompare(b.name)), [residents]);
  const residentName = (id: string | null) => (id ? residents.find((r) => r.id === id)?.name ?? id : "");

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (role !== "warden" && !residentId) {
      toast.error(t("chooseResident"));
      return;
    }
    setBusy(true);
    const { data, error } = await neon().rpc("create_invite", { p_org: orgId, p_role: role, p_resident_id: role === "warden" ? null : residentId });
    setBusy(false);
    if (error) {
      toast.error(errorText(error));
      return;
    }
    setCode(data as string);
    load();
  }

  const url = typeof window !== "undefined" ? `${window.location.origin}/signup/` : "";
  const shareText = code ? t("shareText", { hostel: hostel.name, brand: brand.name, url, code }) : "";

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
      <AlertDialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("removeTitle", { name: removing?.name || removing?.email || "" })}</AlertDialogTitle>
            <AlertDialogDescription>{t("removeBody", { hostel: hostel.name })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => removing && remove(removing)}>{t("removeConfirm")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Card className="xl:col-span-3">
        <CardHeader title={t("title")} meta={t("body")} />
        <ul className="divide-y divide-line border-t border-line">
          {members.map((m) => (
            <li key={m.user_id} className="flex items-center gap-3 px-5 py-3">
              <Avatar name={m.name || m.email} size={32} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-fg">{m.name || m.email} {m.user_id === me && <span className="text-fg-3">· {t("you")}</span>}</p>
                <p className="truncate text-small text-fg-3">{m.email}{m.resident_id ? ` · ${residentName(m.resident_id)}` : ""}</p>
              </div>
              <span className="rounded-full bg-surface-2 px-2 text-xs leading-6 font-medium text-fg-2">{tr(m.role as "owner")}</span>
              {m.user_id !== me && m.role !== "owner" && (
                <Button variant="quiet" size="icon-sm" aria-label={t("removeAria", { name: m.name || m.email })} onClick={() => setRemoving(m)}><UserMinus /></Button>
              )}
            </li>
          ))}
          {!members.length && <li className="px-5 py-6 text-sm text-fg-3">{t("empty")}</li>}
        </ul>
      </Card>
      <Card className="xl:col-span-2">
        <CardHeader title={t("inviteTitle")} meta={t("inviteBody")} />
        <form onSubmit={create} className="space-y-4 px-5 pb-5">
          <div className="space-y-1.5">
            <Label htmlFor="inv-role">{t("role")}</Label>
            <select id="inv-role" value={role} onChange={(e) => setRole(e.target.value as typeof role)} className="h-9 w-full rounded-md border border-input bg-surface px-2.5 text-sm focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/20 focus-visible:outline-none">
              {(["warden", "resident", "parent"] as const).map((r) => <option key={r} value={r}>{tr(r)}</option>)}
            </select>
          </div>
          {role !== "warden" && (
            <div className="space-y-1.5">
              <Label htmlFor="inv-res">{t("residentFor")}</Label>
              <select id="inv-res" value={residentId} onChange={(e) => setResidentId(e.target.value)} className="h-9 w-full rounded-md border border-input bg-surface px-2.5 text-sm focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/20 focus-visible:outline-none">
                <option value="">{t("chooseResident")}</option>
                {current.map((r) => <option key={r.id} value={r.id}>{r.name} · {r.bedId}</option>)}
              </select>
            </div>
          )}
          <Button type="submit" variant="primary" loading={busy}><UserPlus /> {t("create")}</Button>
        </form>
        {code && (
          <div className="mx-5 mb-5 rounded-lg border border-brand/40 bg-brand-tint p-4">
            <p className="text-small text-brand-tint-fg">{t("code")}</p>
            <p className="mt-0.5 font-mono text-2xl font-semibold tracking-[0.15em] text-fg">{code}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => { navigator.clipboard?.writeText(code); toast(t("copied")); }}><Copy /> {t("copy")}</Button>
              <Button size="sm" asChild><a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noreferrer"><MessageCircle /> {t("share")}</a></Button>
            </div>
          </div>
        )}
        {invites.length > 0 && (
          <div className="border-t border-line px-5 py-4">
            <p className="mb-2 text-xs font-medium text-fg-3">{t("pending")}</p>
            <ul className="space-y-1.5 text-sm">
              {invites.slice(0, 6).map((i) => (
                <li key={i.code} className="flex items-center gap-2">
                  <span className="font-mono text-fg">{i.code}</span>
                  <span className="min-w-0 flex-1 truncate text-small text-fg-3">{tr(i.role as "warden")}{i.resident_id ? ` · ${residentName(i.resident_id)}` : ""}</span>
                  <Button variant="quiet" size="xs" onClick={() => revoke(i.code)}>{t("revoke")}</Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
interface BillRow { id: string; plan: string; cycle: string; period_start: string; period_end: string; amount: number; gst: number; total: number; status: string; method: string; paid_at: string }

function Billing() {
  const t = useTranslations("settings.billing");
  const tp = useTranslations("marketing.pricing");
  const f = useFormat();
  const org = useSession((s) => s.org)!;
  const isDemo = useSession((s) => s.membership?.isDemo);
  const [cycle, setCycle] = useState<Cycle>(org.billing_cycle ?? "monthly");
  const [checkout, setCheckout] = useState<PlanDef | null>(null);
  const [history, setHistory] = useState<BillRow[]>([]);
  const plan = planById(org.plan);

  const load = useCallback(async () => {
    const { data } = await neon().from("billing_invoices").select("*").eq("org_id", org.id).order("paid_at", { ascending: false });
    setHistory((data ?? []) as BillRow[]);
  }, [org.id]);
  useEffect(() => {
    load();
  }, [load]);

  const trialDays = org.trial_ends_at ? Math.max(0, Math.ceil((new Date(org.trial_ends_at).getTime() - Date.now()) / 86400000)) : 0;
  const status =
    org.subscription_status === "trialing"
      ? trialDays > 0 ? t("trial", { days: trialDays }) : t("trialEnded")
      : t("active", { date: org.current_period_end ? f.date(org.current_period_end) : "" });
  const used = TOTAL_BEDS;
  const pct = Math.min(100, Math.round((used / plan.beds) * 100));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title={t("title")} meta={isDemo ? t("demoNote") : undefined} />
        <div className="grid gap-6 px-5 pb-5 md:grid-cols-2">
          <div>
            <p className="text-[26px] leading-8 font-semibold tracking-[-0.02em] text-fg">{tp(`plans.${plan.id}.name`)}</p>
            <p className={cn("mt-1 inline-flex items-center gap-1.5 text-sm", org.subscription_status === "trialing" ? "text-warning-fg" : "text-success-fg")}>
              <span className={cn("size-1.5 rounded-full", org.subscription_status === "trialing" ? "bg-warning" : "bg-success")} aria-hidden /> {status}
            </p>
            <p className="mt-1 text-small text-fg-3 tnum">{f.inr(price(plan, org.billing_cycle ?? "monthly").perMonth)}{tp("perMonth")} {tp("plusGst")}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-fg">{t("usage")}</p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={used} aria-valuemin={0} aria-valuemax={plan.beds} aria-label={t("usage")}>
              <div className={cn("h-full rounded-full", used > plan.beds ? "bg-danger" : "bg-brand")} style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-1.5 text-small text-fg-2 tnum">{t("usageBody", { beds: f.num(used), limit: f.num(plan.beds), plan: tp(`plans.${plan.id}.name`) })}</p>
            {used > plan.beds && <p className="mt-1 text-small text-danger-fg">{t("over")}</p>}
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <h2 className="text-base font-semibold text-fg">{org.subscription_status === "trialing" ? t("choose") : t("change")}</h2>
        <CycleToggle cycle={cycle} onChange={setCycle} />
      </div>
      <PricingTable
        cycle={cycle}
        current={org.subscription_status === "active" ? plan.id : null}
        action={(p) => {
          const isCurrent = org.subscription_status === "active" && p.id === plan.id && (org.billing_cycle ?? "monthly") === cycle;
          return (
            <Button variant={p.popular ? "primary" : "secondary"} size="lg" className="w-full" disabled={isCurrent} onClick={() => setCheckout(p)}>
              {isCurrent ? tp("current") : tp("choose", { plan: tp(`plans.${p.id}.name`) })}
            </Button>
          );
        }}
      />

      <Card>
        <CardHeader title={t("history")} />
        {history.length ? (
          <div className="scrollbar-thin relative overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-y border-line text-xs text-fg-2">
                  <th className="py-2 pl-5 text-left font-medium">{t("invoice")}</th>
                  <th className="px-3 text-left font-medium">{t("period")}</th>
                  <th className="px-3 text-right font-medium">{t("amount")}</th>
                  <th className="px-3 text-left font-medium">{t("status")}</th>
                  <th className="py-2 pr-5" />
                </tr>
              </thead>
              <tbody>
                {history.map((b) => (
                  <tr key={b.id} className="border-b border-line last:border-0">
                    <td className="py-2.5 pl-5 font-mono text-small text-fg">{b.id}</td>
                    <td className="px-3 text-fg-2">{tp(`plans.${b.plan}.name`)} · {f.date(b.period_start)} – {f.date(b.period_end)}</td>
                    <td className="px-3 text-right text-fg tnum">{f.inr(b.total)}</td>
                    <td className="px-3"><span className="rounded-full bg-success-tint px-2 text-xs leading-6 text-success-fg">{t("paid")}</span></td>
                    <td className="py-2.5 pr-5 text-right">
                      <Button variant="quiet" size="sm" onClick={() => printInvoice(b, org)}><Download /> {t("download")}</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-5 pb-5 text-sm text-fg-3">{t("noHistory")}</p>
        )}
      </Card>

      <CheckoutDialog plan={checkout} cycle={cycle} onClose={() => setCheckout(null)} onPaid={load} />
    </div>
  );
}

function CheckoutDialog({ plan, cycle, onClose, onPaid }: { plan: PlanDef | null; cycle: Cycle; onClose: () => void; onPaid: () => void }) {
  const t = useTranslations("settings.billing");
  const tp = useTranslations("marketing.pricing");
  const f = useFormat();
  const orgId = useSession((s) => s.orgId);
  const [method, setMethod] = useState<"upi" | "card">("upi");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ invoice: string; total: number } | null>(null);
  useEffect(() => {
    if (plan) setDone(null);
  }, [plan]);
  if (!plan) return null;
  const pr = price(plan, cycle);
  const name = tp(`plans.${plan.id}.name`);

  async function pay() {
    setBusy(true);
    // a gateway would take the payment here; test mode waits a moment like one would
    await new Promise((r) => setTimeout(r, 900));
    const { data, error } = await neon().rpc("checkout_plan", { p_org: orgId, p_plan: plan!.id, p_cycle: cycle, p_method: method });
    setBusy(false);
    if (error) {
      toast.error(errorText(error));
      return;
    }
    const res = data as { invoice: string; total: number };
    setDone(res);
    await Promise.all([refreshOrgRow(), refreshMemberships()]);
    onPaid();
    toast(t("success", { plan: name }), { description: t("successSub", { invoice: res.invoice, amount: f.inr(res.total) }) });
  }

  return (
    <Dialog open={!!plan} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-md">
        {done ? (
          <div className="py-4 text-center">
            <CircleCheck className="mx-auto size-10 text-success" aria-hidden />
            <DialogTitle className="mt-3">{t("success", { plan: name })}</DialogTitle>
            <DialogDescription className="mt-1">{t("successSub", { invoice: done.invoice, amount: f.inr(done.total) })}</DialogDescription>
            <Button variant="primary" className="mt-5" onClick={onClose}>OK</Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{t("checkoutTitle", { plan: name })}</DialogTitle>
              <DialogDescription>{t("checkoutBody")}</DialogDescription>
            </DialogHeader>
            <dl className="space-y-2 rounded-lg border border-line p-4 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-fg-2">{t("subtotal", { plan: name, cycle: t(cycle) })}</dt><dd className="text-fg tnum">{f.inr(pr.amount)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-fg-2">{t("gst")}</dt><dd className="text-fg tnum">{f.inr(pr.gst)}</dd></div>
              <div className="flex justify-between gap-3 border-t border-line pt-2 font-semibold"><dt className="text-fg">{t("total")}</dt><dd className="text-fg tnum">{f.inr(pr.total)}</dd></div>
            </dl>
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-fg">{t("payWith")}</legend>
              <div role="radiogroup" className="grid grid-cols-2 gap-2">
                {([["upi", Smartphone], ["card", CreditCard]] as const).map(([m, Icon]) => (
                  <button key={m} type="button" role="radio" aria-checked={method === m} onClick={() => setMethod(m)}
                    className={cn("flex items-center gap-2 rounded-md border px-3 py-2.5 text-sm font-medium", method === m ? "border-brand bg-brand-tint text-brand-tint-fg" : "border-line text-fg-2 hover:border-line-strong")}>
                    <Icon className="size-4" aria-hidden /> {t(m)}
                  </button>
                ))}
              </div>
            </fieldset>
            <DialogFooter>
              <Button variant="primary" size="lg" className="w-full" loading={busy} onClick={pay}>
                {busy ? t("processing") : t("pay", { amount: f.inr(pr.total) })}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function printInvoice(b: BillRow, org: OrgRow) {
  const w = window.open("", "_blank", "width=720,height=900");
  if (!w) return;
  const inr = (n: number) => "₹" + n.toLocaleString("en-IN");
  w.document.write(`<!doctype html><html><head><title>${b.id}</title><style>
    body{font:14px/1.5 system-ui,sans-serif;color:#191917;margin:48px}h1{font-size:20px;margin:0}table{width:100%;border-collapse:collapse;margin-top:24px}
    td{padding:8px 0;border-bottom:1px solid #e6e4df}td:last-child{text-align:right}.muted{color:#6e6c65}.total td{font-weight:600;border:0}
  </style></head><body>
    <h1>${brand.name} · Tax invoice</h1><p class="muted">${b.id} · ${new Date(b.paid_at).toLocaleDateString("en-IN")}</p>
    <p><strong>Billed to</strong><br>${org.name}<br>${org.address || org.city}</p>
    <table><tr><td>${b.plan[0].toUpperCase() + b.plan.slice(1)} plan, ${b.cycle} (${b.period_start} to ${b.period_end})</td><td>${inr(b.amount)}</td></tr>
    <tr><td>GST 18%</td><td>${inr(b.gst)}</td></tr><tr class="total"><td>Total paid (${b.method.toUpperCase()}, test mode)</td><td>${inr(b.total)}</td></tr></table>
    <p class="muted" style="margin-top:32px">Test-mode invoice from a demo build. No money was charged.</p>
    <script>window.print()</script></body></html>`);
  w.document.close();
}

// ---------------------------------------------------------------------------
function SampleData() {
  const t = useTranslations("settings.data");
  const sample = useSession((s) => s.org?.settings.clock?.mode === "demo");
  const reset = useDemo((s) => s.reset);
  const [busy, setBusy] = useState(false);
  return (
    <Card>
      <CardHeader title={sample ? t("title") : t("realTitle")} meta={sample ? t("body") : t("realBody")} />
      {sample && (
        <div className="px-5 pb-5">
          <Button
            variant="secondary"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await reset();
              } catch (e) {
                toast.error(errorText(e));
              }
              setBusy(false);
            }}
          >
            <RotateCcw /> {t("reset")}
          </Button>
        </div>
      )}
    </Card>
  );
}

