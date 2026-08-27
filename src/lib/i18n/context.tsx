"use client";

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import type { LocalizedList, LocalizedText } from "../contract/api";
import { DICTIONARIES, type Dictionary, type UiLocale } from "./dictionaries";
import { pickList, pickText } from "./pick";

interface I18nValue {
  locale: UiLocale;
  t: Dictionary;
  /** Resolve a localized content field with sensible fallbacks. */
  pick: (text: LocalizedText | undefined) => string;
  pickList: (list: LocalizedList | undefined) => string[];
  setLocale: (locale: UiLocale) => void;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ locale, children }: { locale: UiLocale; children: ReactNode }) {
  const setLocale = useCallback((next: UiLocale) => {
    document.cookie = `biy_locale=${next}; path=/; max-age=31536000; samesite=lax`;
    window.location.reload();
  }, []);

  const value = useMemo<I18nValue>(
    () => ({
      locale,
      t: DICTIONARIES[locale],
      pick: (text) => pickText(text, locale),
      pickList: (list) => pickList(list, locale),
      setLocale,
    }),
    [locale, setLocale],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside I18nProvider");
  return value;
}
