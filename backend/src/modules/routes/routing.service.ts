import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { RoutingConfig } from '../../config/configuration';
import type { GeoPoint } from '../../contract/api';

export type TravelMode = 'DRIVE' | 'WALK';

export interface RouteLeg {
  distanceKm: number;
  durationMinutes: number;
  mode: TravelMode;
}

export interface ComputedPath {
  coordinates: [number, number][];
  legs: RouteLeg[];
  provider: 'osrm' | 'straight';
}

interface OsrmResponse {
  code: string;
  routes?: {
    geometry: { coordinates: [number, number][] };
    legs: { distance: number; duration: number }[];
  }[];
}

/** A stretch of consecutive stops that share one travel mode. */
interface Run {
  mode: TravelMode;
  /** The run covers stops [from .. to] inclusive. */
  from: number;
  to: number;
}

const WALK_SPEED_KMH = 4.5;
/** Streets are not straight: pad the crow-flight walk before turning it into minutes. */
const WALK_PATH_FACTOR = 1.25;

/**
 * Travel geometry between consecutive stops.
 *
 * Stops within walking distance of each other are joined by a direct connector
 * instead of a driving query: the car profile answers "Hagia Sophia to the Blue
 * Mosque" with a 2 km loop around Sultanahmet's one-way grid, which is both wrong
 * for a guest who simply walks it and a scribble on the map. Anything further
 * apart goes to OSRM, and the assembled line is simplified before it is stored.
 */
@Injectable()
export class RoutingService {
  private readonly logger = new Logger(RoutingService.name);
  private readonly config: RoutingConfig;
  private readonly cache = new Map<string, ComputedPath>();

  constructor(configService: ConfigService) {
    this.config = configService.getOrThrow<RoutingConfig>('routing');
  }

  async compute(points: GeoPoint[]): Promise<ComputedPath> {
    if (points.length < 2) {
      return { coordinates: points.map((p) => [p.lng, p.lat]), legs: [], provider: 'straight' };
    }
    const key = points.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join(';');
    const cached = this.cache.get(key);
    if (cached) return cached;

    const result = this.config.provider === 'osrm' ? await this.viaOsrm(points) : this.straight(points);
    this.cache.set(key, result);
    return result;
  }

  private async viaOsrm(points: GeoPoint[]): Promise<ComputedPath> {
    const coordinates: [number, number][] = [];
    const legs: RouteLeg[] = [];
    let drove = false;

    for (const run of this.planRuns(points)) {
      if (run.mode === 'WALK') {
        for (let i = run.from; i < run.to; i += 1) {
          legs.push(this.walkLeg(points[i], points[i + 1]));
          append(coordinates, [
            [points[i].lng, points[i].lat],
            [points[i + 1].lng, points[i + 1].lat],
          ]);
        }
        continue;
      }
      const slice = points.slice(run.from, run.to + 1);
      const driven = await this.drive(slice).catch((error: unknown) => {
        this.logger.warn(`OSRM failed, falling back to straight lines: ${String(error)}`);
        return undefined;
      });
      if (driven) drove = true;
      const leg = driven ?? this.straight(slice);
      append(coordinates, leg.coordinates);
      legs.push(...leg.legs);
    }

    return {
      coordinates: simplify(coordinates, this.config.simplifyMeters),
      legs,
      provider: drove ? 'osrm' : 'straight',
    };
  }

  /** Group consecutive stop pairs by whether they are close enough to walk. */
  private planRuns(points: GeoPoint[]): Run[] {
    const runs: Run[] = [];
    for (let i = 1; i < points.length; i += 1) {
      const mode: TravelMode = haversineKm(points[i - 1], points[i]) <= this.config.walkMaxKm ? 'WALK' : 'DRIVE';
      const open = runs[runs.length - 1];
      if (open && open.mode === mode) open.to = i;
      else runs.push({ mode, from: i - 1, to: i });
    }
    return runs;
  }

