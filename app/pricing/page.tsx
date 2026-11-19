"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { SiteFooter, SiteHeader } from "@/components/marketing/site-chrome";
import { CycleToggle, PricingTable, type Cycle } from "@/components/marketing/pricing-table";
import { Button } from "@/components/ui/button";

export default function PricingPage() {
  const t = useTranslations("marketing.pricing");
  const [cycle, setCycle] = useState<Cycle>("monthly");
  const faq = t.raw("faq") as { q: string; a: string }[];
  return (
    <div className="min-h-dvh bg-canvas">
      <SiteHeader />
      <main id="main" className="mx-auto max-w-6xl px-4 pt-12 pb-16 sm:px-6 lg:pt-16">
        <div className="flex flex-col items-start justify-between gap-5 md:flex-row md:items-end">
          <div>
            <h1 className="text-[34px] leading-[42px] font-semibold tracking-[-0.025em] text-fg">{t("title")}</h1>
            <p className="mt-2 max-w-xl text-base text-fg-2">{t("body")}</p>
          </div>
          <CycleToggle cycle={cycle} onChange={setCycle} />
        </div>
        <div className="mt-8">
          <PricingTable
            cycle={cycle}
            action={(p) => (
              <Button asChild variant={p.popular ? "primary" : "secondary"} size="lg" className="w-full">
                <Link href="/signup/">{t("start")}</Link>
              </Button>
            )}
          />
        </div>
        <section aria-labelledby="faq-title" className="mt-16 max-w-3xl">
          <h2 id="faq-title" className="text-[22px] leading-8 font-semibold tracking-[-0.015em] text-fg">{t("faqTitle")}</h2>
          <dl className="mt-4 divide-y divide-line border-y border-line">
            {faq.map((x) => (
              <div key={x.q} className="py-4">
                <dt className="text-base font-medium text-fg">{x.q}</dt>
                <dd className="mt-1 text-sm leading-6 text-fg-2">{x.a}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
