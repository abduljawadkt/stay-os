"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Compass } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";

/** Any address that doesn't exist: say so plainly and offer the way home, to the demo and to sign in. */
export function NotFoundScreen() {
  const t = useTranslations("account.notFound");
  return (
    <AuthShell back="/">
      <div className="mx-auto max-w-md lg:mx-0">
        <span className="grid size-12 place-items-center rounded-2xl bg-brand-tint text-brand-tint-fg"><Compass className="size-6" aria-hidden /></span>
        <h1 className="mt-4 text-[30px] leading-9 font-bold tracking-[-0.02em] text-fg sm:text-[28px] sm:font-semibold">{t("title")}</h1>
        <p className="mt-1.5 text-base text-fg-2">{t("body")}</p>
        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
          <Button asChild variant="default" size="xl"><Link href="/">{t("home")}</Link></Button>
          <Button asChild variant="outline" size="xl"><Link href="/demo/">{t("demo")}</Link></Button>
        </div>
        <p className="mt-6 text-sm text-fg-2">
          {t("account")} <Link href="/login/" className="font-semibold text-brand-text">{t("signIn")}</Link>
        </p>
      </div>
    </AuthShell>
  );
}
