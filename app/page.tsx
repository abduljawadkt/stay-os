"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowRight, BedDouble, Check, CircleCheck, DatabaseZap, IndianRupee, Lock, MapPin, ShieldCheck, Users } from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/marketing/site-chrome";
import { Button } from "@/components/ui/button";
import { brand } from "@/config/brand";
import { cn } from "@/lib/utils";

/** Public home page. Inside the iOS app it is skipped: the app opens on sign-in or the user's hostel. */
export default function Landing() {
  const router = useRouter();
  useEffect(() => {
    const native = !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();
    if (native) router.replace("/start/");
  }, [router]);

  return (
    <div className="demo-site min-h-dvh bg-canvas">
      <SiteHeader />
      <main id="main">
        <Hero />
        <Features />
        <Roles />
        <Trust />
        <ClosingCta />
      </main>
      <SiteFooter />
    </div>
  );
}

function Hero() {
  const t = useTranslations("marketing.hero");
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pt-12 pb-16 sm:px-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:pt-20 lg:pb-24">
      <div>
        <p className="text-sm font-medium text-brand-text">{t("eyebrow")}</p>
        <h1 className="mt-3 max-w-xl text-[36px] leading-[44px] font-semibold tracking-[-0.025em] text-fg sm:text-[44px] sm:leading-[52px]">{t("title")}</h1>
        <p className="mt-4 max-w-[34rem] text-base leading-7 text-fg-2 sm:text-lg sm:leading-8">{t("body", { brand: brand.name })}</p>
        <div className="mt-7 flex flex-wrap gap-2.5">
          <Button asChild variant="primary" size="xl"><Link href="/login/">{t("demo")} <ArrowRight /></Link></Button>
          <Button asChild variant="secondary" size="xl"><Link href="/signup/">{t("trial")}</Link></Button>
        </div>
        <p className="mt-3 text-small text-fg-3">{t("note")}</p>
      </div>
      <HeroPreview />
    </section>
  );
}

