import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AttractionType, BusinessCategory, LocalizedList, LocalizedText, SponsorTier } from '../contract/api';

/** Shape of seed-content/attractions.json (written by the content research pass). */
export interface SeedAttraction {
  slug: string;
  type: AttractionType;
  name: LocalizedText;
  summary: LocalizedText;
  description: LocalizedText;
  tips?: LocalizedText;
  district: string;
  address?: string;
  location: { lat: number; lng: number };
  openingHours?: string;
  ticket?: LocalizedText;
  visitMinutes: number;
  tags?: string[];
  media: SeedMedia[];
}

export interface SeedMedia {
  url: string;
  alt?: LocalizedText;
  credit?: string;
  license?: string;
  source?: string;
}

export interface SeedBusiness {
  slug: string;
  category: BusinessCategory;
  sponsorTier: SponsorTier;
  name: LocalizedText;
  summary: LocalizedText;
  description: LocalizedText;
  district: string;
  address?: string;
  location: { lat: number; lng: number };
  contact?: { phone?: string; whatsapp?: string; instagram?: string; website?: string; email?: string };
  openingHours?: string;
  cuisine?: string[];
  features?: LocalizedList;
  visitMinutes?: number;
  media: SeedMedia[];
  researchNotes?: string;
}

export type SeedVehicleImages = Record<string, SeedMedia[]>;

function contentDir(): string {
  const candidates = [resolve(process.cwd(), 'seed-content'), resolve(__dirname, '../../seed-content')];
  return candidates.find((c) => existsSync(c)) ?? candidates[0];
}

function readJson<T>(name: string, fallback: T): T {
  return readJsonAt(resolve(contentDir(), name), fallback);
}

function readJsonAt<T>(path: string, fallback: T): T {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

export function loadAttractions(): SeedAttraction[] {
  return readJson<SeedAttraction[]>('attractions.json', []);
}

export function loadBusinesses(): SeedBusiness[] {
  return readJson<SeedBusiness[]>('businesses.json', []);
}

/** A photograph supplied as a file, with the credit line that must travel with it. */
export interface SeedLocalPhoto extends SeedMedia {
  /** Absolute path on disk; `url` is left empty because there is nothing to fetch. */
  path: string;
}

const PHOTO_EXTENSIONS = /\.(jpe?g|png|webp|avif)$/i;

/**
 * The venues' own photography, dropped into `seed-content/venues/<slug>/` as files.
 * Files are taken in filename order, so `01-terrace.jpg` leads. An optional
 * `photos.json` in the same folder carries the credit and alt text per filename:
 *
 *   { "01-terrace.jpg": { "credit": "Kaytan Lounge", "alt": { "en": "...", "tr": "..." } } }
 *
 * Anything supplied this way replaces the stand-in photography in businesses.json.
 */
export function loadVenuePhotos(slug: string): SeedLocalPhoto[] {
  const dir = resolve(contentDir(), 'venues', slug);
  if (!existsSync(dir)) return [];
  const meta = readJsonAt<Record<string, Partial<SeedMedia>>>(resolve(dir, 'photos.json'), {});
  return readdirSync(dir)
    .filter((name) => PHOTO_EXTENSIONS.test(name))
    .sort((a, b) => a.localeCompare(b, 'en'))
    .map((name) => ({ url: '', path: resolve(dir, name), ...meta[name] }));
}

export function loadVehicleImages(): SeedVehicleImages {
  return readJson<SeedVehicleImages>('vehicles.json', {});
}

/**
 * Wikimedia no longer renders arbitrary thumbnail widths: anything outside a fixed set
 * of buckets answers 400. These are the widths that verify today, smallest first.
 */
const WIKIMEDIA_BUCKETS = [960, 1280, 1920] as const;

function nearestBucket(width: number): number {
  return WIKIMEDIA_BUCKETS.find((b) => b >= width) ?? WIKIMEDIA_BUCKETS[WIKIMEDIA_BUCKETS.length - 1];
}

/**
 * A smaller rendition of a Wikimedia photo, snapped to a width their thumbnailer
 * actually serves. Only used as a fallback: `SEED_MEDIA=import` re-hosts every photo,
 * which is what production should run, because hotlinking Wikimedia is rate limited
 * and blocked by the browser's opaque-response rules.
 */
export function wikimediaThumb(url: string, width = 960): string | undefined {
  const bucket = nearestBucket(width);
  const original = /^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/([0-9a-f])\/([0-9a-f]{2})\/([^/?#]+)$/i.exec(url);
  if (original) {
    const [, a, ab, file] = original;
    return `https://upload.wikimedia.org/wikipedia/commons/thumb/${a}/${ab}/${file}/${bucket}px-${file}${/\.svg$/i.test(file) ? '.png' : ''}`;
  }
  const thumb = /^(https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/thumb\/[0-9a-f]\/[0-9a-f]{2}\/[^/]+)\/(\d+)px-([^/?#]+)$/i.exec(url);
  if (thumb) {
    const current = Number(thumb[2]);
    // Never upscale past what the seed file already chose.
    return current <= bucket ? url : `${thumb[1]}/${bucket}px-${thumb[3]}`;
  }
  return undefined;
}
