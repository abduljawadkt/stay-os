"use client";

import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card } from "./card";
import { EmptyState } from "./states";
import { Button } from "@/components/ui/button";
import { useDemo } from "@/lib/store";
import { useSession } from "@/lib/session";

/**
 * The hostel's money (expenses, salaries, profit, settings) is for the owner, looking at the owner's view.
 * Checks who is signed in as well as the view on screen, so a warden can never switch into it.
 */
export function useOwnerView() {
  const view = useDemo((s) => s.role);
  const member = useSession((s) => s.membership?.role);
  return view === "owner" && member === "owner";
}

/** Shown on money pages to anyone else. Only an owner previewing the warden's view gets the way back. */
export function OwnerOnly() {
  const t = useTranslations("ownerOnly");
  const setRole = useDemo((s) => s.setRole);
  const isOwner = useSession((s) => s.membership?.role === "owner");
  return (
    <Card className="mt-6">
      <h1 className="sr-only">{t("title")}</h1>
      <EmptyState icon={Lock} title={t("title")} body={t("body")} action={isOwner ? <Button variant="secondary" onClick={() => setRole("owner")}>{t("switch")}</Button> : undefined} />
    </Card>
  );
}
