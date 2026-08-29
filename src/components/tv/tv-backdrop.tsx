"use client";

import { Component, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import type { GeoJsonLineString } from "@/lib/contract/api";
import { canPaintWebGL, isLoungeDisplay } from "@/lib/lounge";
import { HeroMap } from "@/components/landing/hero-map";
import type { MapNode } from "@/components/map/lazy-route-map";

function subscribe() {
  return () => undefined;
}

/**
 * Same city as the homepage: OpenFreeMap, pitched, the route drawn on it.
 * A lounge set gets that 3D too, at a 1080p budget so the 4K framebuffer
 * never starts. The baked still stays under the canvas until the first idle
 * frame — and comes back if the context is lost.
 */
export function TvBackdrop({ path, nodes }: { path?: GeoJsonLineString; nodes: MapNode[] }) {
  const lounge = useSyncExternalStore(subscribe, isLoungeDisplay, () => false);
  const capable = useSyncExternalStore(subscribe, canPaintWebGL, () => false);
  const [painted, setPainted] = useState(false);

  useEffect(() => {
    if (!capable) return;
    const onIdle = () => setPainted(true);
    const onLost = () => setPainted(false);
    window.addEventListener("biy-map-idle", onIdle);
    window.addEventListener("webglcontextlost", onLost, true);
    return () => {
      window.removeEventListener("biy-map-idle", onIdle);
      window.removeEventListener("webglcontextlost", onLost, true);
    };
  }, [capable]);

  return (
    <div className="absolute inset-0 z-0 overflow-hidden" aria-hidden>
      <div className="tv-ambient absolute inset-0" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="tv-city" src="/tv/city.jpg" alt="" decoding="async" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_70%_40%,transparent_40%,var(--bg)_100%)] opacity-70" />
      {capable ? (
        <MapSafe>
          <div className="tv-map-live" data-painted={painted ? "true" : "false"}>
            <HeroMap path={path} nodes={nodes} budget={lounge} />
          </div>
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
