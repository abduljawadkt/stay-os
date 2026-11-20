"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { KeyRound, LogOut } from "lucide-react";
import { ChangePasswordDialog } from "./change-password";
import { Button } from "@/components/ui/button";
import { isStaffRole, signOut, useSession } from "@/lib/session";

/** Who is signed in, with a way out. Shown in the resident and parent apps, where there is no sidebar. */
export function AccountFooter() {
  const t = useTranslations("account.menu");
  const router = useRouter();
  const user = useSession((s) => s.user);
  const role = useSession((s) => s.membership?.role);
  const [pwOpen, setPwOpen] = useState(false);
  if (!user || isStaffRole(role)) return null;
  const sharedDemoLogin = user.email.endsWith("@demo.stayos.space");
  return (
    <div className="mx-4 mt-6 mb-2 flex items-center justify-between gap-3 border-t border-line pt-4 text-small text-fg-3">
      <span className="min-w-0 truncate">{user.email}</span>
      <ChangePasswordDialog open={pwOpen} onOpenChange={setPwOpen} />
      <span className="flex shrink-0 gap-1">
      {!sharedDemoLogin && <Button variant="quiet" size="sm" onClick={() => setPwOpen(true)}><KeyRound /> {t("changePassword")}</Button>}
      <Button
        variant="quiet"
        size="sm"
        onClick={async () => {
          await signOut();
          router.replace("/login/");
        }}
      >
        <LogOut /> {t("signOut")}
      </Button>
      </span>
    </div>
  );
}
