"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { Avatar } from "@/components/common/avatar";
import { LocaleToggle } from "@/components/shell/locale-toggle";
import { useDemo, type Role } from "@/lib/store";
import { brand } from "@/config/brand";
import { demo } from "@/config/demo";
import { hostel, staff } from "@/data";

/** First screen of the iOS app: pick whose view to demo. */
export default function StartPage() {
  const t = useTranslations("start");
  const tr = useTranslations("roles");
  const setRole = useDemo((s) => s.setRole);
  const residents = useDemo((s) => s.residents);
  const r = residents.find((x) => x.id === demo.residentId);
  const options: { role: Role; href: string; name: string; meta: string }[] = [
    { role: "resident", href: "/resident/", name: r?.name ?? "", meta: t("residentMeta") },
    { role: "parent", href: "/parent/", name: r?.parent.name ?? "", meta: t("parentMeta") },
    { role: "owner", href: "/dashboard/", name: hostel.owner.name, meta: t("ownerMeta") },
    { role: "warden", href: "/dashboard/", name: staff[0].name, meta: t("wardenMeta") },
  ];
  return (
    <main className="min-h-dvh bg-canvas px-5 pt-[calc(env(safe-area-inset-top)+28px)] pb-[calc(env(safe-area-inset-bottom)+24px)]">
      <div className="mx-auto max-w-md">
        <div className="flex items-center justify-between">
          <LogoMark size={36} />
          <LocaleToggle />
        </div>
        <h1 className="mt-8 text-[30px] leading-9 font-semibold tracking-[-0.02em] text-fg">{t("title", { brand: brand.name })}</h1>
        <p className="mt-2 text-base text-fg-2">{t("body", { hostel: hostel.name })}</p>
        <ul className="mt-8 space-y-3">
          {options.map((o) => (
            <li key={o.role}>
              <Link href={o.href} onClick={() => setRole(o.role)} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-4 active:bg-surface-2">
                <Avatar name={o.name} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-brand-text">{tr(o.role)}</p>
                  <p className="truncate text-base font-semibold text-fg">{o.name}</p>
                  <p className="truncate text-small text-fg-3">{o.meta}</p>
                </div>
                <ArrowRight className="size-5 text-fg-3" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-8 text-center text-xs text-fg-3">{t("note")}</p>
      </div>
    </main>
  );
}
