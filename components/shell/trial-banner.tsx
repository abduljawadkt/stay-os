"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import { useSession } from "@/lib/session";
import { planById } from "@/config/plans";

/** Owners on a trial see how long is left and a way to pick a plan. */
export function TrialBanner() {
  const t = useTranslations("account.trial");
  const tp = useTranslations("marketing.pricing.plans");
  const org = useSession((s) => s.org);
  const owner = useSession((s) => s.membership?.role === "owner");
  if (!org || !owner || org.subscription_status !== "trialing") return null;
  const days = org.trial_ends_at ? Math.max(0, Math.ceil((new Date(org.trial_ends_at).getTime() - Date.now()) / 86400000)) : 0;
  return (
    <div className="demo-chrome flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line bg-brand-tint px-4 py-2 text-small text-brand-tint-fg sm:px-6 lg:px-8">
      <Sparkles className="size-3.5 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1">{days > 0 ? t("left", { days, plan: tp(`${planById(org.plan).id}.name`) }) : t("ended")}</span>
      <Link href="/dashboard/settings/?tab=billing" className="font-medium underline underline-offset-3 hover:no-underline">{t("choose")}</Link>
    </div>
  );
}
