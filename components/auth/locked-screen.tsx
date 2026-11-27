"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, Lock, LogOut, Mail, Repeat } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { openOrg, refreshMemberships, requestApproval, signOut, useSession } from "@/lib/session";
import { PLANS, price, type PlanId } from "@/config/plans";
import { brand } from "@/config/brand";
import { useFormat } from "@/lib/hooks";
import { errorText } from "@/lib/neon";
import { cn } from "@/lib/utils";

/**
 * A hostel whose free trial or approved period has ended. Nothing in it can be opened (the database enforces this too);
 * the data is kept. The owner asks StayOS to switch it back on; everyone else is told to ask the owner.
 */
export function LockedScreen() {
  const t = useTranslations("account.locked");
  const tp = useTranslations("marketing.pricing");
  const f = useFormat();
  const membership = useSession((s) => s.membership);
  const memberships = useSession((s) => s.memberships) ?? [];
  const owner = membership?.role === "owner";
  const [plan, setPlan] = useState<PlanId>((membership?.requestedPlan ?? membership?.plan ?? "growth") as PlanId);
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // once StayOS approves, open the hostel without a reload
  const orgId = membership?.orgId;
  useEffect(() => {
    if (!orgId) return;
    const id = setInterval(async () => {
      await refreshMemberships().catch(() => undefined);
      const m = useSession.getState().memberships?.find((x) => x.orgId === orgId);
      if (m?.active) openOrg(orgId, { force: true });
    }, 30000);
    return () => clearInterval(id);
  }, [orgId]);
  if (!membership) return null;

  const others = memberships.filter((m) => m.orgId !== membership.orgId);
  const wasTrial = membership.subscriptionStatus === "trialing";
  const endedOn = wasTrial ? membership.trialEndsAt : membership.periodEnd;
  const title = membership.subscriptionStatus === "canceled" ? t("pausedTitle") : wasTrial ? t("trialTitle") : t("periodTitle");

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      await requestApproval(plan, cycle);
    } catch (e) {
      setError(errorText(e));
    }
    setBusy(false);
  };

  return (
    <div className="min-h-dvh bg-canvas px-5 pt-[calc(2.5rem+env(safe-area-inset-top))] pb-[calc(2rem+env(safe-area-inset-bottom))]">
      <main className="mx-auto max-w-md">
        <div className="flex items-center gap-2 text-fg-2"><LogoMark size={28} /><span className="text-sm font-medium">{membership.orgName}</span></div>
        <span className="mt-8 grid size-12 place-items-center rounded-2xl bg-warning-tint text-warning-fg"><Lock className="size-6" aria-hidden /></span>
        <h1 className="mt-4 text-[28px] leading-9 font-bold tracking-[-0.02em] text-fg">{owner ? title : t("staffTitle", { hostel: membership.orgName })}</h1>
        <p className="mt-2 text-base text-fg-2">
          {owner ? t("ownerBody", { hostel: membership.orgName, date: endedOn ? f.date(endedOn) : "" }) : t("staffBody")}
        </p>
        <p className="mt-2 text-sm text-fg-3">{t("dataSafe")}</p>

        {owner && (membership.approvalRequestedAt ? (
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-line bg-surface p-4" role="status">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success-fg" aria-hidden />
            <div>
              <p className="text-base font-semibold text-fg">{t("requested", { date: f.date(membership.approvalRequestedAt) })}</p>
              <p className="mt-0.5 text-sm text-fg-2">{t("requestedBody", { plan: tp(`plans.${membership.requestedPlan ?? membership.plan}.name`) })}</p>
            </div>
          </div>
        ) : (
          <section className="mt-6 rounded-2xl border border-line bg-surface p-4" aria-labelledby="pick-plan">
            <h2 id="pick-plan" className="text-base font-semibold text-fg">{t("pick")}</h2>
            <div role="radiogroup" aria-label={t("cycle")} className="mt-3 grid grid-cols-2 rounded-[10px] bg-surface-2 p-0.5">
              {(["monthly", "yearly"] as const).map((c) => (
                <button key={c} type="button" role="radio" aria-checked={cycle === c} onClick={() => setCycle(c)}
                  className={cn("h-9 rounded-lg text-sm font-medium", cycle === c ? "bg-surface text-fg shadow-sm dark:bg-surface-3" : "text-fg-2")}>
                  {tp(c)}
                </button>
              ))}
            </div>
            <div role="radiogroup" aria-label={t("pick")} className="mt-3 space-y-2">
              {PLANS.map((p) => (
                <button key={p.id} type="button" role="radio" aria-checked={plan === p.id} onClick={() => setPlan(p.id)}
                  className={cn("flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left", plan === p.id ? "border-brand bg-brand-tint/40" : "border-line")}>
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-medium text-fg">{tp(`plans.${p.id}.name`)}</span>
                    <span className="block text-sm text-fg-2">{t("upTo", { beds: p.beds })}</span>
                  </span>
                  <span className="text-sm font-medium text-fg tnum">{f.inr(price(p, cycle).perMonth)}{tp("perMonth")}</span>
                </button>
              ))}
            </div>
            {error && <p className="mt-3 text-sm text-danger-fg" role="alert">{error}</p>}
            <Button variant="primary" size="xl" className="mt-4 h-12 w-full rounded-xl" loading={busy} disabled={busy} onClick={send}>{t("request")}</Button>
            <p className="mt-2 text-xs text-fg-3">{t("requestHint")}</p>
          </section>
        ))}

        <a href={`mailto:${brand.supportEmail}?subject=${encodeURIComponent(`${membership.orgName}: StayOS plan`)}`}
          className="mt-6 flex items-center gap-2 text-sm font-medium text-brand-text">
          <Mail className="size-4" aria-hidden /> {t("contact", { email: brand.supportEmail })}
        </a>
        <div className="mt-8 flex flex-wrap gap-2">
          {others.length > 0 && (
            <Button variant="secondary" onClick={() => openOrg(others[0].orgId)}><Repeat /> {t("switch", { hostel: others[0].orgName })}</Button>
          )}
          <Button variant="quiet" onClick={() => signOut()}><LogOut /> {t("signOut")}</Button>
        </div>
      </main>
    </div>
  );
}
