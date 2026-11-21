"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import { AuthShell, FormError } from "@/components/auth/auth-shell";
import { DemoRoleList } from "@/components/auth/demo-signin";
import { boot } from "@/lib/session";
import { brand } from "@/config/brand";

/** "Try the live demo": pick a person in the sample hostel and you're in their app. */
export default function DemoPage() {
  const t = useTranslations("account.demo");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    boot();
  }, []);
  return (
    <AuthShell back="/">
      <div className="mx-auto max-w-md lg:mx-0">
        <span className="grid size-12 place-items-center rounded-2xl bg-brand-tint text-brand-tint-fg"><Sparkles className="size-6" aria-hidden /></span>
        <h1 className="mt-4 text-[30px] leading-9 font-bold tracking-[-0.02em] text-fg sm:text-[28px] sm:font-semibold">{t("title")}</h1>
        <p className="mt-1.5 text-base text-fg-2">{t("body", { brand: brand.name })}</p>
        <div className="mt-6">
          <DemoRoleList large onError={setError} />
        </div>
        <div className="mt-3"><FormError message={error} /></div>
        <p className="mt-5 text-small text-fg-3">{t("note")}</p>
        <p className="mt-6 text-sm text-fg-2">
          {t("own")} <Link href="/signup/" className="font-semibold text-brand-text">{t("trial")}</Link>
        </p>
      </div>
    </AuthShell>
  );
}
