import type { LngLatBoundsLike } from "maplibre-gl";

/**
 * The İstanbul province, padded a little at the edges. Every map in the product
 * is locked to this box: the tours never leave the city, so neither should the
 * camera. Panning stops at the frame and zooming out stops at `MIN_ZOOM`, which
 * is the level where the whole box fills a desktop viewport.
 */
export const ISTANBUL_BOUNDS: [[number, number], [number, number]] = [
  [27.9, 40.75],
  [29.95, 41.65],
];

export const ISTANBUL_CENTER: [number, number] = [28.98, 41.03];
export const MIN_ZOOM = 9.3;
export const MAX_ZOOM = 18;

export const ISTANBUL_MAX_BOUNDS = ISTANBUL_BOUNDS as LngLatBoundsLike;

/**
 * Whether two coordinates describe the same spot on the ground, within about 50 metres.
 * A meeting point and the stop it stands at are stored separately and arrive as separate
 * numbers; comparing floats for equality would make the match depend on rounding.
 */
export function nearlySamePoint(a: { lat: number; lng: number }, b: { lat: number; lng: number }): boolean {
  const dLat = a.lat - b.lat;
  // Longitude degrees shrink towards the poles; at İstanbul's latitude one is about 0.75 of a latitude degree.
  const dLng = (a.lng - b.lng) * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(dLat, dLng) < 0.00045;
}

export function clampToIstanbul([lng, lat]: [number, number]): [number, number] {
  const [[west, south], [east, north]] = ISTANBUL_BOUNDS;
  return [clamp(lng, west, east), clamp(lat, south, north)];
}

export function isInIstanbul([lng, lat]: [number, number]): boolean {
  const [[west, south], [east, north]] = ISTANBUL_BOUNDS;
  return lng >= west && lng <= east && lat >= south && lat <= north;
}

/** Keep a fit target inside the frame so `fitBounds` never fights `maxBounds`. */
export function clampBounds(bounds: [[number, number], [number, number]]): [[number, number], [number, number]] {
  return [clampToIstanbul(bounds[0]), clampToIstanbul(bounds[1])];
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}
