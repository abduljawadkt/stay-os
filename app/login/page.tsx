"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { AuthShell, Field, FormError } from "@/components/auth/auth-shell";
import { Avatar } from "@/components/common/avatar";
import { Button } from "@/components/ui/button";
import { DEMO_ACCOUNTS, DEMO_PASSWORD, boot, openOrg, signIn, useSession, type MemberRole } from "@/lib/session";
import { brand } from "@/config/brand";
import { cn } from "@/lib/utils";

const HOME: Record<MemberRole, string> = { owner: "/dashboard/", warden: "/dashboard/", resident: "/resident/", parent: "/parent/" };
const DEMO_NAMES: Record<MemberRole, string> = { owner: "Rasheed Koya", warden: "Mohammed Ashraf P.", resident: "Anjali Menon", parent: "Rajesh Menon" };

function LoginForm() {
  const t = useTranslations("account.login");
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const auth = useSession((s) => s.auth);
  const memberships = useSession((s) => s.memberships);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    boot();
  }, []);

  // already signed in: go straight to the right place
  useEffect(() => {
    if (auth !== "signed_in" || !memberships || busy) return;
    if (!memberships.length) router.replace("/onboarding/");
    else router.replace(next && next.startsWith("/") ? next : "/start/");
  }, [auth, memberships, busy, next, router]);

  async function go(e: string, p: string, key: string, demoRole?: MemberRole) {
    setError(null);
    if (!e || !p) {
      setError(t("errorRequired"));
      return;
    }
    setBusy(key);
    try {
      await signIn(e, p);
      const list = useSession.getState().memberships ?? [];
      if (demoRole) {
        const demoOrg = list.find((m) => m.isDemo);
        if (demoOrg) openOrg(demoOrg.orgId);
        router.replace(HOME[demoRole]);
      } else if (!list.length) router.replace("/onboarding/");
      else router.replace(next && next.startsWith("/") ? next : "/start/");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(null);
    }
  }

  const demoAside = (
    <section aria-labelledby="demo-title" className="rounded-xl border border-line bg-surface p-5 shadow-sm sm:p-6">
      <h2 id="demo-title" className="text-lg font-semibold text-fg">{t("demoTitle")}</h2>
      <p className="mt-1 text-sm text-fg-2">{t("demoBody", { brand: brand.name })}</p>
      <ul className="mt-4 space-y-2">
        {DEMO_ACCOUNTS.map((a) => {
          const key = `demo-${a.role}`;
          const label = t(`demo${a.role[0].toUpperCase()}${a.role.slice(1)}` as "demoOwner");
          return (
            <li key={a.role}>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => go(a.email, DEMO_PASSWORD, key, a.role)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2.5 text-left transition-colors hover:border-line-strong hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-60",
                  busy === key && "border-brand"
                )}
              >
                <Avatar name={DEMO_NAMES[a.role]} size={36} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-fg">{label}</span>
                  <span className="block truncate text-small text-fg-3">{t(`demo${a.role[0].toUpperCase()}${a.role.slice(1)}Meta` as "demoOwnerMeta")}</span>
                </span>
                <span className="text-small font-medium text-brand-text">{busy === key ? t("signingIn") : <ArrowRight className="size-4" aria-hidden />}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-small text-fg-3">{t("demoNote")}</p>
    </section>
  );

  return (
    <AuthShell aside={demoAside}>
      <div className="max-w-md">
        <h1 className="text-[28px] leading-9 font-semibold tracking-[-0.02em] text-fg">{t("title", { brand: brand.name })}</h1>
        <p className="mt-1.5 text-base text-fg-2">{t("subtitle")}</p>
        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            go(email, password, "form");
          }}
          noValidate
        >
          <Field id="email" label={t("email")} type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Field id="password" label={t("password")} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <FormError message={error} />
          <Button type="submit" variant="primary" size="xl" className="w-full" loading={busy === "form"} disabled={!!busy}>
            {t("submit")}
          </Button>
        </form>
        <p className="mt-5 text-sm text-fg-2">
          {t("noAccount", { brand: brand.name })}{" "}
          <Link href="/signup/" className="font-medium text-brand-text underline-offset-3 hover:underline">{t("createAccount")}</Link>
        </p>
      </div>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
