"use client";

import maplibregl, { type IControl, type LayerSpecification, type LngLatBoundsLike, type Map as MapLibreMap, type StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { memo, useEffect, useRef } from "react";
import type { GeoJsonLineString, GeoPoint, RouteNodeKind } from "@/lib/contract/api";
import { useI18n } from "@/lib/i18n/context";
import { ISTANBUL_CENTER, ISTANBUL_MAX_BOUNDS, MAX_ZOOM, MIN_ZOOM, clampBounds, clampToIstanbul } from "@/lib/geo";
import { HERO_ORBIT_MS } from "@/lib/hero-orbit";
import { noteMapIdle } from "@/lib/page-ready";

export interface MapNode {
  id: string;
  order: number;
  kind: RouteNodeKind;
  location: GeoPoint;
  label: string;
  /** `numbered` shows the stop number; `pin` is an unordered place on the overview. */
  variant?: "numbered" | "pin";
  /** Thumbnail shown inside the marker circle. Without one the marker falls back to a plain disc. */
  image?: string;
  /** `contain` for logos on a plate; `cover` (default) for photographs. */
  imageFit?: "cover" | "contain";
}

interface Props {
  path?: GeoJsonLineString;
  nodes: MapNode[];
  activeNodeId?: string | null;
  onNodeClick?: (id: string) => void;
  /** `hero`: pitched, slowly turning, no interaction. `explore`: interactive, fitted to the route. */
  mode?: "hero" | "explore" | "static";
  /** Extra padding so the route does not hide behind floating panels. */
  padding?: { top: number; right: number; bottom: number; left: number };
  className?: string;
  /** Re-fit whenever this changes (e.g. the selected route). */
  fitKey?: string;
  /**
   * Draw a line through the nodes. False on the overview, where the pins are a
   * catalogue rather than an itinerary and joining them would invent a journey.
   */
  drawPath?: boolean;
  /**
   * Flat camera, 1× framebuffer, no orbit. A last-resort map when the set
   * cannot hold a pitched city at all.
   */
  lite?: boolean;
  /**
   * Same pitched, turning city as the hero — 1× framebuffer, no sky, no
   * software GL. Pair with a CSS-scaled 1080p box on lounge TVs.
   */
  budget?: boolean;
  /** Hero orbit period in ms. Defaults to the live turn (`HERO_ORBIT_MS`). */
  orbitMs?: number;
}

const STYLE_LIGHT = process.env.NEXT_PUBLIC_MAP_STYLE_LIGHT ?? "https://tiles.openfreemap.org/styles/positron";
const STYLE_DARK = process.env.NEXT_PUBLIC_MAP_STYLE_DARK ?? "https://tiles.openfreemap.org/styles/dark";

function currentTheme(): "dark" | "light" {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function styleFor(theme: "dark" | "light"): string {
  return theme === "light" ? STYLE_LIGHT : STYLE_DARK;
}

function cssVar(name: string, from: HTMLElement | null = document.documentElement): string {
  return getComputedStyle(from ?? document.documentElement).getPropertyValue(name).trim();
}

/*
  3D
  --
  The basemap tiles carry every building footprint with the height OSM knows for it
  (`render_height`, in metres). Extruding those is the whole trick: no models, no extra
  download, just the polygons already on screen given a third dimension once the camera
  leans over.

  Extrusions are the most expensive thing this map draws, and a pitched camera sees far
  more of the city than a flat one does, so the layer is kept deliberately cheap:
  it exists only from z15 (a tilted z14 view is thousands of buildings deep), it draws
  fully opaque — a translucent fill-extrusion costs MapLibre a second depth-only pass over
  every tile — and while it is up, the flat footprints underneath are switched off rather
  than drawn twice.
*/

const BUILDINGS_LAYER = "biy-buildings";
/** Where the skyline starts. Below this a pitched view would extrude half the city at once. */
const BUILDING_ZOOM = 15;
/** Where the 3D button parks the camera, and the pitch above which we call the view 3D. */
const TILT_ZOOM = 16;
const TILT_PITCH = 60;
const TILT_ON = 8;
const MAX_PITCH = 60;

interface BuildingLayers {
  source: string;
  sourceLayer: string;
  /** The basemap's own flat footprints, which the extrusion replaces while it is up. */
  fills: { id: string; minzoom: number; maxzoom: number }[];
}

/**
 * Where this style keeps its buildings. Read from the style rather than hardcoded, so
 * swapping `NEXT_PUBLIC_MAP_STYLE_*` for another vector style keeps working — and a style
 * with no buildings at all simply gets no 3D instead of a crash.
 */
function buildingLayersOf(map: MapLibreMap): BuildingLayers | null {
  const layers = (map.getStyle() as StyleSpecification | undefined)?.layers ?? [];
  const fills = layers.filter(
    (layer): layer is LayerSpecification & { source: string; "source-layer": string } =>
      layer.type === "fill" && "source-layer" in layer && typeof layer["source-layer"] === "string" && /building/i.test(layer["source-layer"]),
  );
  if (!fills.length) return null;
  return {
    source: fills[0].source,
    sourceLayer: fills[0]["source-layer"],
    fills: fills.map((layer) => ({ id: layer.id, minzoom: layer.minzoom ?? 0, maxzoom: layer.maxzoom ?? 24 })),
  };
}

/**
 * Where the extrusion belongs in the stack: above the roads, under the labels. These
 * styles paint their flat buildings *below* the road network, so the footprint layer is
 * the wrong neighbour — the first label drawn after the last road is the right one.
 */
function skylineBefore(map: MapLibreMap): string | undefined {
  const layers = (map.getStyle() as StyleSpecification | undefined)?.layers ?? [];
  let lastLine = -1;
  for (let i = 0; i < layers.length; i++) if (layers[i].type === "line") lastLine = i;
  return layers.find((layer, i) => layer.type === "symbol" && i > lastLine)?.id ?? layers.find((layer) => layer.type === "symbol")?.id;
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/**
 * The extruded city. Heights grow in over half a zoom level so the skyline rises as you
 * arrive rather than popping, and taller buildings are lighter so the mass reads without
 * inventing a sun.
 */
function addBuildingLayer(map: MapLibreMap, layers: BuildingLayers, visible: boolean) {
  if (map.getLayer(BUILDINGS_LAYER)) return;
  const low = cssVar("--map-building") || "#1c1c22";
  const high = cssVar("--map-building-tall") || "#3b3b47";
  const height = (property: string, fallback: number) => [
    "interpolate",
    ["linear"],
    ["zoom"],
    BUILDING_ZOOM,
    0,
    BUILDING_ZOOM + 0.8,
    ["coalesce", ["get", property], fallback],
  ];
  map.addLayer(
    {
      id: BUILDINGS_LAYER,
      type: "fill-extrusion",
      source: layers.source,
      "source-layer": layers.sourceLayer,
      minzoom: BUILDING_ZOOM,
      // `hide_3d` is the tiles' own flag for footprints that must stay flat (bridges, parts).
      filter: ["all", ["!=", ["get", "hide_3d"], true], ["match", ["geometry-type"], ["Polygon", "MultiPolygon"], true, false]],
      layout: { visibility: visible ? "visible" : "none" },
      paint: {
        "fill-extrusion-color": ["interpolate", ["linear"], ["coalesce", ["get", "render_height"], 0], 0, low, 25, low, 90, high, 250, high],
        "fill-extrusion-height": height("render_height", 5) as never,
        "fill-extrusion-base": height("render_min_height", 0) as never,
        // Opaque on purpose: anything under 1 doubles the draw cost of the whole layer.
        "fill-extrusion-opacity": 1,
        "fill-extrusion-vertical-gradient": true,
      },
    },
    skylineBefore(map),
  );
}

function lineGeoJson(path?: GeoJsonLineString, nodes?: MapNode[], draw = true): GeoJSON.Feature<GeoJSON.LineString> {
  const coordinates = !draw ? [] : path?.coordinates?.length ? path.coordinates : (nodes ?? []).map((n) => [n.location.lng, n.location.lat] as [number, number]);
  return { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates } };
}

/** Hero stops live on the canvas so a baked loop (captureStream) keeps the rings. */
function stopsGeoJson(nodes: MapNode[]): GeoJSON.FeatureCollection {
  const ordered = [...nodes].sort((a, b) => a.order - b.order);
  const ends = new Set([ordered[0]?.id, ordered[ordered.length - 1]?.id]);
  return {
    type: "FeatureCollection",
    features: nodes.map((node) => ({
      type: "Feature" as const,
      properties: { partner: node.kind === "BUSINESS" || ends.has(node.id) ? "yes" : "no" },
      geometry: { type: "Point" as const, coordinates: [node.location.lng, node.location.lat] },
    })),
  };
}

function setStops(map: MapLibreMap, nodes: MapNode[]) {
  const data = stopsGeoJson(nodes);
  const source = map.getSource("stops") as maplibregl.GeoJSONSource | undefined;
  if (source) source.setData(data);
  else map.addSource("stops", { type: "geojson", data });
}

function boundsOf(nodes: MapNode[], path?: GeoJsonLineString): LngLatBoundsLike | null {
  const raw: [number, number][] = path?.coordinates?.length ? path.coordinates : nodes.map((n) => [n.location.lng, n.location.lat]);
  if (!raw.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  // Clamp first: one stray coordinate must not drag the camera out of the city.
  for (const [x, y] of raw.map(clampToIstanbul)) {
    minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  return clampBounds([[minX, minY], [maxX, maxY]]);
}

/**
 * The one map used everywhere. Owns its MapLibre instance, re-applies the route layers
 * whenever the style (theme) swaps, and keeps DOM markers in sync with `nodes`.
 * No React state is touched per frame: the hero rotation runs on requestAnimationFrame.
 */
function RouteMapImpl({ path, nodes, activeNodeId, onNodeClick, mode = "explore", padding, className, fitKey, drawPath = true, lite = false, budget = false, orbitMs }: Props) {
  const { t } = useI18n();
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markers = useRef<Map<string, maplibregl.Marker>>(new Map());
  const clusters = useRef<Map<string, maplibregl.Marker>>(new Map());
  // The map is built once; this keeps the newest props reachable from inside its
  // long-lived handlers without tearing the map down on every render.
  const latest = useRef({ path, nodes, activeNodeId, onNodeClick, padding, mode, drawPath, lite, budget, orbitMs, t });
  useEffect(() => {
    latest.current = { path, nodes, activeNodeId, onNodeClick, padding, mode, drawPath, lite, budget, orbitMs, t };
  }, [path, nodes, activeNodeId, onNodeClick, padding, mode, drawPath, lite, budget, orbitMs, t]);
  /** Re-labels the 3D button when the language changes under a map that is never rebuilt. */
  const syncTilt = useRef<() => void>(() => {});
  /** The padding a refit last flew to, and when: the pan below tells its own work apart. */
  const fitted = useRef<Props["padding"]>(undefined);
  const fitAt = useRef(0);

  // Create the map once.
  useEffect(() => {
    if (!container.current || mapRef.current) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const hero = mode === "hero";
    const cheap = lite;
    const lean = budget;
    let map: MapLibreMap;
    try {
      map = new maplibregl.Map({
        container: container.current,
        style: styleFor(currentTheme()),
        center: ISTANBUL_CENTER,
        zoom: hero ? 12.2 : 11.5,
        pitch: hero && !cheap ? 58 : 0,
        bearing: hero && !cheap ? -18 : 0,
        // The product is an İstanbul guide: the camera stays inside the province.
        maxBounds: ISTANBUL_MAX_BOUNDS,
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
        maxPitch: cheap ? 0 : MAX_PITCH,
        interactive: mode === "explore",
        // The credit is a line of text under the controls, not a button to press: see globals.css.
        attributionControl: false,
        cooperativeGestures: false,
        fadeDuration: cheap || lean ? 0 : 300,
        // A 4K set at 2× is an 8K framebuffer. That is what goes black on lounge GPUs.
        ...(cheap || lean ? { pixelRatio: 1 } : {}),
        // Software GL on a set is a black rectangle. Prefer the still underneath.
        ...(lean ? { canvasContextAttributes: { failIfMajorPerformanceCaveat: true } } : {}),
      });
    } catch {
      return;
    }
    mapRef.current = map;
    // OpenFreeMap styles name a wood fill that the sprite never ships. MapLibre
    // logs every missing image; a transparent pixel keeps the style valid.
    map.on("styleimagemissing", (event) => {
      if (map.hasImage(event.id)) return;
      map.addImage(event.id, { width: 1, height: 1, data: new Uint8Array(4) });
    });

    let tilt: { control: IControl; sync: () => void } | null = null;
    if (mode === "explore") {
      tilt = tiltControl(map, () => latest.current.t.explore);
      map.addControl(tilt.control, "bottom-right");
      // The compass doubles as the rotate handle and, dragged, as the tilt handle.
      map.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }), "bottom-right");
      // No attribution on the canvas: the OpenStreetMap / OpenFreeMap credit lives in the site footer instead.
      // Everything that changes the angle: drag with the right button or ⌘/Ctrl on a desktop,
      // twist or drag two fingers on a phone.
      map.dragRotate.enable();
      map.touchZoomRotate.enable();
      map.touchPitch.enable();
    }

    /** Which of the style's layers hold the flat footprints; re-read after every style swap. */
    let buildings: BuildingLayers | null = null;

    const is3d = () => map.getPitch() > TILT_ON;

    /**
     * The skyline goes up only while the camera is leaning over, and the flat footprints
     * come down while it is — drawing both would pay for the same buildings twice. `pitch`
     * fires every frame of a tilt, so this only touches the style on the frame that crosses
     * the threshold: a `setLayoutProperty` per frame re-flags the whole style.
     */
    let tilted: boolean | null = null;
    const applyTilt = () => {
      const on = is3d();
      if (on === tilted) return;
      tilted = on;
      if (map.getLayer(BUILDINGS_LAYER)) map.setLayoutProperty(BUILDINGS_LAYER, "visibility", on ? "visible" : "none");
      for (const fill of buildings?.fills ?? []) {
        if (map.getLayer(fill.id)) map.setLayerZoomRange(fill.id, fill.minzoom, on ? BUILDING_ZOOM : fill.maxzoom);
      }
      tilt?.sync();
    };
    syncTilt.current = applyTilt;

    const applyLayers = () => {
      const root = map.getContainer();
      const accent = cssVar("--accent", root) || "#8ea3ff";
      const glow = cssVar("--map-glow", root) || "rgba(142,163,255,0.45)";
      const bg = cssVar("--bg", root) || "#0b0d12";
      const pinRim = cssVar("--map-pin-rim", root) || "rgba(255, 255, 255, 0.92)";
      const casing = hero ? pinRim : bg;
      const casingWidth = hero ? 4.5 : 6;
      // Before the route, so the itinerary always draws over the rooftops.
      buildings = cheap ? null : buildingLayersOf(map);
      if (buildings) addBuildingLayer(map, buildings, is3d());
      tilted = null;
      // At 60° the horizon is in frame; without this it is the void behind the tiles.
      // Atmosphere is a WebGL2 path some lounge sets do not have — skip it there.
      if (!cheap && !lean) {
        try {
          map.setSky({
            "sky-color": bg,
            "horizon-color": cssVar("--surface-2", root) || bg,
            "fog-color": bg,
            "sky-horizon-blend": 0.8,
            "horizon-fog-blend": 0.6,
            "fog-ground-blend": 0.02,
            "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 10, 0.5, 16, 0.15],
          });
        } catch {
          /* Older WebGL: the city still draws, the void at the horizon stays dark. */
        }
      }
      const data = lineGeoJson(latest.current.path, latest.current.nodes, latest.current.drawPath);
      if (map.getSource("route")) {
        (map.getSource("route") as maplibregl.GeoJSONSource).setData(data);
      } else {
        map.addSource("route", { type: "geojson", data, lineMetrics: true });
      }
      if (!map.getLayer("route-glow")) {
        map.addLayer({
          id: "route-glow",
          type: "line",
          source: "route",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": glow, "line-width": hero ? 14 : 12, "line-blur": 10, "line-opacity": 0.8 },
        });
      }
      if (!map.getLayer("route-casing")) {
        map.addLayer({
          id: "route-casing",
          type: "line",
          source: "route",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": casing, "line-width": casingWidth, "line-opacity": 0.9 },
        });
      } else {
        map.setPaintProperty("route-casing", "line-color", casing);
        map.setPaintProperty("route-casing", "line-width", casingWidth);
      }
      if (!map.getLayer("route-line")) {
        map.addLayer({
          id: "route-line",
          type: "line",
          source: "route",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": accent, "line-width": hero ? 3 : 3.2 },
        });
      }
      // Quiet the basemap: labels smaller on the hero, POIs gone everywhere.
      const style = map.getStyle() as StyleSpecification | undefined;
      for (const layer of style?.layers ?? []) {
        if (/poi|housenum|airport-label|ferry/i.test(layer.id) && layer.type === "symbol") {
          map.setLayoutProperty(layer.id, "visibility", "none");
        }
        if (hero && layer.type === "symbol" && /label|place/i.test(layer.id)) {
          map.setPaintProperty(layer.id, "text-opacity", 0.55);
        }
      }
      applyTilt();
      if (hero) {
        setStops(map, latest.current.nodes);
        if (!map.getLayer("stop-glow")) {
          map.addLayer({
            id: "stop-glow",
            type: "circle",
            source: "stops",
            paint: {
              "circle-color": accent,
              "circle-radius": ["case", ["==", ["get", "partner"], "yes"], 20, 10],
              "circle-opacity": 0.4,
              "circle-blur": 0.7,
              "circle-pitch-alignment": "viewport",
            },
          });
        }
        if (!map.getLayer("stop-fill")) {
          map.addLayer({
            id: "stop-fill",
            type: "circle",
            source: "stops",
            paint: {
              "circle-color": accent,
              "circle-radius": ["case", ["==", ["get", "partner"], "yes"], 8.5, 5],
              "circle-stroke-color": pinRim,
              "circle-stroke-width": ["case", ["==", ["get", "partner"], "yes"], 2.4, 1.2],
              "circle-pitch-alignment": "viewport",
            },
          });
        }
      }
    };

    map.on("style.load", applyLayers);
    map.on("load", () => {
      applyLayers();
      fitAt.current = performance.now();
      fit(map, latest.current.nodes, latest.current.path, latest.current.padding, mode, true, cheap, lean);
      /* The house radio waits on this: the music arrives with the city, not before it.
         Deliberately not on `style.load`, which also fires on every theme swap. */
      window.dispatchEvent(new CustomEvent("biy-map-ready"));
      map.once("idle", () => {
        noteMapIdle();
        window.dispatchEvent(new CustomEvent("biy-map-idle"));
      });
    });
    map.on("pitch", applyTilt);

    /**
     * ⌘/Ctrl + scroll tilts, Shift + scroll turns. Both are browser gestures by default
     * — Ctrl + wheel is page zoom, and a trackpad pinch arrives as one — so the listener
     * has to be non-passive and take the event in the capture phase, before MapLibre's own
     * wheel handler on the canvas and before the browser acts on it.
     */
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey && !event.shiftKey) return;
      event.preventDefault();
      event.stopPropagation();
      // Wheels report anything from ±3 to ±300 for one notch; cap it so a mouse and a
      // trackpad move the camera by roughly the same amount.
      const step = clamp(event.deltaY, -50, 50);
      if (event.shiftKey && !event.ctrlKey && !event.metaKey) map.setBearing(map.getBearing() - step * 0.4);
      else map.setPitch(clamp(map.getPitch() - step * 0.25, 0, MAX_PITCH));
    };
    if (mode === "explore") container.current.addEventListener("wheel", onWheel, { passive: false, capture: true });

    // Hero: a slow orbit, storytelling the route, unless motion is reduced
    // or the set cannot hold a turning WebGL camera.
    let raf = 0;
    if (hero && !reduceMotion && !cheap) {
      let last = performance.now();
      const degPerMs = 360 / (latest.current.orbitMs ?? HERO_ORBIT_MS);
      const tick = (now: number) => {
        const dt = now - last;
        last = now;
        map.setBearing(map.getBearing() + dt * degPerMs);
        raf = requestAnimationFrame(tick);
      };
      map.once("load", () => {
        raf = requestAnimationFrame(tick);
      });
    }

    const onTheme = () => {
      map.setStyle(styleFor(currentTheme()), { diff: false });
    };
    window.addEventListener("biy-theme", onTheme);

    // The two marker maps are captured here so teardown clears the very collections this
    // map filled, not whatever a later map has since put in the refs.
    const ownMarkers = markers.current;
    const ownClusters = clusters.current;
    const node = container.current;
    return () => {
      window.removeEventListener("biy-theme", onTheme);
      node.removeEventListener("wheel", onWheel, { capture: true });
      cancelAnimationFrame(raf);
      ownMarkers.forEach((m) => m.remove());
      ownMarkers.clear();
      ownClusters.forEach((m) => m.remove());
      ownClusters.clear();
      map.remove();
      mapRef.current = null;
    };
    // The map is created once; props flow through `latest`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Route data changed: update the line and refit.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    // The refit below already flies to this padding; the pan underneath must not cut it short.
    fitted.current = latest.current.padding;
    const update = () => {
      const source = map.getSource("route") as maplibregl.GeoJSONSource | undefined;
      if (source) source.setData(lineGeoJson(path, nodes, drawPath));
      if (mode === "hero") setStops(map, nodes);
      fitAt.current = performance.now();
      fit(map, nodes, path, latest.current.padding, mode, false, latest.current.lite, latest.current.budget);
    };
    if (map.isStyleLoaded()) update();
    else map.once("load", update);
  }, [fitKey, path, nodes, mode, drawPath]);

  /**
   * The panel moved, not the route. Refitting here would throw away wherever the reader
   * had panned to, so the camera only slides by the difference: the same city, further
   * up the screen, above whatever now covers the bottom of it.
   */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || mode !== "explore" || !padding || fitted.current === padding) return;
    fitted.current = padding;
    // A refit is still in the air. It left with the old padding — and the drawer settles
    // a beat after it does — so redo the fit rather than pan a camera that has not landed.
    if (performance.now() - fitAt.current < FIT_MS + 400) {
      fitAt.current = performance.now();
      fit(map, nodes, path, padding, mode, false);
      return;
    }
    map.easeTo({ padding, duration: 420, essential: true });
  }, [padding, mode, nodes, path]);

  // Markers follow the node list. Overlapping ones merge into a cluster whose tap zooms in.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (mode === "hero") {
      markers.current.forEach((marker) => marker.remove());
      markers.current.clear();
      return;
    }
    const seen = new Set<string>();
    for (const node of nodes) {
      seen.add(node.id);
      let marker = markers.current.get(node.id);
      if (!marker) {
        // MapLibre positions a marker by writing `transform` on the element it is given, on
        // every frame of a zoom or pan. That element must carry no CSS transition of its own
        // or the pins trail the camera; every visual (hover/active scale) lives on the inner
        // button instead, and subpixel positioning keeps them from snapping between pixels.
        const wrap = document.createElement("div");
        wrap.className = "node-marker-wrap";
        // Stacking belongs on the wrapper, not the button inside it: MapLibre lays the
        // markers out as absolutely positioned siblings, so a z-index one level down
        // cannot lift a partner over the marker — or the cluster — drawn after it.
        wrap.dataset.kind = node.kind;
        const el = document.createElement("button");
        el.type = "button";
        el.className = "node-marker";
        el.dataset.kind = node.kind;
        el.setAttribute("aria-label", node.label);
        const photo = document.createElement("span");
        photo.className = "node-marker-photo";
        const num = document.createElement("span");
        num.className = "node-marker-num";
        el.append(photo, num);
        // Partner venues are named on the map itself. The point of the partnership is
        // that people can see where the day starts and ends without opening anything,
        // and a photo disc alone does not say whose door it is.
        if (node.kind === "BUSINESS") {
          const name = document.createElement("span");
          name.className = "node-marker-name";
          el.appendChild(name);
        }
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          latest.current.onNodeClick?.(node.id);
        });
        wrap.appendChild(el);
        marker = new maplibregl.Marker({ element: wrap, anchor: "center", subpixelPositioning: true }).setLngLat([node.location.lng, node.location.lat]).addTo(map);
        markers.current.set(node.id, marker);
      } else {
        marker.setLngLat([node.location.lng, node.location.lat]);
      }
      const button = marker.getElement().firstElementChild as HTMLElement | null;
      if (button) {
        syncMarker(button, node);
        button.dataset.active = String(node.id === activeNodeId);
      }
    }
    for (const [id, marker] of markers.current) {
      if (!seen.has(id)) {
        marker.remove();
        markers.current.delete(id);
      }
    }

    if (mode !== "explore") return;

    // Screen-space clustering, re-run on every camera frame: markers closer than a
    // marker's width fold into one, and split again as soon as the zoom separates them.
    /** Which partner venues each live badge is currently stepping around, by member key. */
    const pushedByKey = new Map<string, MapNode[]>();

    const cluster = () => {
      const active = latest.current.activeNodeId;
      const R = 58;
      // Agglomerative: every place starts alone; any two groups whose centres sit closer
      // than a marker's width merge, and merging repeats until nothing is close any more.
      // That way a chain of near neighbours folds into one badge instead of several
      // overlapping ones, and the count keeps growing as the camera pulls back.
      // `pushedBy` names the partner venues this group had to step around — what the
      // badge's tap reads to widen its frame.
      type Group = { members: MapNode[]; x: number; y: number; pushedBy?: MapNode[] };
      // Partner venues are held out of the grouping entirely. They are the places the
      // routes are built around, and a count badge over one of them would hide exactly
      // what is meant to stand out — so they stay on the map at every zoom, alone.
      const standalone = new Set(latest.current.nodes.filter((n) => n.kind === "BUSINESS").map((n) => n.id));
      let groups: Group[] = latest.current.nodes
        .filter((n) => n.id !== active && !standalone.has(n.id))
        .map((n) => {
          const p = map.project([n.location.lng, n.location.lat]);
          return { members: [n], x: p.x, y: p.y };
        });
      let merged = true;
      while (merged) {
        merged = false;
        outer: for (let i = 0; i < groups.length; i++) {
          for (let j = i + 1; j < groups.length; j++) {
            const dx = groups[i].x - groups[j].x, dy = groups[i].y - groups[j].y;
            if (dx * dx + dy * dy <= R * R) {
              const a = groups[i], b = groups[j];
              const n = a.members.length + b.members.length;
              groups[i] = { members: [...a.members, ...b.members], x: (a.x * a.members.length + b.x * b.members.length) / n, y: (a.y * a.members.length + b.y * b.members.length) / n };
              groups.splice(j, 1);
              merged = true;
              break outer;
            }
          }
        }
      }
      groups = groups.map((g) => ({ ...g, members: [...g.members].sort((m, k) => m.order - k.order) }));
      // Holding the partners out of the grouping is only half of it: a cluster can still
      // drift on top of one, and a partner drawn over a badge hides a dozen places behind
      // one disc. So the badge steps aside instead — the venue keeps its true position,
      // and the cluster moves to the nearest point where both can be read. The gap clears
      // the partner's disc, its ring and the name plate hanging under it.
      const CLEARANCE = 92;
      const anchors = latest.current.nodes
        .filter((n) => standalone.has(n.id))
        .map((n) => ({ node: n, p: map.project([n.location.lng, n.location.lat]) }));
      for (const g of groups) {
        for (const { node: venue, p: a } of anchors) {
          let dx = g.x - a.x, dy = g.y - a.y;
          const d = Math.hypot(dx, dy);
          if (d >= CLEARANCE) continue;
          // Dead centre on the venue: there is no direction to push, so pick one.
          if (d < 0.5) { dx = 1; dy = 0; }
          const scale = CLEARANCE / Math.max(d, 0.5);
          g.x = a.x + dx * scale;
          g.y = a.y + dy * scale;
          (g.pushedBy ??= []).push(venue);
        }
      }
      /*
       * The click handler below is bound once, when the badge is first created, but which
       * venues a badge is dodging changes as the camera moves. So the handler asks this at
       * the moment of the tap rather than closing over a stale list, keyed by the group's
       * membership — the same key the badge itself is stored under.
       */
      for (const g of groups) pushedByKey.set(g.members.map((m) => m.id).join("|"), g.pushedBy ?? []);

      // This runs on every frame of a pan, so nothing is written that is already true:
      // reassigning `display` on every marker costs a style recalculation each frame.
      const show = (el: HTMLElement | undefined, visible: boolean) => {
        const value = visible ? "" : "none";
        if (el && el.style.display !== value) el.style.display = value;
      };
      if (active) show(markers.current.get(active)?.getElement(), true);
      for (const id of standalone) show(markers.current.get(id)?.getElement(), true);
      const used = new Set<string>();
      for (const g of groups) {
        const solo = g.members.length === 1;
        for (const m of g.members) show(markers.current.get(m.id)?.getElement(), solo);
        if (solo) continue;
        const key = g.members.map((m) => m.id).join("|");
        used.add(key);
        let cm = clusters.current.get(key);
        const lngLat = map.unproject([g.x, g.y]);
        if (!cm) {
          const wrap = document.createElement("div");
          wrap.className = "node-marker-wrap";
          const el = document.createElement("button");
          el.type = "button";
          el.className = "node-marker";
          el.dataset.cluster = "true";
          el.setAttribute("aria-label", g.members.map((m) => m.label).join(", "));
          const photo = document.createElement("span");
          photo.className = "node-marker-photo";
          const first = g.members.find((m) => m.image);
          photo.style.backgroundImage = first?.image ? `url("${first.image}")` : "";
          el.dataset.photo = String(Boolean(first?.image));
          const num = document.createElement("span");
          num.className = "node-marker-num";
          num.textContent = String(g.members.length);
          el.append(photo, num);
          const members = g.members;
          el.addEventListener("click", (e) => {
            e.stopPropagation();
            // Frame every member: fit their bounds with room to breathe, zooming as far as it
            // takes for them to stand apart. Co-located places just step in two levels.
            //
            // A badge that was pushed off a partner venue is framed together with that
            // venue, not just with its own members. The badge is sitting somewhere it does
            // not belong precisely because the venue is underneath it, so the camera has to
            // land somewhere both are legible — otherwise the zoom re-crowds the pair and
            // the badge is shoved aside again on arrival. Nothing about the venue changes:
            // it keeps its position and its own tap, and only widens what the camera fits.
            const key = members.map((m) => m.id).join("|");
            const framed = [...members, ...(pushedByKey.get(key) ?? [])].map((m) => m.location);
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (const p of framed) {
              minX = Math.min(minX, p.lng); maxX = Math.max(maxX, p.lng);
              minY = Math.min(minY, p.lat); maxY = Math.max(maxY, p.lat);
            }
            const degenerate = maxX - minX < 1e-5 && maxY - minY < 1e-5;
            if (degenerate) {
              map.easeTo({ center: [minX, minY], zoom: Math.min(MAX_ZOOM, map.getZoom() + 2), duration: 700, essential: true });
              return;
            }
            // The camera already carries the panel padding; this is only room for the discs.
            map.fitBounds([[minX, minY], [maxX, maxY]], {
              padding: 100,
              maxZoom: MAX_ZOOM,
              duration: 800,
              essential: true,
            });
          });
          wrap.appendChild(el);
          cm = new maplibregl.Marker({ element: wrap, anchor: "center", subpixelPositioning: true }).setLngLat(lngLat).addTo(map);
          clusters.current.set(key, cm);
        } else {
          cm.setLngLat(lngLat);
        }
      }
      for (const [key, cm] of clusters.current) {
        if (!used.has(key)) {
          cm.remove();
          clusters.current.delete(key);
        }
      }
      // Groupings churn on every frame of a pan; without this the key map would keep a
      // row for every combination the camera has ever passed through.
      for (const key of pushedByKey.keys()) if (!used.has(key)) pushedByKey.delete(key);
    };
    cluster();
    map.on("move", cluster);
    map.on("moveend", cluster);
    return () => {
      map.off("move", cluster);
      map.off("moveend", cluster);
    };
  }, [nodes, activeNodeId, mode]);

  // The map outlives a language change; the 3D button's label has to catch up.
  useEffect(() => {
    syncTilt.current();
  }, [t]);

  // Fly to the active node in explore mode.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || mode !== "explore" || !activeNodeId) return;
    const node = nodes.find((n) => n.id === activeNodeId);
    if (!node) return;
    const pad = padding ?? { top: 80, right: 40, bottom: 40, left: 40 };
    map.easeTo({
      center: [node.location.lng, node.location.lat],
      zoom: Math.max(map.getZoom(), map.getPitch() > TILT_ON ? TILT_ZOOM : 14.2),
      duration: 900,
      padding: pad,
      essential: true,
    });
  }, [activeNodeId, nodes, mode, padding]);

  return <div ref={container} data-city="map" className={className} aria-hidden={mode === "hero"} />;
}

