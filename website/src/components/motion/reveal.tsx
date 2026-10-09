import { clsx } from "clsx";
import type { CSSProperties, ReactNode } from "react";

/**
 * Entrance motion, shared by every page — and deliberately CSS-only.
 *
 * Content is visible by default; browsers that support scroll-driven animations
 * (`animation-timeline: view()`) rise and unblur each block as it enters the
 * viewport, everything else simply shows it. Nothing here can leave a page hidden
 * if a script fails, and none of it needs a client boundary. Reduced-motion users
 * get no animation at all (see globals.css).
 *
 * Nothing here animates on load. Arriving is the page's own motion — one fade on
 * <main>, see `.page-in` — and a per-block cascade layered on top of it is what made
 * a landed page look like it was still rendering. `above` marks a block that starts
 * in view, so it renders settled instead of waiting for a scroll that already happened.
 *
 * The `.stagger-now` class still exists for UI that genuinely mounts later — a panel
 * opening mid-session — where a staggered entrance is the point rather than a second
 * page load.
 */

type Tag = "div" | "section" | "li" | "p" | "span" | "article" | "header" | "footer" | "ul" | "ol";

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** This block starts in the viewport: render it settled, with no scroll animation. */
  above?: boolean;
  as?: Tag;
}

/** One element that rises and unblurs when it first scrolls into view. */
export function Reveal({ children, className, above, as = "div" }: RevealProps) {
  const Tag = as;
  return <Tag className={clsx(!above && "reveal", className)}>{children}</Tag>;
}

interface StaggerProps {
  children: ReactNode;
  className?: string;
  /** This group starts in the viewport: render it settled, with no scroll animation. */
  above?: boolean;
  as?: Tag;
  /** Extra scroll offset per child. */
  gap?: number;
}

/** A container whose direct children rise one after another as they scroll into view. */
export function Stagger({ children, className, above, as = "div", gap = 0.07 }: StaggerProps) {
  const Tag = as;
  if (above) return <Tag className={className}>{children}</Tag>;
  return (
    <Tag className={clsx("stagger", className)} style={{ "--stagger-view": `${Math.round(gap * 60)}%` } as CSSProperties}>
      {children}
    </Tag>
  );
}

/** A child of `Stagger`. Kept as a component so call sites read the same as before. */
export function Item({ children, className, as = "div" }: { children: ReactNode; className?: string; as?: Tag }) {
  const Tag = as;
  return <Tag className={className}>{children}</Tag>;
}
