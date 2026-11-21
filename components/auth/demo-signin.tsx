"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronRight } from "lucide-react";
import { Avatar } from "@/components/common/avatar";
import { DEMO_ACCOUNTS, DEMO_PASSWORD, openOrg, signIn, useSession, type MemberRole } from "@/lib/session";
import { cn } from "@/lib/utils";

const HOME: Record<MemberRole, string> = { owner: "/dashboard/", warden: "/dashboard/", resident: "/resident/", parent: "/parent/" };
const NAMES: Record<MemberRole, string> = { owner: "Rasheed Koya", warden: "Mohammed Ashraf P.", resident: "Anjali Menon", parent: "Rajesh Menon" };
const KEY: Record<MemberRole, "Owner" | "Warden" | "Resident" | "Parent"> = { owner: "Owner", warden: "Warden", resident: "Resident", parent: "Parent" };

/** One tap signs in to the shared sample hostel as the chosen person and opens their app. */
export function DemoRoleList({ large = false, onError }: { large?: boolean; onError?: (message: string) => void }) {
  const t = useTranslations("account.login");
  const router = useRouter();
  const [busy, setBusy] = useState<MemberRole | null>(null);

  async function go(role: MemberRole, email: string) {
    setBusy(role);
    try {
      await signIn(email, DEMO_PASSWORD);
      const demoOrg = (useSession.getState().memberships ?? []).find((m) => m.isDemo);
      if (demoOrg) openOrg(demoOrg.orgId);
      router.replace(HOME[role]);
    } catch (e) {
      onError?.(e instanceof Error ? e.message : String(e));
      setBusy(null);
    }
  }

  return (
    <ul className={cn(large ? "space-y-3" : "space-y-2")}>
      {DEMO_ACCOUNTS.map((a) => (
        <li key={a.role}>
          <button
            type="button"
            disabled={!!busy}
            onClick={() => go(a.role, a.email)}
            className={cn(
              "flex w-full items-center gap-3 border border-line bg-surface text-left transition-colors hover:border-line-strong hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-brand active:bg-surface-2 disabled:opacity-60",
              large ? "rounded-2xl px-4 py-3.5" : "rounded-lg px-3 py-2.5",
              busy === a.role && "border-brand"
            )}
          >
            <Avatar name={NAMES[a.role]} size={large ? 44 : 36} />
            <span className="min-w-0 flex-1">
              <span className={cn("block font-semibold text-fg", large ? "text-[17px]" : "text-sm")}>{t(`demo${KEY[a.role]}`)}</span>
              <span className={cn("block text-fg-3", large ? "text-[14px] leading-5" : "truncate text-small")}>{t(`demo${KEY[a.role]}Meta`)}</span>
            </span>
            {busy === a.role ? (
              <span className="size-5 animate-spin rounded-full border-2 border-brand/25 border-t-brand" aria-label={t("signingIn")} />
            ) : (
              <ChevronRight className="size-5 shrink-0 text-fg-3" aria-hidden />
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}
