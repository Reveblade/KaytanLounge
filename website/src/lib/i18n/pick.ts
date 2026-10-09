import type { LocalizedList, LocalizedText } from "../contract/api";
import type { UiLocale } from "./dictionaries";

/**
 * Pure resolvers for localized content, deliberately kept out of the client context
 * module: server components import these directly, and a `"use client"` file cannot
 * export a plain function to the server.
 */
export function pickText(text: LocalizedText | undefined, locale: UiLocale): string {
  if (!text) return "";
  return text[locale] ?? text.en ?? text.tr ?? Object.values(text).find(Boolean) ?? "";
}

export function pickList(list: LocalizedList | undefined, locale: UiLocale): string[] {
  if (!list) return [];
  return list[locale] ?? list.en ?? list.tr ?? Object.values(list).find((v) => v?.length) ?? [];
}
