"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LogoMark } from "@/components/brand/logo";
import { boot, openOrg, pickOrg, useSession } from "@/lib/session";

/** Where a signed-in person lands: their hostel, in the app that fits their role. Also the iOS app's first screen. */
export default function StartPage() {
  const router = useRouter();
  const auth = useSession((s) => s.auth);
  const memberships = useSession((s) => s.memberships);
  useEffect(() => {
    boot();
  }, []);
  useEffect(() => {
    if (auth === "signed_out") router.replace("/");
    if (auth !== "signed_in" || !memberships) return;
    const m = pickOrg(memberships);
    if (!m) {
      router.replace("/onboarding/");
      return;
    }
    if (useSession.getState().orgId !== m.orgId) openOrg(m.orgId);
    router.replace(m.role === "resident" ? "/resident/" : m.role === "parent" ? "/parent/" : "/dashboard/");
  }, [auth, memberships, router]);
  return (
    <div className="grid min-h-dvh place-items-center bg-canvas">
      <LogoMark size={40} className="animate-pulse" />
    </div>
  );
}
