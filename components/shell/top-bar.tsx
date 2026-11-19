"use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Logo, LogoMark } from "@/components/brand/logo";
import { RoleSwitcher } from "./role-switcher";
import { RoleSelect } from "./role-select";
import { LocaleToggle } from "./locale-toggle";
import { ThemeToggle } from "./theme-toggle";
import { DemoMenu, GuidedDemoButton } from "./demo-menu";
import { WhatsAppToggle } from "./whatsapp-toggle";
import { CommandSearch } from "./command-search";
import { cn } from "@/lib/utils";

/**
 * Phone: menu, mark, role picker, language, WhatsApp, demo menu (theme and tour live inside it).
 * Tablet: adds the wordmark, theme toggle and an icon-only tour button.
 * Desktop (sidebar visible): search, the segmented role switcher and the labelled tour button.
 */
export function TopBar({ onMenu, variant = "dashboard" }: { onMenu?: () => void; variant?: "dashboard" | "app" }) {
  const t = useTranslations("shell");
  const dash = variant === "dashboard";
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-1.5 border-b border-line bg-canvas/95 px-3 sm:gap-2 sm:px-4 lg:gap-3 lg:px-6">
      {dash && onMenu && (
        <Button variant="quiet" size="icon" className="lg:hidden" aria-label={t("openMenu")} onClick={onMenu}>
          <Menu />
        </Button>
      )}
      <Link href="/dashboard/" className={cn("shrink-0 rounded-md", dash && "lg:hidden")} aria-label={t("home")}>
        <LogoMark className="sm:hidden" size={26} />
        <Logo className="hidden sm:inline-flex" />
      </Link>
      {dash && <CommandSearch className="hidden xl:flex" />}
      {dash && <CommandSearch compact className="hidden lg:flex xl:hidden" />}
      <div className="flex min-w-0 flex-1 justify-center">
        <RoleSwitcher className="hidden lg:flex" />
        <RoleSelect className="lg:hidden" />
      </div>
      <div className="flex shrink-0 items-center gap-0.5 sm:gap-1.5">
        <LocaleToggle />
        <WhatsAppToggle />
        <span className="hidden sm:inline-flex"><ThemeToggle /></span>
        <DemoMenu />
        <GuidedDemoButton className="hidden lg:inline-flex" />
        <GuidedDemoButton iconOnly className="hidden sm:inline-flex lg:hidden" />
      </div>
    </header>
  );
}
