"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { AuthShell, Field, FormError } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { boot, resendVerification, signUp, useSession, verifyEmail } from "@/lib/session";
import { CodeStep } from "@/components/auth/code-step";

export default function SignupPage() {
  const t = useTranslations("account.signup");
  const tp = useTranslations("marketing.trial");
  const router = useRouter();
  const auth = useSession((s) => s.auth);
  const memberships = useSession((s) => s.memberships);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const tc = useTranslations("account.code");

  useEffect(() => {
    boot();
  }, []);
  useEffect(() => {
    if (auth === "signed_in" && memberships && !busy) router.replace(memberships.some((m) => !m.isDemo) ? "/start/" : "/onboarding/");
  }, [auth, memberships, busy, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = t("errorName");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) errs.email = t("errorEmail");
    if (password.length < 8) errs.password = t("errorPassword");
    setErrors(errs);
    setError(null);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const result = await signUp(name, email, password);
      if (result === "verify") {
        setVerifying(true);
        setBusy(false);
        return;
      }
      router.replace("/onboarding/");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
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
            router.replace("/onboarding/");
          }}
          onResend={() => resendVerification(email)}
          onBack={() => setVerifying(false)}
        />
      </AuthShell>
    );
  }

  const aside = (
    <section className="rounded-xl border border-line bg-surface p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold text-fg">{tp("title")}</h2>
      <ul className="mt-3 space-y-2.5">
        {(["p1", "p2", "p3", "p4"] as const).map((k) => (
          <li key={k} className="flex gap-2.5 text-sm text-fg-2">
            <Check className="mt-0.5 size-4 shrink-0 text-brand-text" aria-hidden />
            {tp(k)}
          </li>
        ))}
      </ul>
    </section>
  );

  return (
    <AuthShell aside={aside}>
      <div className="max-w-md">
        <h1 className="text-[30px] leading-9 font-bold tracking-[-0.02em] text-fg sm:text-[28px] sm:font-semibold">{t("title")}</h1>
        <p className="mt-1.5 text-base text-fg-2">{t("subtitle")}</p>
        <form className="mt-6 space-y-4" onSubmit={submit} noValidate>
          <Field id="name" label={t("name")} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />
          <Field id="email" label={t("email")} type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
          <Field id="password" label={t("password")} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} hint={t("passwordHint")} />
          <FormError message={error} />
          <Button type="submit" variant="primary" size="xl" className="h-[52px] w-full rounded-xl text-[17px] sm:h-12 sm:rounded-lg sm:text-base" loading={busy} disabled={busy}>
            {t("submit")}
          </Button>
          <p className="text-small text-fg-3">
            {t.rich("termsRich", {
              terms: (c) => <Link href="/terms/" className="underline underline-offset-2 hover:text-fg">{c}</Link>,
              privacy: (c) => <Link href="/privacy/" className="underline underline-offset-2 hover:text-fg">{c}</Link>,
            })}
          </p>
        </form>
        <p className="mt-5 text-sm text-fg-2">
          {t("haveAccount")}{" "}
          <Link href="/login/" className="font-medium text-brand-text underline-offset-3 hover:underline">{t("signIn")}</Link>
        </p>
      </div>
    </AuthShell>
  );
}
