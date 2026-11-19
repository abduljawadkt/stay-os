"use client";

import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { PLANS, price, type PlanDef, type PlanId } from "@/config/plans";
import { useFormat } from "@/lib/hooks";
import { cn } from "@/lib/utils";

export type Cycle = "monthly" | "yearly";

export function CycleToggle({ cycle, onChange }: { cycle: Cycle; onChange: (c: Cycle) => void }) {
  const t = useTranslations("marketing.pricing");
  return (
    <div role="radiogroup" aria-label={t("monthly") + " / " + t("yearly")} className="inline-flex rounded-md bg-surface-2 p-0.5">
      {(["monthly", "yearly"] as const).map((c) => (
        <button
          key={c}
          role="radio"
          aria-checked={cycle === c}
          onClick={() => onChange(c)}
          className={cn("flex h-8 items-center gap-1.5 rounded-sm px-3 text-sm font-medium", cycle === c ? "bg-surface text-fg shadow-sm dark:bg-surface-3" : "text-fg-2 hover:text-fg")}
        >
          {t(c)}
          {c === "yearly" && <span className="rounded-full bg-brand-tint px-1.5 text-xs leading-5 text-brand-tint-fg">{t("yearlySave")}</span>}
        </button>
      ))}
    </div>
  );
}

/** Three plans side by side. `action` renders each plan's button (sign-up on the site, checkout in Settings). */
export function PricingTable({ cycle, action, current }: { cycle: Cycle; action: (plan: PlanDef) => React.ReactNode; current?: PlanId | null }) {
  const t = useTranslations("marketing.pricing");
  const f = useFormat();
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {PLANS.map((p) => {
        const pr = price(p, cycle);
        return (
          <section
            key={p.id}
            aria-labelledby={`plan-${p.id}`}
            className={cn("relative flex flex-col rounded-xl border bg-surface p-5 sm:p-6", p.popular ? "border-brand ring-1 ring-brand" : "border-line")}
          >
            <div className="flex items-center justify-between gap-2">
              <h3 id={`plan-${p.id}`} className="text-lg font-semibold text-fg">{t(`plans.${p.id}.name`)}</h3>
              {current === p.id ? (
                <span className="rounded-full bg-surface-3 px-2 text-xs leading-6 font-medium text-fg-2">{t("current")}</span>
              ) : p.popular ? (
                <span className="rounded-full bg-brand-tint px-2 text-xs leading-6 font-medium text-brand-tint-fg">{t("popular")}</span>
              ) : null}
            </div>
            <p className="mt-0.5 text-small text-fg-2">{t(`plans.${p.id}.for`)}</p>
            <p className="mt-5 flex items-baseline gap-1">
              <span className="text-[32px] leading-10 font-semibold tracking-[-0.02em] text-fg tnum">{f.inr(pr.perMonth)}</span>
              <span className="text-sm text-fg-3">{t("perMonth")} {t("plusGst")}</span>
            </p>
            <p className="h-5 text-small text-fg-3 tnum">{cycle === "yearly" ? t("billedYearly", { amount: f.inr(pr.amount) }) : ""}</p>
            <div className="mt-4">{action(p)}</div>
            <ul className="mt-5 space-y-2 border-t border-line pt-4 text-sm">
              <li className="flex gap-2 font-medium text-fg"><Check className="mt-0.5 size-4 shrink-0 text-brand-text" aria-hidden />{t("beds", { beds: f.num(p.beds) })}</li>
              <li className="flex gap-2 text-fg-2"><Check className="mt-0.5 size-4 shrink-0 text-brand-text" aria-hidden />{p.staff ? t("staff", { count: p.staff }) : t("staffUnlimited")}</li>
              {p.features.map((k) => (
                <li key={k} className="flex gap-2 text-fg-2"><Check className="mt-0.5 size-4 shrink-0 text-brand-text" aria-hidden />{t(`features.${k}`)}</li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