/**
 * The 3D switch, in the corner the attribution "i" used to sit in. One press leans the
 * camera over and, if the view is still city-wide, flies in far enough for the buildings
 * to exist; the next press lays the city flat and puts north back at the top. Pitch is the
 * only state — drag the compass or Ctrl + scroll and the button follows on its own.
 */
function tiltControl(map: MapLibreMap, labels: () => { tilt: string; flatten: string; tiltHint: string }): { control: IControl; sync: () => void } {
  const group = document.createElement("div");
  group.className = "maplibregl-ctrl maplibregl-ctrl-group";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "map-tilt-btn";
  group.appendChild(button);

  const sync = () => {
    const on = map.getPitch() > TILT_ON;
    const { tilt, flatten, tiltHint } = labels();
    button.textContent = on ? "2D" : "3D";
    button.dataset.on = String(on);
    button.setAttribute("aria-pressed", String(on));
    button.setAttribute("aria-label", on ? flatten : tilt);
    button.title = `${on ? flatten : tilt} — ${tiltHint}`;
  };

  button.addEventListener("click", () => {
    if (map.getPitch() > TILT_ON) {
      map.easeTo({ pitch: 0, bearing: 0, duration: 700, essential: true });
      return;
    }
    const zoom = Math.max(map.getZoom(), TILT_ZOOM);
    const camera = { pitch: TILT_PITCH, zoom, essential: true } as const;
    // Coming from a whole-city view it is a journey, not a nudge: fly it.
    if (zoom - map.getZoom() > 0.6) map.flyTo({ ...camera, duration: 1600 });
    else map.easeTo({ ...camera, duration: 800 });
  });

  sync();
  return { control: { onAdd: () => group, onRemove: () => group.remove() }, sync };
}

