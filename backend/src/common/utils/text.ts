import { randomBytes } from 'node:crypto';
import type { Locale, LocalizedText } from '../../contract/api';

const TURKISH_MAP: Record<string, string> = {
  ç: 'c',
  Ç: 'c',
  ğ: 'g',
  Ğ: 'g',
  ı: 'i',
  I: 'i',
  İ: 'i',
  ö: 'o',
  Ö: 'o',
  ş: 's',
  Ş: 's',
  ü: 'u',
  Ü: 'u',
};

/** URL slug that survives Turkish letters ("Süleymaniye Camii" → "suleymaniye-camii"). */
export function slugify(input: string): string {
  return input
    .split('')
    .map((ch) => TURKISH_MAP[ch] ?? ch)
    .join('')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** Resolve one language out of a localized field, falling back en → tr → anything. */
export function pickText(text: LocalizedText | undefined, locale: Locale): string {
  if (!text) return '';
  return text[locale] ?? text.en ?? text.tr ?? Object.values(text).find(Boolean) ?? '';
}

/** Unambiguous alphabet (no 0/O, 1/I) for codes people read aloud on the phone. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** "BIY-7K3M-2Q9X": short enough to type, random enough not to guess. */
export function ticketCode(): string {
  const bytes = randomBytes(8);
  let out = '';
  for (let i = 0; i < 8; i += 1) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
    if (i === 3) out += '-';
  }
  return `BIY-${out}`;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Keep digits and a leading plus; Turkish numbers without a country code get +90. */
export function normalizePhone(raw: string): string {
  const trimmed = raw.replace(/[^\d+]/g, '');
  if (trimmed.startsWith('+')) return trimmed;
  if (trimmed.startsWith('00')) return `+${trimmed.slice(2)}`;
  if (trimmed.startsWith('0') && trimmed.length === 11) return `+90${trimmed.slice(1)}`;
  if (trimmed.length === 10 && trimmed.startsWith('5')) return `+90${trimmed}`;
  return `+${trimmed}`;
}
