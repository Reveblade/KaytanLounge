import type { CurrencyCode, TourPricing } from "./contract/api";
import type { UiLocale } from "./i18n/dictionaries";

/**
 * The headline "from" price of a departure: the adult fare, never the minimum across
 * every tier. Infants ride free, so a naive minimum advertises the whole day at zero.
 * Falls back to the cheapest fare anyone actually pays if a plan has no adult tier.
 */
export function fareFrom(pricing: TourPricing): number | null {
  const adult = pricing.tiers.find((tier) => tier.key === "ADULT")?.amount;
  if (typeof adult === "number" && adult > 0) return adult;
  const paid = pricing.tiers.map((tier) => tier.amount).filter((amount) => amount > 0);
  return paid.length ? Math.min(...paid) : null;
}

const TZ = "Europe/Istanbul";

export function formatMoney(amountMinor: number, currency: CurrencyCode, locale: UiLocale): string {
  return new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-GB", {
    style: "currency",
    currency,
    minimumFractionDigits: amountMinor % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}

export function formatDate(iso: string, locale: UiLocale, opts?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-GB", {
    timeZone: TZ,
    day: "numeric",
    month: "long",
    ...opts,
  }).format(new Date(iso));
}

export function formatWeekday(iso: string, locale: UiLocale): string {
  return new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-GB", { timeZone: TZ, weekday: "long" }).format(new Date(iso));
}

export function formatTime(iso: string, locale: UiLocale): string {
  return new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

export function formatDateTime(iso: string, locale: UiLocale): string {
  return `${formatDate(iso, locale, { weekday: "short" })}, ${formatTime(iso, locale)}`;
}

export function formatDuration(minutes: number, locale: UiLocale): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hu = locale === "tr" ? "sa" : "h";
  const mu = locale === "tr" ? "dk" : "min";
  if (h === 0) return `${m} ${mu}`;
  if (m === 0) return `${h} ${hu}`;
  return `${h} ${hu} ${m} ${mu}`;
}

/** "09:00" style clock for an offset in minutes from a departure. */
export function clockAt(startIso: string, offsetMinutes: number, locale: UiLocale): string {
  return formatTime(new Date(new Date(startIso).getTime() + offsetMinutes * 60_000).toISOString(), locale);
}

export function languageName(code: string, locale: UiLocale): string {
  try {
    return new Intl.DisplayNames([locale === "tr" ? "tr" : "en"], { type: "language" }).of(code) ?? code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}

export function kmLabel(km: number): string {
  return `${km % 1 === 0 ? km : km.toFixed(1)} km`;
}
