import { cookies, headers } from "next/headers";
import { DEFAULT_LOCALE, DICTIONARIES, isUiLocale, type UiLocale } from "./dictionaries";

export const LOCALE_COOKIE = "biy_locale";
export const THEME_COOKIE = "biy_theme";

/** Cookie first, then Accept-Language, then English. */
export async function getLocale(): Promise<UiLocale> {
  const jar = await cookies();
  const fromCookie = jar.get(LOCALE_COOKIE)?.value;
  if (isUiLocale(fromCookie)) return fromCookie;
  const accept = (await headers()).get("accept-language") ?? "";
  if (/^tr\b|,tr\b/i.test(accept)) return "tr";
  return DEFAULT_LOCALE;
}

export async function getTheme(): Promise<"dark" | "light"> {
  const jar = await cookies();
  return jar.get(THEME_COOKIE)?.value === "light" ? "light" : "dark";
}

export async function getDictionary() {
  const locale = await getLocale();
  return { locale, t: DICTIONARIES[locale] };
}