/** Keep a marker's photo, number and variant in step with its node without rebuilding the DOM. */
function syncMarker(el: HTMLElement, node: MapNode) {
  const photo = el.querySelector<HTMLElement>(".node-marker-photo");
  const num = el.querySelector<HTMLElement>(".node-marker-num");
  if (node.variant === "pin") el.dataset.variant = "pin";
  else delete el.dataset.variant;
  if (photo) {
    const url = node.image ?? "";
    if (photo.dataset.src !== url) {
      photo.dataset.src = url;
      photo.style.backgroundImage = url ? `url("${url}")` : "";
    }
    el.dataset.photo = String(Boolean(url));
    el.dataset.fit = node.imageFit ?? "cover";
  }
  if (num) num.textContent = node.variant === "pin" ? "" : String(node.order + 1);
  const name = el.querySelector<HTMLElement>(".node-marker-name");
  if (name && name.textContent !== node.label) name.textContent = node.label;
}

/** How long a refit flies for. The pan effect waits this out before overruling one. */
const FIT_MS = 1100;

/**
 * Hands the camera the padding the panel asks for — unless the city cannot fit in what
 * is left. Below MapLibre's floor zoom a fit no longer honours its own box and the pins
 * spill across the panel, so in that one case the padding gives back exactly as much as
 * the fit needs and the whole map lands in the frame instead of across it.
 */
