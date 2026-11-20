"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Building2, Database, LogOut } from "lucide-react";
import { AuthShell, Field, FormError } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { acceptInvite, boot, createOrg, openOrg, signOut, useSession } from "@/lib/session";
import { cn } from "@/lib/utils";

function Onboarding() {
  const t = useTranslations("account.onboarding");
  const router = useRouter();
  const params = useSearchParams();
  const adding = params.get("new") === "1";
  const auth = useSession((s) => s.auth);
  const user = useSession((s) => s.user);
  const memberships = useSession((s) => s.memberships);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [sample, setSample] = useState(true);
  const [blocks, setBlocks] = useState(2);
  const [floors, setFloors] = useState(3);
  const [busy, setBusy] = useState<"create" | "invite" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | undefined>();
  const [code, setCode] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);

  useEffect(() => {
    boot();
  }, []);
  useEffect(() => {
    if (auth === "signed_out") router.replace("/login/?next=/onboarding/");
  }, [auth, router]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setNameError(t("errorName"));
      return;
    }
    setNameError(undefined);
    setBusy("create");
    try {
      const id = await createOrg({ name, city, sample, blocks, floors });
      await openOrg(id, { force: true });
      router.replace("/dashboard/");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(null);
    }
  }

  async function join(e: React.FormEvent) {
    e.preventDefault();
    setInviteError(null);
    if (!code.trim()) return;
    setBusy("invite");
    try {
      const id = await acceptInvite(code);
      const m = useSession.getState().memberships?.find((x) => x.orgId === id);
      await openOrg(id, { force: true });
      router.replace(m?.role === "resident" ? "/resident/" : m?.role === "parent" ? "/parent/" : "/dashboard/");
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : String(err));
      setBusy(null);
    }
  }

  const rooms = blocks * floors * 10;
  const beds = blocks * floors * 25;

  const invite = (
    <section className="rounded-xl border border-line bg-surface p-5 shadow-sm sm:p-6">
      <h2 className="text-base font-semibold text-fg">{t("inviteTitle")}</h2>
      <p className="mt-1 text-sm text-fg-2">{t("inviteBody")}</p>
      <form onSubmit={join} className="mt-4 flex items-end gap-2" noValidate>
        <Field id="code" label={t("inviteCode")} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} autoComplete="off" className="flex-1" placeholder="A1B2C3D4" />
        <Button type="submit" variant="secondary" size="lg" className="h-12 rounded-xl md:h-9 md:rounded-md" loading={busy === "invite"} disabled={!!busy}>{t("inviteSubmit")}</Button>
      </form>
      {inviteError && <p role="alert" className="mt-2 text-small text-danger-fg">{inviteError}</p>}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4 text-small text-fg-3">
        <span className="truncate">{user ? t("signedInAs", { email: user.email }) : ""}</span>
        <Button variant="quiet" size="sm" onClick={async () => { await signOut(); router.replace("/login/"); }}>
          <LogOut /> {t("signOut")}
        </Button>
      </div>
    </section>
  );

  return (
    <AuthShell aside={invite}>
      <div className="max-w-md">
        {adding && memberships && memberships.length > 0 && (
          <Link href="/dashboard/" className="mb-4 inline-block text-small font-medium text-brand-text hover:underline">← {t("back")}</Link>
        )}
        <h1 className="text-[30px] leading-9 font-bold tracking-[-0.02em] text-fg sm:text-[28px] sm:font-semibold">{t("title")}</h1>
        <p className="mt-1.5 text-base text-fg-2">{t("subtitle")}</p>
        <form className="mt-6 space-y-5" onSubmit={create} noValidate>
          <Field id="hostel-name" label={t("name")} placeholder={t("namePlaceholder")} value={name} onChange={(e) => setName(e.target.value)} error={nameError} autoComplete="organization" />
          <Field id="hostel-city" label={t("city")} placeholder={t("cityPlaceholder")} value={city} onChange={(e) => setCity(e.target.value)} autoComplete="address-level2" />
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-fg">{t("startWith")}</legend>
            <div role="radiogroup" className="grid gap-2 sm:grid-cols-2">
              {[
                { v: true, icon: Database, title: t("sampleTitle"), body: t("sampleBody") },
                { v: false, icon: Building2, title: t("emptyTitle"), body: t("emptyBody") },
              ].map((o) => (
                <button
                  key={String(o.v)}
                  type="button"
                  role="radio"
                  aria-checked={sample === o.v}
                  aria-label={o.title}
                  onClick={() => setSample(o.v)}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-lg border bg-surface p-3.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-brand",
                    sample === o.v ? "border-brand ring-1 ring-brand" : "border-line hover:border-line-strong"
                  )}
                >
                  <o.icon className={cn("mb-1 size-5", sample === o.v ? "text-brand-text" : "text-fg-3")} aria-hidden />
                  <span className="text-sm font-semibold text-fg">{o.title}</span>
                  <span className="text-small text-fg-2">{o.body}</span>
                </button>
              ))}
            </div>
          </fieldset>
          {!sample && (
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: "blocks", label: t("blocks"), value: blocks, set: setBlocks, max: 6 },
                { id: "floors", label: t("floors"), value: floors, set: setFloors, max: 8 },
              ].map((x) => (
                <div key={x.id} className="space-y-1.5">
                  <Label htmlFor={x.id}>{x.label}</Label>
                  <select
                    id={x.id}
                    value={x.value}
                    onChange={(e) => x.set(Number(e.target.value))}
                    className="h-10 w-full rounded-md border border-input bg-surface px-2.5 text-base focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/20 focus-visible:outline-none md:h-9 md:text-sm"
                  >
                    {Array.from({ length: x.max }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              ))}
              <p className="col-span-2 text-small text-fg-3">{t("layoutHint", { rooms, beds })}</p>
            </div>
          )}
          <FormError message={error} />
          <Button type="submit" variant="primary" size="xl" className="h-[52px] w-full rounded-xl text-[17px] sm:h-12 sm:rounded-lg sm:text-base" loading={busy === "create"} disabled={!!busy}>
            {busy === "create" ? t("creating") : t("submit")}
          </Button>
        </form>
      </div>
    </AuthShell>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense>
      <Onboarding />
    </Suspense>
  );
}
