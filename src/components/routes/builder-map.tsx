"use client";

import maplibregl from "maplibre-gl";
import { useEffect, useRef } from "react";
import type { GeoJsonLineString, GeoPoint } from "@/lib/contract/api";
import { ISTANBUL_MAX_BOUNDS, ISTANBUL_CENTER, MAX_ZOOM, MIN_ZOOM } from "@/lib/geo";

export interface BuilderStop {
  key: string;
  label: string;
  location: GeoPoint;
  kind: "ATTRACTION" | "BUSINESS";
}

const STYLE_LIGHT = process.env.NEXT_PUBLIC_MAP_STYLE_LIGHT ?? "https://tiles.openfreemap.org/styles/positron";
const STYLE_DARK = process.env.NEXT_PUBLIC_MAP_STYLE_DARK ?? "https://tiles.openfreemap.org/styles/dark";

/**
 * The itinerary as it will be walked: numbered stops in order, joined by the path the
 * routing service returned. Markers are rebuilt on every change because a route is a
 * handful of stops, not a dataset — clarity beats diffing here.
 */
export function BuilderMap({ stops, path, active, onSelect, height = 560 }: { stops: BuilderStop[]; path?: GeoJsonLineString; active?: string; onSelect?: (key: string) => void; height?: number }) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const ready = useRef(false);
  // The map is built once; this keeps the newest handler reachable from inside it
  // without tearing the map down every time the parent re-renders.
  const select = useRef(onSelect);
  useEffect(() => {
    select.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!container.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: container.current,
      style: document.documentElement.dataset.theme === "dark" ? STYLE_DARK : STYLE_LIGHT,
      center: ISTANBUL_CENTER,
      zoom: 10.5,
      maxBounds: ISTANBUL_MAX_BOUNDS,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    map.on("load", () => {
      map.addSource("route", { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [] } } });
      map.addLayer({ id: "route-line", type: "line", source: "route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#e0663f", "line-width": 4, "line-opacity": 0.85 } });
      ready.current = true;
      map.resize();
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      ready.current = false;
    };
  }, []);

  // Keep the drawn line in step with the stops.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const source = map.getSource("route") as maplibregl.GeoJSONSource | undefined;
      if (!source) return;
      const coordinates = path?.coordinates?.length ? path.coordinates : stops.map((s) => [s.location.lng, s.location.lat] as [number, number]);
      source.setData({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates } });
    };
    if (ready.current) apply();
    else map.once("load", apply);
  }, [path, stops]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const marker of markers.current) marker.remove();
    markers.current = stops.map((stop, i) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "route-pin";
      el.dataset.active = String(stop.key === active);
      el.dataset.kind = stop.kind;
      el.textContent = String(i + 1);
      el.title = stop.label;
      el.addEventListener("click", () => select.current?.(stop.key));
      return new maplibregl.Marker({ element: el }).setLngLat([stop.location.lng, stop.location.lat]).addTo(map);
    });
    if (stops.length) {
      const bounds = new maplibregl.LngLatBounds();
      for (const stop of stops) bounds.extend([stop.location.lng, stop.location.lat]);
      map.fitBounds(bounds, { padding: 70, maxZoom: 14, duration: 500 });
    }
  }, [stops, active]);

  return <div ref={container} className="overflow-hidden rounded-panel border border-line" style={{ height }} />;
}
