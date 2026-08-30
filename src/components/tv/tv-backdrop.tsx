"use client";

import { Component, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import type { GeoJsonLineString } from "@/lib/contract/api";
import { canPaintWebGL, isLoungeDisplay, shouldLoopCity } from "@/lib/lounge";
import { CityLoop } from "@/components/map/city-loop";
import { HeroMap } from "@/components/landing/hero-map";
import type { MapNode } from "@/components/map/lazy-route-map";

function subscribe() {
  return () => undefined;
}

/**
 * Same city as the homepage. A real television plays the baked orbit.
 * A phone or a laptop keeps the live map. The TV gate covers this until
 * a frame has painted — no still, no black cut.
 */
export function TvBackdrop({
  path,
  nodes,
  loop,
}: {
  path?: GeoJsonLineString;
  nodes: MapNode[];
  loop?: boolean;
}) {
  const lounge = useSyncExternalStore(subscribe, isLoungeDisplay, () => !!loop);
  const capable = useSyncExternalStore(subscribe, canPaintWebGL, () => false);
  const video = shouldLoopCity(!!loop, lounge);
  const [painted, setPainted] = useState(false);

  useEffect(() => {
    if (video || !capable) return;
    const onIdle = () => setPainted(true);
    const onLost = () => setPainted(false);
    window.addEventListener("biy-map-idle", onIdle);
    window.addEventListener("webglcontextlost", onLost, true);
    return () => {
      window.removeEventListener("biy-map-idle", onIdle);
      window.removeEventListener("webglcontextlost", onLost, true);
    };
  }, [video, capable]);

  return (
    <div className="absolute inset-0 z-0 overflow-hidden" aria-hidden>
      <div className="tv-ambient absolute inset-0" />
      {video ? (
        <CityLoop />
      ) : capable ? (
        <MapSafe>
          <div className="tv-map-live" data-painted={painted ? "true" : "false"}>
            <HeroMap path={path} nodes={nodes} budget={lounge} veil={false} />
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
