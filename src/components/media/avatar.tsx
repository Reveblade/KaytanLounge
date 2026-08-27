import { clsx } from "clsx";
import type { MediaItem } from "@/lib/contract/api";
import { PlaceImage } from "./place-image";

/**
 * A portrait when there is one, otherwise the person's initials set in the display face.
 * Guides without a photo should read as a considered blank, not a broken image.
 */
export function Avatar({ media, name, className, sizes = "96px" }: { media?: MediaItem; name: string; className?: string; sizes?: string }) {
  if (media) return <PlaceImage media={media} alt={name} className={clsx("rounded-pill", className)} sizes={sizes} thumb />;
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase("tr-TR") ?? "")
    .join("");
  return (
    <span className={clsx("grid place-items-center rounded-pill border border-line bg-surface-2 font-semibold leading-none text-ink-muted", className)} aria-hidden>
      {initials}
    </span>
  );
}
