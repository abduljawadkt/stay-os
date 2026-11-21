"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { errorText } from "@/lib/neon";
import { ArrowRight } from "lucide-react";
import { AuthShell, Field, FormError } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { EmailNotVerified, boot, resendVerification, signIn, useSession, verifyEmail } from "@/lib/session";
import { CodeStep } from "@/components/auth/code-step";
import { DemoRoleList } from "@/components/auth/demo-signin";
import { brand } from "@/config/brand";


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
  const [verifying, setVerifying] = useState(false);
  const tc = useTranslations("account.code");

  useEffect(() => {
    boot();
  }, []);

  const afterSignIn = () => {
    const list = useSession.getState().memberships ?? [];
    if (!list.length) router.replace("/onboarding/");
    else router.replace(next && next.startsWith("/") ? next : "/start/");
  };

  // already signed in: go straight to the right place
  useEffect(() => {
    if (auth !== "signed_in" || !memberships || busy) return;
    if (!memberships.length) router.replace("/onboarding/");
    else router.replace(next && next.startsWith("/") ? next : "/start/");
  }, [auth, memberships, busy, next, router]);

  async function go(e: string, p: string, key: string) {
    setError(null);
    if (!e || !p) {
      setError(t("errorRequired"));
      return;
    }
    setBusy(key);
    try {
      await signIn(e, p);
      afterSignIn();
    } catch (err) {
      // account exists but its email isn't confirmed: Neon Auth has just emailed a code
      if (err instanceof EmailNotVerified) setVerifying(true);
      else setError(errorText(err));
      setBusy(null);
    }
  }

  if (verifying) {
    return (
      <AuthShell>
        <CodeStep
          email={email}
          title={tc("verifyTitle")}
          submitLabel={tc("verifySubmit")}
          onSubmit={async (code) => {
            await verifyEmail(email, code, password);
            afterSignIn();
          }}
          onResend={() => resendVerification(email)}
          onBack={() => setVerifying(false)}
        />
      </AuthShell>
    );
  }

  const demoAside = (
    <section aria-labelledby="demo-title" className="hidden rounded-xl border border-line bg-surface p-5 shadow-sm sm:p-6 lg:block">
      <h2 id="demo-title" className="text-lg font-semibold text-fg">{t("demoTitle")}</h2>
      <p className="mt-1 text-sm text-fg-2">{t("demoBody", { brand: brand.name })}</p>
      <div className="mt-4"><DemoRoleList onError={setError} /></div>
      <p className="mt-4 text-small text-fg-3">{t("demoNote")}</p>
    </section>
  );

  return (
    <AuthShell aside={demoAside}>
      <div className="max-w-md">
        <h1 className="text-[30px] leading-9 font-bold tracking-[-0.02em] text-fg sm:text-[28px] sm:font-semibold">{t("title", { brand: brand.name })}</h1>
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
          <div>
            <Field id="password" label={t("password")} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <Link href={`/forgot-password/${email ? `?email=${encodeURIComponent(email)}` : ""}`} className="mt-2 inline-block text-sm font-medium text-brand-text hover:underline">{t("forgot")}</Link>
          </div>
          <FormError message={error} />
          <Button type="submit" variant="primary" size="xl" className="h-[52px] w-full rounded-xl text-[17px] sm:h-12 sm:rounded-lg sm:text-base" loading={busy === "form"} disabled={!!busy}>
            {t("submit")}
          </Button>
        </form>
        <Link href="/demo/" className="mt-6 flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 active:bg-surface-2 lg:hidden">
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold text-fg">{t("demoTitle")}</span>
            <span className="block text-[13px] text-fg-3">{t("demoShort")}</span>
          </span>
          <ArrowRight className="size-5 text-brand-text" aria-hidden />
        </Link>
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
