"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { LocaleToggle } from "@/components/shell/locale-toggle";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { boot, useSession } from "@/lib/session";
import { brand } from "@/config/brand";

export function SiteHeader() {
  const t = useTranslations("marketing.nav");
  const signedIn = useSession((s) => s.auth === "signed_in");
  useEffect(() => {
    boot();
  }, []);
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-canvas/95 pt-[env(safe-area-inset-top)] backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Link href="/" className="shrink-0 rounded-md" aria-label={brand.name}>
          <Logo />
        </Link>
        <nav aria-label="Site" className="ml-4 hidden items-center gap-1 md:flex">
          <Link href="/#features" className="rounded-md px-2.5 py-1.5 text-sm text-fg-2 hover:bg-surface-2 hover:text-fg">{t("features")}</Link>
          <Link href="/pricing/" className="rounded-md px-2.5 py-1.5 text-sm text-fg-2 hover:bg-surface-2 hover:text-fg">{t("pricing")}</Link>
          <Link href="/login/" className="rounded-md px-2.5 py-1.5 text-sm text-fg-2 hover:bg-surface-2 hover:text-fg">{t("demo")}</Link>
        </nav>
        <div className="ml-auto flex items-center gap-1.5">
          <LocaleToggle />
          <span className="hidden sm:inline-flex"><ThemeToggle /></span>
          {signedIn ? (
            <Button asChild variant="primary"><Link href="/start/">{t("dashboard")}</Link></Button>
          ) : (
            <>
              <Button asChild variant="quiet" className="hidden sm:inline-flex"><Link href="/login/">{t("signIn")}</Link></Button>
              <Button asChild variant="primary"><Link href="/signup/">{t("trial")}</Link></Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const t = useTranslations("marketing");
  return (
    <footer className="border-t border-line bg-canvas pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 grid-cols-2 md:grid-cols-[2fr_1fr_1fr_1fr]">
        <div className="col-span-2 md:col-span-1">
          <Logo />
          <p className="mt-2 max-w-xs text-sm text-fg-2">{t("footer.tagline")}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-fg-3">{t("footer.product")}</p>
          <ul className="mt-2 space-y-1.5 text-sm">
            <li><Link href="/#features" className="text-fg-2 hover:text-fg">{t("nav.features")}</Link></li>
            <li><Link href="/pricing/" className="text-fg-2 hover:text-fg">{t("nav.pricing")}</Link></li>
            <li><Link href="/login/" className="text-fg-2 hover:text-fg">{t("nav.demo")}</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-xs font-medium text-fg-3">{t("footer.legal")}</p>
          <ul className="mt-2 space-y-1.5 text-sm">
            <li><Link href="/terms/" className="text-fg-2 hover:text-fg">{t("footer.terms")}</Link></li>
            <li><Link href="/privacy/" className="text-fg-2 hover:text-fg">{t("footer.privacy")}</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-xs font-medium text-fg-3">{t("footer.contact")}</p>
          <ul className="mt-2 space-y-1.5 text-sm">
            <li><Link href="/signup/" className="text-fg-2 hover:text-fg">{t("nav.trial")}</Link></li>
            <li><Link href="/login/" className="text-fg-2 hover:text-fg">{t("nav.signIn")}</Link></li>
          </ul>
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-4 pb-8 text-xs text-fg-3 sm:px-6">{t("footer.rights", { brand: brand.name })}</div>
    </footer>
  );
}
