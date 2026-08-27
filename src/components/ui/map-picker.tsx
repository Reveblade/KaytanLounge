"use client";

import maplibregl from "maplibre-gl";
import { useEffect, useRef } from "react";
import type { GeoPoint } from "@/lib/contract/api";
import { ISTANBUL_CENTER, ISTANBUL_MAX_BOUNDS, MAX_ZOOM, MIN_ZOOM, clampToIstanbul, isInIstanbul } from "@/lib/geo";

const STYLE_LIGHT = process.env.NEXT_PUBLIC_MAP_STYLE_LIGHT ?? "https://tiles.openfreemap.org/styles/positron";
const STYLE_DARK = process.env.NEXT_PUBLIC_MAP_STYLE_DARK ?? "https://tiles.openfreemap.org/styles/dark";

function styleUrl() {
  return document.documentElement.dataset.theme === "dark" ? STYLE_DARK : STYLE_LIGHT;
}

/** Click to place, drag to adjust. Lat/lng inputs sit beside it for precision. */
export function MapPicker({ value, onChange, height = 320 }: { value: GeoPoint | undefined; onChange: (next: GeoPoint) => void; height?: number }) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  // The map is built once; this keeps the newest handler reachable from inside it
  // without tearing the map down every time the parent re-renders.
  const latest = useRef(onChange);
  useEffect(() => {
    latest.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!container.current || mapRef.current) return;
    const center: [number, number] = value ? clampToIstanbul([value.lng, value.lat]) : ISTANBUL_CENTER;
    const map = new maplibregl.Map({
      container: container.current,
      style: styleUrl(),
      center,
      zoom: value ? 14 : 11,
      // Places belong to İstanbul, so the picker cannot wander out of it.
      maxBounds: ISTANBUL_MAX_BOUNDS,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    mapRef.current = map;
    const marker = new maplibregl.Marker({ draggable: true, color: "#e0663f" });
    if (value) marker.setLngLat(center).addTo(map);
    markerRef.current = marker;
    marker.on("dragend", () => {
      const { lat, lng } = marker.getLngLat();
      latest.current({ lat: round(lat), lng: round(lng) });
    });
    map.on("click", (e) => {
      marker.setLngLat(e.lngLat);
      if (!marker.getElement().isConnected) marker.addTo(map);
      latest.current({ lat: round(e.lngLat.lat), lng: round(e.lngLat.lng) });
    });
    const onTheme = () => map.setStyle(styleUrl());
    window.addEventListener("biy-theme", onTheme);
    return () => {
      window.removeEventListener("biy-theme", onTheme);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker || !value) return;
    const current = marker.getLngLat();
    if (Math.abs(current.lat - value.lat) > 1e-6 || Math.abs(current.lng - value.lng) > 1e-6) {
      marker.setLngLat([value.lng, value.lat]);
      if (!marker.getElement().isConnected) marker.addTo(map);
      // The marker may sit outside the frame if the numbers were typed in; the
      // camera still stops at the edge rather than following it out of town.
      map.easeTo({ center: clampToIstanbul([value.lng, value.lat]), duration: 400 });
    }
  }, [value]);

  const outside = value ? !isInIstanbul([value.lng, value.lat]) : false;

  return (
    <div>
      <div ref={container} style={{ height }} className="overflow-hidden rounded-control border border-line" />
      <div className="mt-2 grid max-w-sm grid-cols-2 gap-2">
        <input className="field tnum" type="number" step="0.00001" placeholder="Latitude" value={value?.lat ?? ""} onChange={(e) => onChange({ lat: Number(e.target.value), lng: value?.lng ?? ISTANBUL_CENTER[0] })} />
        <input className="field tnum" type="number" step="0.00001" placeholder="Longitude" value={value?.lng ?? ""} onChange={(e) => onChange({ lat: value?.lat ?? ISTANBUL_CENTER[1], lng: Number(e.target.value) })} />
      </div>
      {outside ? <p className="mt-2 text-sm text-warning">These coordinates fall outside İstanbul.</p> : null}
    </div>
  );
}

function round(n: number): number {
  return Math.round(n * 1e5) / 1e5;
}
