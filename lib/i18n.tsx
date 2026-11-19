"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";
import en from "@/messages/en";
import ml from "@/messages/ml";
import type { Locale } from "./format";

type Messages = Record<string, unknown>;
function merge(base: Messages, over: Messages): Messages {
  const out: Messages = { ...base };
  for (const [k, v] of Object.entries(over)) {
    out[k] = v && typeof v === "object" && !Array.isArray(v) && typeof base[k] === "object" ? merge(base[k] as Messages, v as Messages) : v;
  }
  return out;
}
// Malayalam falls back to English key by key, so a missing translation never shows a raw key.
const CATALOG: Record<Locale, AbstractIntlMessages> = { en: en as unknown as AbstractIntlMessages, ml: merge(en as Messages, ml as Messages) as unknown as AbstractIntlMessages };
const KEY = "stayos-locale";

const LocaleContext = createContext<{ locale: Locale; setLocale: (l: Locale) => void }>({ locale: "en", setLocale: () => {} });
export const useLocale = () => useContext(LocaleContext);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === "ml" || saved === "en") setLocaleState(saved);
    } catch {}
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem(KEY, l);
    } catch {}
  }, []);
  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);
  return (
    <LocaleContext.Provider value={value}>
      <NextIntlClientProvider
        locale={locale}
        messages={CATALOG[locale]}
        timeZone="Asia/Kolkata"
        onError={(e) => {
          if (process.env.NODE_ENV !== "production") console.error("[i18n]", e.message);
        }}
      >
        {children}
      </NextIntlClientProvider>
    </LocaleContext.Provider>
  );
}
