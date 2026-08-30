"use client";

import type { GeoJsonLineString } from "@/lib/contract/api";
import { RouteMap, type MapNode } from "@/components/map/lazy-route-map";

/**
 * Live WebGL hero camera. Televisions never mount this — the homepage
 * swaps in `CityLoop` before this file is reached.
 */
export function HeroMap({
  path,
  nodes,
  lite,
  budget,
  veil = true,
}: {
  path?: GeoJsonLineString;
  nodes: MapNode[];
  lite?: boolean;
  budget?: boolean;
  veil?: boolean;
}) {
  const fade = veil ? (
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_70%_40%,transparent_40%,var(--bg)_100%)] opacity-70" aria-hidden />
  ) : null;

  return (
    <div className="absolute inset-0 overflow-hidden" data-city="map">
      <div className={budget ? "tv-map-budget" : "h-full w-full"}>
        <RouteMap mode="hero" lite={lite} budget={budget} path={path} nodes={nodes} className="h-full w-full" fitKey={nodes.map((n) => n.id).join("|")} />
      </div>
      {fade}
    </div>
  );
}
