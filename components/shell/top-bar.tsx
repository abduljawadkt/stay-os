"use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";
import { RoleSwitcher } from "./role-switcher";
import { RoleSelect } from "./role-select";
import { LocaleToggle } from "./locale-toggle";
import { ThemeToggle } from "./theme-toggle";
import { DemoMenu, GuidedDemoButton } from "./demo-menu";
import { WhatsAppToggle } from "./whatsapp-toggle";
import { CommandSearch } from "./command-search";
import { cn } from "@/lib/utils";

export function TopBar({ onMenu, variant = "dashboard" }: { onMenu?: () => void; variant?: "dashboard" | "app" }) {
  const t = useTranslations("shell");
  return (
    <header className={cn("sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-line bg-canvas/95 px-3 sm:gap-3 sm:px-4 lg:px-6", "supports-[backdrop-filter]:bg-canvas/90")}>
      {variant === "dashboard" && onMenu && (
        <Button variant="quiet" size="icon" className="lg:hidden" aria-label={t("openMenu")} onClick={onMenu}>
          <Menu />
        </Button>
      )}
      {variant === "app" ? (
        <Link href="/dashboard/" className="mr-2 rounded-md" aria-label={t("home")}>
          <Logo />
        </Link>
      ) : (
        <Link href="/dashboard/" className="mr-1 rounded-md lg:hidden" aria-label={t("home")}>
          <Logo />
        </Link>
      )}
      {variant === "dashboard" && <CommandSearch className="hidden md:flex" />}
      <div className="flex flex-1 justify-center">
        <RoleSwitcher className="hidden md:flex" />
        <RoleSelect className="md:hidden" />
      </div>
      <div className="flex items-center gap-1 sm:gap-1.5">
        <LocaleToggle />
        <WhatsAppToggle />
        <ThemeToggle />
        <DemoMenu />
        <GuidedDemoButton className="hidden xl:inline-flex" />
      </div>
    </header>
  );
}
