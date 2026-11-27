"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Building2, CalendarPlus, CheckCircle2, Copy, LogOut, Mail, MessageCircle, Phone, RefreshCw, ShieldCheck, Users, XCircle } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { boot, checkPlatformAdmin, signOut, useSession } from "@/lib/session";
import { neon, errorText } from "@/lib/neon";
import { whatsappSetup, type WhatsAppSetup } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";

/** One hostel as public.admin_hostels() returns it. */
interface Hostel {
  id: string; name: string; city: string; phone: string; owner_name: string; owner_phone: string; owner_email: string | null;
  plan: string; billing_cycle: string | null; subscription_status: "trialing" | "active" | "past_due" | "canceled";
  trial_ends_at: string | null; current_period_end: string | null; approval_requested_at: string | null;
  requested_plan: string | null; requested_cycle: string | null; approved_at: string | null; approved_by: string | null;
  created_at: string; active: boolean; sample: boolean; members: number; residents: number; beds: number;
}
type Filter = "requests" | "trial" | "active" | "locked" | "all";

const PLAN = { starter: "Starter", growth: "Growth", scale: "Scale" } as Record<string, string>;
const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");
const daysLeft = (iso: string | null) => (iso ? Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000) : 0);

/** StayOS's own admin page: every hostel, its trial or plan, and approving them. Only for StayOS software admins. */
export default function AdminPage() {
  const router = useRouter();
  const auth = useSession((s) => s.auth);
  const user = useSession((s) => s.user);
  const isAdmin = useSession((s) => s.isPlatformAdmin);
  const [checked, setChecked] = useState(false);
  const [hostels, setHostels] = useState<Hostel[] | null>(null);
  const [filter, setFilter] = useState<Filter>("requests");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    boot();
  }, []);
  useEffect(() => {
    if (auth === "signed_out") router.replace("/login/?next=%2Fadmin%2F");
    if (auth === "signed_in") checkPlatformAdmin().then(() => setChecked(true));
  }, [auth, router]);

  const load = useCallback(async () => {
    setError(null);
    const { data, error: e } = await neon().rpc("admin_hostels");
    if (e) setError(errorText(e));
    else setHostels((data ?? []) as Hostel[]);
  }, []);
  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  const groups = useMemo(() => {
    const list = hostels ?? [];
    return {
      requests: list.filter((h) => h.approval_requested_at),
      trial: list.filter((h) => h.active && h.subscription_status === "trialing"),
      active: list.filter((h) => h.active && h.subscription_status === "active"),
      locked: list.filter((h) => !h.active),
      all: list,
    } satisfies Record<Filter, Hostel[]>;
  }, [hostels]);

  if (auth !== "signed_in" || !checked) {
    return <div className="grid min-h-dvh place-items-center bg-canvas"><LogoMark size={36} className="animate-pulse" /></div>;
  }
  if (!isAdmin) {
    return (
      <div className="grid min-h-dvh place-items-center bg-canvas px-6 text-center">
        <div className="max-w-sm">
          <ShieldCheck className="mx-auto size-8 text-fg-3" aria-hidden />
          <h1 className="mt-3 text-xl font-semibold text-fg">StayOS admins only</h1>
          <p className="mt-1 text-sm text-fg-2">{user?.email} isn&apos;t a StayOS admin.</p>
          <Button asChild variant="secondary" className="mt-5"><Link href="/start/">Back to your hostel</Link></Button>
        </div>
      </div>
    );
  }

  const shown = groups[filter];
  return (
    <div className="min-h-dvh bg-canvas pb-[calc(2rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-10 border-b border-line bg-canvas/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
          <LogoMark size={28} />
          <span className="text-base font-semibold text-fg">StayOS admin</span>
          <span className="ml-auto hidden truncate text-small text-fg-3 sm:block">{user?.email}</span>
          <Button variant="quiet" size="icon" aria-label="Refresh" onClick={load}><RefreshCw /></Button>
          <Button variant="quiet" size="icon" aria-label="Sign out" onClick={() => signOut().then(() => router.replace("/"))}><LogOut /></Button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 pt-6">
        <h1 className="text-[28px] leading-9 font-bold tracking-[-0.02em] text-fg">Hostels</h1>
        <p className="mt-1 text-sm text-fg-2">Every hostel gets a 14-day free trial. After that it stays locked until you approve it for a period.</p>

        <div role="tablist" aria-label="Show" className="no-scrollbar -mx-4 mt-5 flex gap-1.5 overflow-x-auto px-4">
          {([["requests", "Requests"], ["trial", "On trial"], ["active", "Approved"], ["locked", "Locked"], ["all", "All"]] as [Filter, string][]).map(([k, label]) => (
            <button key={k} role="tab" aria-selected={filter === k} onClick={() => setFilter(k)}
              className={cn("h-9 shrink-0 rounded-full border px-3.5 text-sm font-medium", filter === k ? "border-brand bg-brand text-white" : "border-line bg-surface text-fg-2")}>
              {label} <span className="tnum opacity-80">{groups[k].length}</span>
            </button>
          ))}
        </div>

        {error && <p className="mt-4 text-sm text-danger-fg" role="alert">{error}</p>}
        {filter === "requests" && <WhatsAppCard />}
        {hostels === null && !error ? (
          <p className="mt-8 text-sm text-fg-3">Loading hostels…</p>
        ) : shown.length === 0 ? (
          <p className="mt-8 rounded-xl border border-dashed border-line-input p-6 text-center text-sm text-fg-2">
            {filter === "requests" ? "No hostel is waiting for approval." : "Nothing here."}
          </p>
        ) : (
          <ul className="mt-4 space-y-3">{shown.map((h) => <HostelCard key={h.id} h={h} onChanged={load} />)}</ul>
        )}
      </main>
    </div>
  );
}