function reserve(map: MapLibreMap, bounds: LngLatBoundsLike, pad: NonNullable<Props["padding"]>) {
  map.setPadding(pad);
  const zoom = map.cameraForBounds(bounds, { padding: 0, maxZoom: 14 })?.zoom;
  if (zoom === undefined || zoom >= MIN_ZOOM) return;
  const available = map.getContainer().clientHeight - pad.top - pad.bottom;
  const short = available * 2 ** (MIN_ZOOM - zoom) - available;
  const sum = pad.top + pad.bottom;
  const keep = Math.max(0, Math.min(1, (sum - short) / sum));
  map.setPadding({ ...pad, top: Math.round(pad.top * keep), bottom: Math.round(pad.bottom * keep) });
}

function fit(map: MapLibreMap, nodes: MapNode[], path: GeoJsonLineString | undefined, padding: Props["padding"], mode: Props["mode"], initial: boolean, lite = false, budget = false) {
  const bounds = boundsOf(nodes, path);
  if (!bounds) return;
  if (mode === "hero") {
    map.fitBounds(bounds, {
      padding: lite || budget ? { top: 80, right: 80, bottom: 80, left: 80 } : { top: 120, right: 80, bottom: 80, left: 380 },
      pitch: lite ? 0 : 58,
      bearing: map.getBearing(),
      duration: initial ? 0 : 1600,
      maxZoom: 13.4,
    });
    return;
  }
  /*
   * The padding belongs to the camera, not to the fit. MapLibre adds the camera's own
   * padding to whatever a fit is handed and never writes it back, so passing the panel
   * inset here would count it twice — and a phone's drawer is tall enough that twice is
   * more than the canvas, which makes MapLibre refuse the fit and leave the map where
   * it was. Set it once, fit inside it.
   */
  reserve(map, bounds, padding ?? { top: 100, right: 60, bottom: 60, left: 60 });
  map.fitBounds(bounds, { padding: 0, duration: initial ? 0 : FIT_MS, maxZoom: 14, essential: true });
}

export const RouteMap = memo(RouteMapImpl);
