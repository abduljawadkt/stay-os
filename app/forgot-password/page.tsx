"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { errorText } from "@/lib/neon";
import { KeyRound } from "lucide-react";
import { AuthShell, Field, FormError } from "@/components/auth/auth-shell";
import { CodeStep } from "@/components/auth/code-step";
import { Button } from "@/components/ui/button";
import { requestPasswordReset, resetPassword } from "@/lib/session";

function Forgot() {
  const t = useTranslations("account.forgot");
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [step, setStep] = useState<"email" | "code">("email");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError(t("errorEmail"));
      return;
    }
    setBusy(true);
    try {
      await requestPasswordReset(email);
      setStep("code");
    } catch (err) {
      setError(errorText(err));
    }
    setBusy(false);
  }

  if (step === "code") {
    return (
      <AuthShell>
        <CodeStep
          email={email}
          title={t("codeTitle")}
          submitLabel={t("submit")}
          extra={<Field id="new-password" label={t("newPassword")} hint={t("passwordHint")} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
          onSubmit={async (code) => {
            if (password.length < 8) throw new Error(t("passwordHint"));
            await resetPassword(email, code, password);
            router.replace("/start/");
          }}
          onResend={() => requestPasswordReset(email)}
          onBack={() => setStep("email")}
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div className="max-w-md">
        <span className="grid size-12 place-items-center rounded-2xl bg-brand-tint text-brand-tint-fg"><KeyRound className="size-6" aria-hidden /></span>
        <h1 className="mt-4 text-[30px] leading-9 font-bold tracking-[-0.02em] text-fg sm:text-[28px] sm:font-semibold">{t("title")}</h1>
        <p className="mt-1.5 text-base text-fg-2">{t("body")}</p>
        <form className="mt-6 space-y-4" onSubmit={send} noValidate>
          <Field id="email" label={t("email")} type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <FormError message={error} />
          <Button type="submit" variant="primary" size="xl" className="h-[52px] w-full rounded-xl text-[17px] sm:h-12 sm:rounded-lg sm:text-base" loading={busy} disabled={busy}>
            {t("send")}
          </Button>
        </form>
        <p className="mt-5 text-sm text-fg-2">
          <Link href="/login/" className="font-medium text-brand-text hover:underline">← {t("back")}</Link>
        </p>
      </div>
    </AuthShell>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <Forgot />
    </Suspense>
  );
}
