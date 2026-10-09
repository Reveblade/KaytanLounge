"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { RouteMap as RouteMapType } from "./route-map";

export type { MapNode } from "./route-map";

/**
 * MapLibre is ~1MB of JavaScript — five times the size of every other chunk we ship.
 * Statically importing `RouteMap` put that megabyte in the critical path of four
 * routes, including the landing page, where the map is a decorative backdrop behind
 * the headline. So the library is split out and fetched after the page is interactive.
 *
 * `ssr: false` costs nothing: the map is built inside an effect against a real DOM
 * container, so it never rendered on the server anyway — it only ever emitted an
 * empty div into the HTML.
 */
export const RouteMap = dynamic(() => import("./route-map").then((m) => m.RouteMap), {
  ssr: false,
  // The container keeps its own background until the map paints; a spinner here would
  // flash against the hero scrim. The explore screen draws its own curtain on top.
  loading: () => null,
}) as typeof RouteMapType;

export type RouteMapProps = ComponentProps<typeof RouteMapType>;
