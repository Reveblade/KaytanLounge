"use client";

import { useRouter } from "next/navigation";
import type { AttractionDto, BusinessDto, GeoPoint, RouteNodeKind } from "@/lib/contract/api";
import { markerThumb, placeKind } from "@/lib/place";
import { RouteMap } from "./lazy-route-map";

interface Props {
  location: GeoPoint;
  label: string;
  /** The place this pin stands for; its photograph — or its logo — fills the marker circle. */
  place?: AttractionDto | BusinessDto | null;
  /** Overrides what the record says; a partner venue is drawn as one either way. */
  kind?: RouteNodeKind;
  /** Where the pin leads when tapped — the explore map focused on this place. */
  href?: string;
  className?: string;
}

/** A single place pin, no interaction — the very marker the explore map draws, so it reads the same everywhere. */
export function StaticMap({ location, label, place, kind, href, className }: Props) {
  const router = useRouter();
  return (
    <div className={className}>
      <RouteMap
        mode="static"
        nodes={[{ id: "pin", order: 0, kind: kind ?? placeKind(place), location, label, variant: "pin", ...markerThumb(place) }]}
        onNodeClick={href ? () => router.push(href) : undefined}
        className="h-full w-full"
        fitKey={`${location.lat},${location.lng}`}
        padding={{ top: 40, right: 40, bottom: 40, left: 40 }}
      />
    </div>
  );
}
