"use client";

import { useTranslations } from "next-intl";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDemo, type Role } from "@/lib/store";
import { ROLES, useRoleNavigation } from "./role-switcher";

export function RoleSelect({ className }: { className?: string }) {
  const t = useTranslations("roles");
  const role = useDemo((s) => s.role);
  const go = useRoleNavigation();
  return (
    <Select value={role} onValueChange={(v) => go(v as Role)}>
      <SelectTrigger size="sm" className={className} aria-label={t("label")}>
        <SelectValue>{t(role)}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {ROLES.map((r) => (
          <SelectItem key={r} value={r}>{t(r)}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
