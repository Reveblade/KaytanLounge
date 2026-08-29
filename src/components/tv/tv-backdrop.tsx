"use client";

import { Component, useSyncExternalStore, type ReactNode } from "react";
import type { GeoJsonLineString } from "@/lib/contract/api";
import { isLoungeDisplay } from "@/lib/lounge";
import { HeroMap } from "@/components/landing/hero-map";
import type { MapNode } from "@/components/map/lazy-route-map";

function subscribe() {
  return () => undefined;
}

/**
 * Same city as the homepage: OpenFreeMap, pitched, the route drawn on it.
 * A lounge set cannot start WebGL, so it keeps the still we baked from that
 * map. A desktop opening /tv gets the live one.
 */
export function TvBackdrop({ path, nodes }: { path?: GeoJsonLineString; nodes: MapNode[] }) {
  const live = useSyncExternalStore(subscribe, () => !isLoungeDisplay(), () => false);
  return (
    <div className="absolute inset-0 z-0 overflow-hidden" aria-hidden>
      <div className="tv-ambient absolute inset-0" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="tv-city" src="/tv/city.jpg" alt="" decoding="async" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_70%_40%,transparent_40%,var(--bg)_100%)] opacity-70" />
      {live ? (
        <MapSafe>
          <HeroMap path={path} nodes={nodes} />
        </MapSafe>
      ) : null}
    </div>
  );
}

class MapSafe extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