function HostelCard({ h, onChanged }: { h: Hostel; onChanged: () => void }) {
  const [months, setMonths] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmSuspend, setConfirmSuspend] = useState(false);

  const act = async (action: "approve" | "extend_trial" | "suspend") => {
    setBusy(action);
    const { error } = await neon().rpc("admin_set_access", { p_org: h.id, p_action: action, p_months: months, p_days: 7 });
    setBusy(null);
    if (error) return toast.error(errorText(error));
    toast(action === "approve" ? `${h.name} approved for ${months} month${months > 1 ? "s" : ""}` : action === "extend_trial" ? `${h.name}: trial extended by 7 days` : `${h.name} suspended`);
    onChanged();
  };

  const left = h.subscription_status === "trialing" ? daysLeft(h.trial_ends_at) : daysLeft(h.current_period_end);
  const status = !h.active
    ? { label: h.subscription_status === "canceled" ? "Suspended" : h.subscription_status === "trialing" ? `Trial ended ${date(h.trial_ends_at)}` : `Plan ended ${date(h.current_period_end)}`, tone: "danger" as const }
    : h.subscription_status === "trialing"
      ? { label: `Trial · ${left} day${left === 1 ? "" : "s"} left`, tone: "warning" as const }
      : { label: `Approved until ${date(h.current_period_end)}`, tone: "success" as const };

  return (
    <li className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-tint text-brand-tint-fg"><Building2 className="size-5" aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[17px] font-semibold text-fg">{h.name} {h.sample && <Badge variant="neutral" className="ml-1 align-middle">Sample data</Badge>}</p>
          <p className="text-sm text-fg-2">{[h.city, `since ${date(h.created_at)}`].filter(Boolean).join(" · ")}</p>
        </div>
        <Badge variant={status.tone}>{status.label}</Badge>
      </div>

      <div className="mt-3 grid gap-1.5 text-sm text-fg-2 sm:grid-cols-2">
        <p className="flex items-center gap-1.5"><Users className="size-4 text-fg-3" aria-hidden />{h.owner_name || "Owner"} · {h.residents} residents · {h.beds} beds · {h.members} people</p>
        {h.owner_email && <a className="flex items-center gap-1.5 text-brand-text" href={`mailto:${h.owner_email}`}><Mail className="size-4" aria-hidden />{h.owner_email}</a>}
        {(h.owner_phone || h.phone) && <a className="flex items-center gap-1.5 text-brand-text" href={`tel:${(h.owner_phone || h.phone).replace(/\s/g, "")}`}><Phone className="size-4" aria-hidden />{h.owner_phone || h.phone}</a>}
        {h.approved_at && <p className="text-fg-3">Last approved {date(h.approved_at)}{h.approved_by ? ` by ${h.approved_by}` : ""}</p>}
      </div>

      {h.approval_requested_at && (
        <p className="mt-3 rounded-lg bg-warning-tint px-3 py-2 text-sm text-warning-fg">
          Asked on {date(h.approval_requested_at)} for <strong>{PLAN[h.requested_plan ?? h.plan] ?? h.requested_plan}</strong>{h.requested_cycle ? `, billed ${h.requested_cycle}` : ""}.
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
        <label className="sr-only" htmlFor={`m-${h.id}`}>Approve for</label>
        <select id={`m-${h.id}`} value={months} onChange={(e) => setMonths(Number(e.target.value))}
          className="h-10 rounded-md border border-input bg-surface px-2.5 text-base md:h-9 md:text-sm">
          {[1, 3, 6, 12].map((m) => <option key={m} value={m}>{m} month{m > 1 ? "s" : ""}</option>)}
        </select>
        <Button variant="primary" loading={busy === "approve"} disabled={!!busy} onClick={() => act("approve")}><CheckCircle2 /> Approve</Button>
        <Button variant="secondary" loading={busy === "extend_trial"} disabled={!!busy} onClick={() => act("extend_trial")}><CalendarPlus /> Trial +7 days</Button>
        {h.active && <Button variant="quiet" className="text-danger-fg" disabled={!!busy} onClick={() => setConfirmSuspend(true)}><XCircle /> Suspend</Button>}
      </div>

      <AlertDialog open={confirmSuspend} onOpenChange={setConfirmSuspend}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suspend {h.name}?</AlertDialogTitle>
            <AlertDialogDescription>Everyone in this hostel is locked out right away. Their data is kept, and approving the hostel again brings everything back.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => act("suspend")}>Suspend</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}

/** The one StayOS WhatsApp number: whether its keys are set, and what to paste into Meta. See docs/whatsapp-setup.md. */
function WhatsAppCard() {
  const [setup, setSetup] = useState<WhatsAppSetup | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    whatsappSetup().then(setSetup).catch((e) => setErr(errorText(e)));
  }, []);
  const copy = (v: string) => {
    navigator.clipboard?.writeText(v);
    toast("Copied");
  };
  if (err) return <p className="mt-4 rounded-xl border border-line bg-surface p-4 text-sm text-fg-2">WhatsApp: {err}</p>;
  if (!setup) return null;
  const keys: [string, boolean][] = [["WA_TOKEN", setup.tokenSet], ["WA_PHONE_ID", setup.phoneIdSet], ["WA_APP_SECRET", setup.appSecretSet]];
  return (
    <section className="mt-5 rounded-2xl border border-line bg-surface p-4 sm:p-5" aria-labelledby="wa-setup">
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-tint text-brand-tint-fg"><MessageCircle className="size-5" aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <h2 id="wa-setup" className="text-[17px] font-semibold text-fg">StayOS WhatsApp number</h2>
          <p className="text-sm text-fg-2">{setup.configured ? "Connected. Hostels that switch WhatsApp on send from this number." : "Not connected: messages are recorded as test mode and not sent."}</p>
        </div>
        <Badge variant={setup.configured ? "success" : "warning"}>{setup.configured ? "Connected" : "Test mode"}</Badge>
        <Button variant="secondary" onClick={() => setOpen((o) => !o)} aria-expanded={open}>{open ? "Hide setup" : "Setup details"}</Button>
      </div>
      {open && (
        <div className="mt-4 space-y-4 border-t border-line pt-4 text-sm text-fg-2">
          <div>
            <p className="font-medium text-fg">1. Keys on the &ldquo;whatsapp&rdquo; Neon Function (Neon Console → Functions → whatsapp → Environment)</p>
            <ul className="mt-1.5 flex flex-wrap gap-2">
              {keys.map(([k, ok]) => <li key={k}><Badge variant={ok ? "success" : "danger"}>{k}: {ok ? "set" : "missing"}</Badge></li>)}
              <li><Badge variant="neutral">WA_LANG: {setup.language}</Badge></li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-fg">2. Webhook (Meta App → WhatsApp → Configuration)</p>
            <div className="mt-1.5 grid gap-2">
              <CopyRow label="Callback URL" value={setup.webhookUrl} onCopy={copy} />
              {setup.verifyToken && <CopyRow label="Verify token" value={setup.verifyToken} onCopy={copy} secret />}
            </div>
            <p className="mt-1.5 text-fg-3">Subscribe to the &ldquo;messages&rdquo; field.</p>
          </div>
          <div>
            <p className="font-medium text-fg">3. Message templates to create in WhatsApp Manager ({setup.templates.length})</p>
            <p className="mt-1.5 font-mono text-small leading-6 break-words text-fg-2">{setup.templates.join(" · ")}</p>
            <p className="mt-1.5 text-fg-3">The exact wording of each is in docs/whatsapp-setup.md.</p>
          </div>
        </div>
      )}
    </section>
  );
}

function CopyRow({ label, value, onCopy, secret }: { label: string; value: string; onCopy: (v: string) => void; secret?: boolean }) {
  const [show, setShow] = useState(!secret);
  return (
    <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2">
      <span className="w-24 shrink-0 text-small text-fg-3">{label}</span>
      <code className="min-w-0 flex-1 truncate font-mono text-small text-fg">{show ? value : "•".repeat(16)}</code>
      {secret && <Button variant="quiet" size="sm" onClick={() => setShow((s) => !s)}>{show ? "Hide" : "Show"}</Button>}
      <Button variant="quiet" size="icon" aria-label={`Copy ${label}`} onClick={() => onCopy(value)}><Copy /></Button>
    </div>
  );
}
