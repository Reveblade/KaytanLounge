"use client";

import type { GeoJsonLineString } from "@/lib/contract/api";
import { RouteMap, type MapNode } from "@/components/map/lazy-route-map";

/** Client boundary for the hero: MapLibre needs the DOM, the hero itself stays a server component. */
export function HeroMap({
  path,
  nodes,
  lite,
  budget,
}: {
  path?: GeoJsonLineString;
  nodes: MapNode[];
  lite?: boolean;
  /** Pitched city, 1× framebuffer, canvas capped at 1080p and scaled up. Lounge TVs. */
  budget?: boolean;
}) {
  return (
    <div className="absolute inset-0 isolate overflow-hidden">
      <div className={budget ? "tv-map-budget" : "h-full w-full"}>
        <RouteMap mode="hero" lite={lite} budget={budget} path={path} nodes={nodes} className="h-full w-full" fitKey={nodes.map((n) => n.id).join("|")} />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_70%_40%,transparent_40%,var(--bg)_100%)] opacity-70" aria-hidden />
    </div>
  );
}
