"use client";

import { useLayoutEffect, useState } from "react";
import type { GeoJsonLineString } from "@/lib/contract/api";
import { RouteMap, type MapNode } from "@/components/map/lazy-route-map";

/** Always the live orbit — this page exists to record it. */
export function BakeMap({
  path,
  nodes,
  theme,
}: {
  path?: GeoJsonLineString;
  nodes: MapNode[];
  theme: "dark" | "light";
}) {
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const html = document.documentElement;
    const prev = html.dataset.theme;
    html.dataset.theme = theme;
    setReady(true);
    return () => {
      if (prev) html.dataset.theme = prev;
      else delete html.dataset.theme;
    };
  }, [theme]);

  if (!ready) return null;

  return (
    <div className="absolute inset-0">
      <RouteMap mode="hero" orbitMs={20_000} path={path} nodes={nodes} className="h-full w-full" fitKey={nodes.map((n) => n.id).join("|")} />
    </div>
  );
}
