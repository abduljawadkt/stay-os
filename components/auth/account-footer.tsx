"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isStaffRole, signOut, useSession } from "@/lib/session";

/** Who is signed in, with a way out. Shown in the resident and parent apps, where there is no sidebar. */
export function AccountFooter() {
  const t = useTranslations("account.menu");
  const router = useRouter();
  const user = useSession((s) => s.user);
  const role = useSession((s) => s.membership?.role);
  if (!user || isStaffRole(role)) return null;
  return (
    <div className="mx-4 mt-6 mb-2 flex items-center justify-between gap-3 border-t border-line pt-4 text-small text-fg-3">
      <span className="min-w-0 truncate">{user.email}</span>
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
    </div>
  );
}
