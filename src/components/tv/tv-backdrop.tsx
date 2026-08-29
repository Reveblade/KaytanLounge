"use client";

import { Component, useEffect, useState, useSyncExternalStore, type ComponentType, type ReactNode } from "react";
import type { GeoJsonLineString } from "@/lib/contract/api";
import { canUseWebGL, isLoungeDisplay } from "@/lib/lounge";
import type { MapNode } from "@/components/map/lazy-route-map";

function subscribe() {
  return () => undefined;
}

function liveMapAllowed() {
  return !isLoungeDisplay() && canUseWebGL();
}

type HeroMapProps = { path?: GeoJsonLineString; nodes: MapNode[] };

/**
 * The living map is a backdrop, not the show. On a lounge television it is
 * never imported: WebGL there either never comes up or kills the tab, and
 * pulling MapLibre in would do that before the reel has a chance to start.
 */
export function TvBackdrop({ path, nodes }: HeroMapProps) {
  const mapOn = useSyncExternalStore(subscribe, liveMapAllowed, () => false);
  const [HeroMap, setHeroMap] = useState<ComponentType<HeroMapProps> | null>(null);

  useEffect(() => {
    if (!mapOn) return;
    let cancelled = false;
    void import("@/components/landing/hero-map").then((mod) => {
      if (!cancelled) setHeroMap(() => mod.HeroMap);
    });
    return () => {
      cancelled = true;
    };
  }, [mapOn]);

  return (
    <div className="absolute inset-0 z-0 overflow-hidden isolate" aria-hidden>
      <div className="tv-ambient absolute inset-0" />
      {HeroMap ? (
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
