"use client";

import { Component, type ReactNode } from "react";
import type { GeoJsonLineString } from "@/lib/contract/api";
import { HeroMap } from "@/components/landing/hero-map";
import type { MapNode } from "@/components/map/lazy-route-map";

/**
 * The living map stays behind the reel. This page is the lounge wall, so the
 * camera stays flat and the framebuffer stays 1× — a pitched 4K WebGL city
 * is what goes black on the set. The ambient wash is only there until tiles
 * arrive.
 */
export function TvBackdrop({ path, nodes }: { path?: GeoJsonLineString; nodes: MapNode[] }) {
  return (
    <div className="absolute inset-0 z-0 overflow-hidden isolate" aria-hidden>
      <div className="tv-ambient absolute inset-0" />
      <MapSafe>
        <HeroMap path={path} nodes={nodes} lite />
      </MapSafe>
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
