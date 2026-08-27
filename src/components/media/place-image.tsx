import Image from "next/image";
import { clsx } from "clsx";
import type { MediaItem } from "@/lib/contract/api";

/**
 * How the image is sized. Getting this wrong silently collapses the box to zero
 * height, so it is stated rather than inferred:
 *
 * - `box`   the wrapper is positioned and the caller gives it a size (h-14 w-14, aspect-[4/3]).
 * - `inset` the wrapper fills an already-positioned parent (a card with its own aspect ratio).
 * - `flow`  no wrapper at all; the image keeps its intrinsic ratio and flows (masonry, article body).
 */
type Mode = "box" | "inset" | "flow";

interface Props {
  media?: MediaItem;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
  /** Ask for the list-sized rendition when one exists. */
  thumb?: boolean;
  mode?: Mode;
}

/**
 * Media we host is already optimized: the API stores WebP at a display size and a
 * thumbnail, and Cloudinary transforms on its own URL. Those are fetched directly,
 * which also keeps the Next optimizer away from private-network hosts it refuses to
 * touch. Genuinely external files do go through the optimizer, because hotlinking
 * them from the browser is rate limited and blocked by opaque-response rules.
 */
function isOurs(media: MediaItem): boolean {
  return media.provider === "LOCAL" || media.provider === "CLOUDINARY";
}

export function PlaceImage({ media, alt, className, sizes = "100vw", priority, thumb, mode = "box" }: Props) {
  if (!media || media.kind !== "IMAGE") {
    return <span className={clsx("block bg-surface-2", mode === "inset" && "absolute inset-0", className)} aria-hidden />;
  }
  const src = thumb && media.thumbnailUrl ? media.thumbnailUrl : media.url;
  const unoptimized = isOurs(media);

  if (mode === "flow") {
    return (
      <Image
        src={src}
        alt={alt}
        width={media.width ?? 1600}
        height={media.height ?? 1067}
        sizes={sizes}
        priority={priority}
        unoptimized={unoptimized}
        className={clsx("h-auto w-full bg-surface-2", className)}
      />
    );
  }

  return (
    <span className={clsx("block overflow-hidden bg-surface-2", mode === "inset" ? "absolute inset-0" : "relative", className)}>
      <Image src={src} alt={alt} fill sizes={sizes} priority={priority} unoptimized={unoptimized} className="object-cover" />
    </span>
  );
}
