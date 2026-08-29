import type { GeoJsonLineString } from "@/lib/contract/api";
import { TvRasterMap } from "./tv-raster-map";

interface Node {
  id: string;
  location: { lat: number; lng: number };
}

/**
 * The city behind the reel. Images and an SVG, no WebGL — MapLibre never
 * starts on a lounge television, so a live canvas would stay black.
 */
export function TvBackdrop({ path, nodes }: { path?: GeoJsonLineString; nodes: Node[] }) {
  return (
    <div className="absolute inset-0 z-0 overflow-hidden" aria-hidden>
      <div className="tv-ambient absolute inset-0" />
      <TvRasterMap path={path} nodes={nodes} />
    </div>
  );
}
