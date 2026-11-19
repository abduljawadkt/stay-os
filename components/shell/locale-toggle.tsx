"use client";

import { useTranslations } from "next-intl";
import { useLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function LocaleToggle({ className }: { className?: string }) {
  const { locale, setLocale } = useLocale();
  const t = useTranslations("shell");
  return (
    <div role="radiogroup" aria-label={t("language")} data-tour="locale" className={cn("flex rounded-md bg-surface-2 p-0.5", className)}>
      {(["en", "ml"] as const).map((l) => (
        <button
          key={l}
          role="radio"
          aria-checked={locale === l}
          lang={l}
          onClick={() => setLocale(l)}
          className={cn(
            "h-7 min-w-7 rounded-sm px-1.5 text-small font-medium transition-colors duration-[120ms] sm:min-w-8 sm:px-2",
            locale === l ? "bg-surface text-fg shadow-sm dark:bg-surface-3" : "text-fg-2 hover:text-fg"
          )}
        >
          <span aria-hidden>{l === "en" ? "EN" : "മ"}</span>
          <span className="sr-only">{l === "en" ? "English" : "മലയാളം"}</span>
        </button>
      ))}
    </div>
  );
}
