import type { AttractionDto, BusinessDto, MediaItem, RouteNodeKind } from "./contract/api";

export interface MarkerThumb {
  /** What goes in the marker circle, if the place has anything to show. */
  image?: string;
  /** `contain` for logos on a plate; `cover` (default) for photographs. */
  imageFit?: "cover" | "contain";
}

/**
 * What goes in a place's marker circle: the first photograph at thumbnail size, or — for a
 * venue that has no photography yet — its logo, fitted on a plate rather than cropped.
 *
 * One rule, shared: the pin on the explore map, the pin on a place page and the pin on the
 * meeting-point card are the same place, and a reader who saw one should recognise the next.
 */
export function markerThumb(place: AttractionDto | BusinessDto | null | undefined): MarkerThumb {
  if (!place) return {};
  const first = place.media?.find((m: MediaItem) => m.kind === "IMAGE");
  if (first) return { image: first.thumbnailUrl ?? first.url, imageFit: "cover" };
  const logo = "logo" in place ? place.logo : undefined;
  return logo ? { image: logo.thumbnailUrl ?? logo.url, imageFit: "contain" } : {};
}

/**
 * Which kind of place this is, read off the record itself. Route stops arrive with their
 * kind attached, but a place handed around on its own (a meeting point, a place page)
 * does not — and a partner venue has to be drawn as one wherever it appears, not only
 * where a route happened to name it. `sponsorTier` exists on businesses alone.
 */
export function placeKind(place: AttractionDto | BusinessDto | null | undefined): RouteNodeKind {
  return place && "sponsorTier" in place ? "BUSINESS" : "ATTRACTION";
}
