"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { clsx } from "clsx";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";

/**
 * A snap carousel: the track is a real scroller, so touch and trackpad keep working
 * untouched and the cards stay server-rendered children. The arrows and the position
 * rail are the only client state — measured off the scroller rather than tracked in
 * an index, so a mid-drag stop still reports the truth.
 *
 * Arrows are pointer affordances and hidden on touch-first widths, where the swipe
 * plus the rail already say "there is more".
 */

interface CarouselProps {
  children: ReactNode;
  /** Sits left of the arrows, in the same padded container — usually a heading block. */
  header?: ReactNode;
  /** Names the scrollable region for assistive tech. */
  label: string;
  prevLabel: string;
  nextLabel: string;
  /** Extra classes for the scrolling track (padding, gap, item sizing). */
  trackClassName?: string;
  /** Seconds between children entering, matching `Stagger`. */
  gap?: number;
}

interface Metrics {
  scrollLeft: number;
  clientWidth: number;
  scrollWidth: number;
  /**
   * Mandatory snap parks the first card flush against the scrollport, so the
   * resting scrollLeft is the track's own left padding rather than zero. Without
   * this the back arrow would never read as spent.
   */
  padLeft: number;
}

const EPSILON = 2;

export function Carousel({ children, header, label, prevLabel, nextLabel, trackClassName, gap = 0.06 }: CarouselProps) {
  const track = useRef<HTMLDivElement>(null);
  const [{ scrollLeft, clientWidth, scrollWidth, padLeft }, setMetrics] = useState<Metrics>({ scrollLeft: 0, clientWidth: 0, scrollWidth: 0, padLeft: 0 });

  const sync = useCallback(() => {
    const el = track.current;
    if (!el) return;
    setMetrics({
      scrollLeft: el.scrollLeft,
      clientWidth: el.clientWidth,
      scrollWidth: el.scrollWidth,
      padLeft: Number.parseFloat(getComputedStyle(el).paddingLeft) || 0,
    });
  }, []);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    sync();
    el.addEventListener("scroll", sync, { passive: true });
    /** Catches both the viewport resizing and children arriving or changing width. */
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    for (const child of Array.from(el.children)) ro.observe(child);
    return () => {
      el.removeEventListener("scroll", sync);
      ro.disconnect();
    };
  }, [sync]);

  const max = Math.max(0, scrollWidth - clientWidth);
  const overflowing = max > EPSILON;
  const atStart = scrollLeft <= padLeft + EPSILON;
  const atEnd = scrollLeft >= max - EPSILON;

  const page = (direction: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    const first = el.firstElementChild as HTMLElement | null;
    const columnGap = Number.parseFloat(getComputedStyle(el).columnGap) || 0;
    const card = first ? first.offsetWidth + columnGap : 0;
    /** Move a whole viewport where the cards divide into one, otherwise a single card. */
    const distance = card > 0 ? Math.max(card, Math.floor(el.clientWidth / card) * card) : el.clientWidth * 0.85;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: distance * direction, behavior: reduce ? "auto" : "smooth" });
  };

  /** Scrollbar-like thumb: as wide a share of the rail as the viewport is of the track. */
  const thumbWidth = scrollWidth > 0 ? Math.max(12, (clientWidth / scrollWidth) * 100) : 100;
  const thumbLeft = max > 0 ? (scrollLeft / max) * (100 - thumbWidth) : 0;

  return (
    <>
      <div className="mx-auto flex max-w-[1440px] items-end justify-between gap-8 px-5 sm:px-8">
        {header}
        {overflowing ? (
          <div className="hidden shrink-0 gap-2 md:flex">
            <button type="button" onClick={() => page(-1)} disabled={atStart} className="btn btn-glass btn-icon" aria-label={prevLabel}>
              <CaretLeft size={18} weight="bold" />
            </button>
            <button type="button" onClick={() => page(1)} disabled={atEnd} className="btn btn-glass btn-icon" aria-label={nextLabel}>
              <CaretRight size={18} weight="bold" />
            </button>
          </div>
        ) : null}
      </div>

      <div
        ref={track}
        role="region"
        aria-label={label}
        tabIndex={0}
        className={clsx("no-scrollbar stagger flex snap-x snap-mandatory overflow-x-auto", trackClassName)}
        style={{ "--stagger": `${gap}s`, "--stagger-view": `${Math.round(gap * 60)}%` } as CSSProperties}
      >
        {children}
      </div>

      {overflowing ? (
        <div className="mx-auto max-w-[1440px] px-5 sm:px-8" aria-hidden>
          <div className="relative h-px w-full overflow-hidden rounded-pill bg-line">
            <span
              className="absolute inset-y-0 rounded-pill bg-ink-muted transition-[left,width] duration-300 ease-out-quint"
              style={{ width: `${thumbWidth}%`, left: `${thumbLeft}%` }}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
