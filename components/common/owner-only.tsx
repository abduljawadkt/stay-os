"use client";

import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card } from "./card";
import { EmptyState } from "./states";
import { Button } from "@/components/ui/button";
import { useDemo } from "@/lib/store";

/** Wardens don't see the hostel's money pages. */
export function OwnerOnly() {
  const t = useTranslations("ownerOnly");
  const setRole = useDemo((s) => s.setRole);
  return (
    <Card className="mt-6">
      <EmptyState icon={Lock} title={t("title")} body={t("body")} action={<Button variant="secondary" onClick={() => setRole("owner")}>{t("switch")}</Button>} />
    </Card>
  );
}