  private walkLeg(a: GeoPoint, b: GeoPoint): RouteLeg {
    const km = haversineKm(a, b) * WALK_PATH_FACTOR;
    return {
      distanceKm: round(km, 2),
      durationMinutes: Math.max(2, Math.round((km / WALK_SPEED_KMH) * 60)),
      mode: 'WALK',
    };
  }

  private async drive(points: GeoPoint[]): Promise<ComputedPath> {
    const coords = points.map((p) => `${p.lng},${p.lat}`).join(';');
    // continue_straight=false lets the driver turn around at a stop instead of
    // circling the block to rejoin the road facing the way they arrived.
    const url = `${this.config.osrmUrl}/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false&continue_straight=false`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(url, { signal: controller.signal, headers: { accept: 'application/json' } });
      if (!response.ok) throw new Error(`OSRM responded ${response.status}`);
      const body = (await response.json()) as OsrmResponse;
      const route = body.routes?.[0];
      if (body.code !== 'Ok' || !route) throw new Error(`OSRM code ${body.code}`);
      return {
        coordinates: route.geometry.coordinates,
        legs: route.legs.map((leg) => ({
          distanceKm: round(leg.distance / 1000, 2),
          // City traffic runs slower than OSRM's free-flow estimate; pad by a third.
          durationMinutes: Math.max(3, Math.round((leg.duration / 60) * 1.35)),
          mode: 'DRIVE' as const,
        })),
        provider: 'osrm',
      };
    } finally {
      clearTimeout(timer);
    }
  }

  straight(points: GeoPoint[]): ComputedPath {
    const legs: RouteLeg[] = [];
    for (let i = 1; i < points.length; i += 1) {
      const crow = haversineKm(points[i - 1], points[i]);
      if (crow <= this.config.walkMaxKm) {
        legs.push(this.walkLeg(points[i - 1], points[i]));
        continue;
      }
      const km = crow * 1.3; // road factor
      legs.push({ distanceKm: round(km, 2), durationMinutes: Math.max(3, Math.round((km / 22) * 60)), mode: 'DRIVE' });
    }
    return { coordinates: points.map((p) => [p.lng, p.lat]), legs, provider: 'straight' };
  }
}

/** Append a segment, dropping its first point when it lands on top of the last one. */
function append(into: [number, number][], segment: [number, number][]): void {
  if (!segment.length) return;
  const last = into[into.length - 1];
  const joined = last && haversineKm({ lng: last[0], lat: last[1] }, { lng: segment[0][0], lat: segment[0][1] }) < 0.01;
  for (let i = joined ? 1 : 0; i < segment.length; i += 1) into.push(segment[i]);
}

/**
 * Douglas-Peucker in local metres. The OSRM full overview carries a vertex every
 * ~15 m, well under one pixel at the zooms these routes are drawn at, so the line
 * renders as a wobble rather than as a road.
 */
export function simplify(coords: [number, number][], toleranceMeters: number): [number, number][] {
  if (coords.length < 3 || toleranceMeters <= 0) return coords;
  const kx = 111_320 * Math.cos(toRad(coords[0][1]));
  const ky = 110_540;
  const px = coords.map(([lng, lat]) => [lng * kx, lat * ky] as [number, number]);
  const keep = new Uint8Array(coords.length);
  keep[0] = 1;
  keep[coords.length - 1] = 1;
  const stack: [number, number][] = [[0, coords.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop()!;
    const [ax, ay] = px[s];
    const dx = px[e][0] - ax;
    const dy = px[e][1] - ay;
    const den = dx * dx + dy * dy;
    let worst = -1;
    let at = -1;
    for (let i = s + 1; i < e; i += 1) {
      const [cx, cy] = px[i];
      const t = den ? clamp01(((cx - ax) * dx + (cy - ay) * dy) / den) : 0;
      const d = Math.hypot(ax + t * dx - cx, ay + t * dy - cy);
      if (d > worst) {
        worst = d;
        at = i;
      }
    }
    if (worst > toleranceMeters && at > s) {
      keep[at] = 1;
      stack.push([s, at], [at, e]);
    }
  }
  return coords.filter((_, i) => keep[i] === 1);
}

export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function round(value: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}