/** A still of the product: the owner's collection card, the WhatsApp reminder, and the payment landing. */
function HeroPreview() {
  const t = useTranslations("marketing.preview");
  const bars = [92, 94, 91, 95, 93, 88.5];
  return (
    <div aria-hidden className="relative mx-auto w-full max-w-[520px] select-none">
      <div className="rounded-xl border border-line bg-surface p-5 shadow-sm">
        <div className="flex items-center justify-between text-xs text-fg-3">
          <span>{t("label")}</span>
          <span className="inline-flex items-center gap-1"><span className="size-1.5 rounded-full bg-success" /> Live</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <p className="text-small text-fg-2">{t("collected")}</p>
            <p className="mt-1 text-[28px] leading-9 font-semibold tracking-[-0.02em] text-fg tnum">₹21,21,000</p>
            <p className="text-small text-fg-3 tnum">{t("ofBilled", { pct: "88.5%" })}</p>
          </div>
          <div>
            <p className="text-small text-fg-2">{t("occupancy")}</p>
            <p className="mt-1 text-[28px] leading-9 font-semibold tracking-[-0.02em] text-fg tnum">86.7%</p>
            <p className="text-small text-fg-3 tnum">260 / 300</p>
          </div>
        </div>
        <div className="mt-5 flex h-24 items-end gap-2 border-b border-line pb-px">
          {bars.map((b, i) => (
            <div key={i} className="flex flex-1 items-end gap-0.5">
              <div className="w-1/2 rounded-t-[3px] bg-surface-3" style={{ height: `${70 + i * 3}px` }} />
              <div className={cn("w-1/2 rounded-t-[3px]", i === bars.length - 1 ? "bg-brand" : "bg-brand/70")} style={{ height: `${(70 + i * 3) * (b / 100)}px` }} />
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] text-fg-3"><span>Jun</span><span>Jul</span><span>Aug</span><span>Sep</span><span>Oct</span><span>Nov</span></div>
      </div>

      <div className="relative z-10 -mt-6 ml-auto w-[78%] max-w-[340px] rounded-xl border border-line bg-[#EFEAE2] p-3 shadow-lg dark:bg-[#1B211F] sm:-mr-4">
        <div className="rounded-lg bg-white p-3 text-[13px] leading-5 text-[#111B21] shadow-sm dark:bg-[#202C33] dark:text-[#E9EDEF]">
          <p className="text-xs font-semibold text-[#0C7366] dark:text-[#4FC2AE]">{t("waFrom")}</p>
          <p className="mt-0.5">{t("waBody")}</p>
          <p className="mt-2 border-t border-black/10 pt-2 text-center text-[13px] font-medium text-[#0A7CFF] dark:border-white/10 dark:text-[#53BDEB]">{t("waButton")}</p>
        </div>
      </div>

      <div className="relative z-20 -mt-3 flex w-[86%] max-w-[360px] items-start gap-2.5 rounded-lg bg-inverse px-4 py-3 text-inverse-fg shadow-lg">
        <CircleCheck className="mt-0.5 size-4 shrink-0 text-brand-tint" />
        <div className="min-w-0">
          <p className="text-sm font-medium">{t("toast")}</p>
          <p className="text-small text-inverse-fg/70">{t("toastSub")}</p>
        </div>
      </div>
    </div>
  );
}

function Features() {
  const t = useTranslations("marketing.features");
  const rows = [
    { key: "rent", icon: IndianRupee },
    { key: "ops", icon: BedDouble },
    { key: "family", icon: Users },
  ] as const;
  return (
    <section id="features" aria-labelledby="features-title" className="scroll-mt-16 border-t border-line bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
        <h2 id="features-title" className="max-w-xl text-[28px] leading-9 font-semibold tracking-[-0.02em] text-fg">{t("title")}</h2>
        <div className="mt-10 divide-y divide-line border-y border-line">
          {rows.map((r) => (
            <div key={r.key} className="grid gap-4 py-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1fr)] md:gap-10">
              <div className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-md bg-brand-tint text-brand-tint-fg"><r.icon className="size-[18px]" aria-hidden /></span>
                <h3 className="pt-1.5 text-lg font-semibold text-fg">{t(`${r.key}.title`)}</h3>
              </div>
              <p className="text-base leading-7 text-fg-2">{t(`${r.key}.body`)}</p>
              <ul className="space-y-1.5 text-sm">
                {(t.raw(`${r.key}.points`) as string[]).map((p) => (
                  <li key={p} className="flex gap-2 text-fg"><Check className="mt-0.5 size-4 shrink-0 text-brand-text" aria-hidden />{p}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Roles() {
  const t = useTranslations("marketing.roles");
  const roles = ["owner", "warden", "resident", "parent"] as const;
  return (
    <section aria-labelledby="roles-title" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
      <h2 id="roles-title" className="text-[28px] leading-9 font-semibold tracking-[-0.02em] text-fg">{t("title")}</h2>
      <dl className="mt-8 grid gap-x-10 gap-y-6 sm:grid-cols-2">
        {roles.map((r, i) => (
          <div key={r} className="flex gap-4">
            <span className="mt-0.5 text-sm font-semibold text-fg-3 tnum">0{i + 1}</span>
            <div>
              <dt className="text-base font-semibold text-fg">{t(`${r}.title`)}</dt>
              <dd className="mt-1 text-base leading-7 text-fg-2">{t(`${r}.body`)}</dd>
            </div>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Trust() {
  const t = useTranslations("marketing.trust");
  const items = t.raw("items") as { title: string; body: string }[];
  const icons = [DatabaseZap, Lock, MapPin];
  return (
    <section aria-labelledby="trust-title" className="border-y border-line bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 id="trust-title" className="flex items-center gap-2 text-[22px] leading-8 font-semibold tracking-[-0.015em] text-fg"><ShieldCheck className="size-5 text-brand-text" aria-hidden /> {t("title")}</h2>
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          {items.map((it, i) => {
            const Icon = icons[i] ?? Lock;
            return (
              <div key={it.title}>
                <Icon className="size-4 text-fg-3" aria-hidden />
                <h3 className="mt-2 text-sm font-semibold text-fg">{it.title}</h3>
                <p className="mt-1 text-sm leading-6 text-fg-2">{it.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ClosingCta() {
  const t = useTranslations("marketing.cta");
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
      <div className="flex flex-col items-start justify-between gap-6 rounded-xl bg-inverse px-6 py-10 text-inverse-fg sm:px-10 md:flex-row md:items-center">
        <div>
          <h2 className="text-[26px] leading-9 font-semibold tracking-[-0.02em]">{t("title")}</h2>
          <p className="mt-1.5 text-base text-inverse-fg/75">{t("body")}</p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Button asChild variant="primary" size="xl"><Link href="/signup/">{t("trial")}</Link></Button>
          <Button asChild size="xl" className="border-white/25 bg-transparent text-inverse-fg hover:bg-white/10"><Link href="/login/">{t("demo")}</Link></Button>
        </div>
      </div>
    </section>
  );
}
