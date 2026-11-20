"use client";

import Link from "next/link";
import { SiteFooter, SiteHeader } from "./site-chrome";
import { brand } from "@/config/brand";

export type LegalSection = { title: string; body: (string | string[])[] };

/** Plain-language legal page. Text is English only. */
export function LegalPage({ title, intro, sections }: { title: string; intro: string; sections: LegalSection[] }) {
  return (
    <div className="min-h-dvh bg-canvas">
      <SiteHeader />
      <main id="main" className="mx-auto max-w-3xl px-5 pt-10 pb-16 sm:px-6 lg:pt-14">
        <p className="text-sm text-fg-3">Last updated {brand.legal.updated}</p>
        <h1 className="mt-2 text-[34px] leading-[42px] font-semibold tracking-[-0.025em] text-fg">{title}</h1>
        <p className="mt-3 text-base leading-7 text-fg-2">{intro}</p>
        <nav aria-label="Sections" className="mt-6 rounded-xl border border-line bg-surface p-4">
          <ol className="grid gap-1 text-sm sm:grid-cols-2">
            {sections.map((s, i) => (
              <li key={s.title}><a href={`#s${i + 1}`} className="text-fg-2 hover:text-fg"><span className="text-fg-3 tnum">{i + 1}.</span> {s.title}</a></li>
            ))}
          </ol>
        </nav>
        {sections.map((s, i) => (
          <section key={s.title} id={`s${i + 1}`} className="mt-10 scroll-mt-20">
            <h2 className="text-[20px] leading-7 font-semibold text-fg">{i + 1}. {s.title}</h2>
            {s.body.map((b, j) =>
              Array.isArray(b) ? (
                <ul key={j} className="mt-3 list-disc space-y-1.5 pl-5 text-base leading-7 text-fg-2">
                  {b.map((li) => <li key={li}>{li}</li>)}
                </ul>
              ) : (
                <p key={j} className="mt-3 text-base leading-7 text-fg-2">{b}</p>
              )
            )}
          </section>
        ))}
        <p className="mt-12 border-t border-line pt-6 text-sm text-fg-3">
          Questions about this page: <a href={`mailto:${brand.legal.grievanceEmail}`} className="text-brand-text hover:underline">{brand.legal.grievanceEmail}</a>. See also{" "}
          <Link href="/terms/" className="text-brand-text hover:underline">Terms of service</Link> and{" "}
          <Link href="/privacy/" className="text-brand-text hover:underline">Privacy policy</Link>.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
