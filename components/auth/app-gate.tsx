"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertCircle, LogOut, RotateCw } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { boot, openOrg, pickOrg, signOut, useSession } from "@/lib/session";

type Area = "dashboard" | "resident" | "parent";

/**
 * Wraps every signed-in area. Sends visitors to sign in, people without a hostel to onboarding,
 * and residents or parents to their own app; loads the hostel's data before the screens render.
 */
export function AppGate({ area, children }: { area: Area; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const auth = useSession((s) => s.auth);
  const memberships = useSession((s) => s.memberships);
  const orgStatus = useSession((s) => s.orgStatus);
  const membership = useSession((s) => s.membership);

  useEffect(() => {
    boot();
  }, []);

  useEffect(() => {
    if (auth === "signed_out") router.replace(`/login/?next=${encodeURIComponent(pathname)}`);
    if (auth !== "signed_in" || !memberships) return;
    if (!memberships.length) {
      router.replace("/onboarding/");
      return;
    }
    const current = useSession.getState();
    if (current.orgStatus === "none" || (current.orgStatus === "error" && !current.orgId)) {
      const m = pickOrg(memberships);
      if (m) openOrg(m.orgId);
    }
  }, [auth, memberships, pathname, router]);

  // residents and parents only have their own app
  useEffect(() => {
    if (orgStatus !== "ready" || !membership) return;
    if (membership.role === "resident" && area !== "resident") router.replace("/resident/");
    if (membership.role === "parent" && area !== "parent") router.replace("/parent/");
  }, [orgStatus, membership, area, router]);

  if (auth === "unconfigured") return <Splash state="unconfigured" />;
  if (orgStatus === "error") return <Splash state="error" />;
  if (orgStatus !== "ready") return <Splash state="loading" />;
  if (membership?.role === "resident" && area !== "resident") return <Splash state="loading" />;
  if (membership?.role === "parent" && area !== "parent") return <Splash state="loading" />;
  return <>{children}</>;
}

function Splash({ state }: { state: "loading" | "error" | "unconfigured" }) {
  const t = useTranslations("account.gate");
  const name = useSession((s) => s.membership?.orgName);
  const error = useSession((s) => s.orgError);
  const orgId = useSession((s) => s.orgId);
  return (
    <div className="grid min-h-dvh place-items-center bg-canvas px-6">
      <div className="flex max-w-sm flex-col items-center text-center">
        <LogoMark size={40} className={state === "loading" ? "animate-pulse" : undefined} />
        {state === "loading" && (
          <p className="mt-4 text-sm text-fg-2" role="status">
            {name ? t("loadingHostel", { name }) : t("loading")}
          </p>
        )}
        {state === "error" && (
          <div role="alert" className="mt-5">
            <p className="flex items-center justify-center gap-1.5 text-sm font-medium text-danger-fg">
              <AlertCircle className="size-4" aria-hidden /> {t("errorTitle")}
            </p>
            <p className="mt-1 text-small text-fg-2">{error ?? t("errorBody")}</p>
            <div className="mt-4 flex justify-center gap-2">
              <Button variant="primary" onClick={() => orgId && openOrg(orgId, { force: true })}>
                <RotateCw /> {t("retry")}
              </Button>
              <Button variant="secondary" onClick={() => signOut()}>
                <LogOut /> {t("signOut")}
              </Button>
            </div>
          </div>
        )}
        {state === "unconfigured" && (
          <div role="alert" className="mt-5">
            <p className="text-sm font-medium text-fg">{t("unconfiguredTitle")}</p>
            <p className="mt-1 text-small text-fg-2">{t("unconfiguredBody")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
