"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "./auth-shell";

/**
 * "Enter the 6-digit code we emailed you." Used to confirm a new account's email and to reset a password.
 * `extra` renders more fields (the new password) above the button.
 */
export function CodeStep({
  email, title, onSubmit, onResend, onBack, submitLabel, extra,
}: {
  email: string;
  title: string;
  onSubmit: (code: string) => Promise<void>;
  onResend: () => Promise<void>;
  onBack: () => void;
  submitLabel: string;
  extra?: React.ReactNode;
}) {
  const t = useTranslations("account.code");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(30);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^\d{6}$/.test(code.trim())) {
      setError(t("errorCode"));
      return;
    }
    setBusy(true);
    try {
      await onSubmit(code.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md">
      <span className="grid size-12 place-items-center rounded-2xl bg-brand-tint text-brand-tint-fg"><MailCheck className="size-6" aria-hidden /></span>
      <h1 className="mt-4 text-[30px] leading-9 font-bold tracking-[-0.02em] text-fg sm:text-[28px] sm:font-semibold">{title}</h1>
      <p className="mt-1.5 text-base text-fg-2">{t("sent", { email })}</p>
      <form className="mt-6 space-y-4" onSubmit={submit} noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="otp">{t("label")}</Label>
          <Input
            id="otp"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            placeholder="••••••"
            aria-invalid={!!error || undefined}
            className="h-14 rounded-xl text-center font-mono text-2xl tracking-[0.5em] md:h-12 md:text-xl"
          />
        </div>
        {extra}
        <FormError message={error} />
        <Button type="submit" variant="primary" size="xl" className="h-[52px] w-full rounded-xl text-[17px] sm:h-12 sm:rounded-lg sm:text-base" loading={busy} disabled={busy}>
          {submitLabel}
        </Button>
      </form>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-sm">
        <button type="button" onClick={onBack} className="text-fg-2 hover:text-fg">← {t("back")}</button>
        <button
          type="button"
          disabled={cooldown > 0}
          onClick={async () => {
            setError(null);
            try {
              await onResend();
              setSent(true);
              setCooldown(30);
            } catch (err) {
              setError(err instanceof Error ? err.message : String(err));
            }
          }}
          className="font-medium text-brand-text disabled:text-fg-3"
        >
          {cooldown > 0 ? t("resendIn", { s: cooldown }) : sent ? t("resendAgain") : t("resend")}
        </button>
      </div>
      <p className="mt-4 text-small text-fg-3">{t("spam")}</p>
    </div>
  );
}
