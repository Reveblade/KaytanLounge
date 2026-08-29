"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { clsx } from "clsx";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";

/**
 * A snap carousel: the track is a real scroller, so touch and trackpad keep working
 * untouched and the cards stay server-rendered children. The arrows and the position
 * rail are the only chrome — measured off the scroller rather than tracked in an
 * index, so a mid-drag stop still reports the truth.
 *
 * Scroll position is painted onto the rail with a transform, not React state.
 * A setState on every `scroll` event pulled the swipe off the compositor and
 * onto the main thread, which is what made the route cards hitch.
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
}

const EPSILON = 2;

interface Dims {
  padLeft: number;
  max: number;
  thumbPx: number;
  travel: number;
}

export function Carousel({ children, header, label, prevLabel, nextLabel, trackClassName }: CarouselProps) {
  const track = useRef<HTMLDivElement>(null);
  const thumb = useRef<HTMLSpanElement>(null);
  const prevBtn = useRef<HTMLButtonElement>(null);
  const nextBtn = useRef<HTMLButtonElement>(null);
  const dims = useRef<Dims>({ padLeft: 0, max: 0, thumbPx: 0, travel: 0 });
  const [overflowing, setOverflowing] = useState(false);

  const paint = () => {
    const el = track.current;
    if (!el) return;
    const { padLeft, max, thumbPx, travel } = dims.current;
    const x = max > 0 ? (el.scrollLeft / max) * travel : 0;
    if (thumb.current) {
      thumb.current.style.width = `${thumbPx}px`;
      thumb.current.style.transform = `translate3d(${x}px, 0, 0)`;
    }
    if (prevBtn.current) prevBtn.current.disabled = el.scrollLeft <= padLeft + EPSILON;
    if (nextBtn.current) nextBtn.current.disabled = el.scrollLeft >= max - EPSILON;
  };

  const measure = () => {
    const el = track.current;
    if (!el) return;
    const clientWidth = el.clientWidth;
    const scrollWidth = el.scrollWidth;
    const max = Math.max(0, scrollWidth - clientWidth);
    const thumbPx = scrollWidth > 0 ? Math.max(12, (clientWidth / scrollWidth) * clientWidth) : clientWidth;
    dims.current = {
      padLeft: Number.parseFloat(getComputedStyle(el).paddingLeft) || 0,
      max,
      thumbPx,
      travel: Math.max(0, clientWidth - thumbPx),
    };
    const next = max > EPSILON;
    setOverflowing((prev) => (prev === next ? prev : next));
    paint();
  };

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    measure();
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        paint();
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    /** Catches both the viewport resizing and children arriving or changing width. */
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    for (const child of Array.from(el.children)) ro.observe(child);
    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
    // The track is mounted once; children flow in as slots.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    if (overflowing) paint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overflowing]);

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

  return (
    <>
      <div className="mx-auto flex max-w-[1440px] items-end justify-between gap-8 px-5 sm:px-8">
        {header}
        {overflowing ? (
          <div className="hidden shrink-0 gap-2 md:flex">
            <button ref={prevBtn} type="button" onClick={() => page(-1)} disabled className="btn btn-glass btn-icon" aria-label={prevLabel}>
              <CaretLeft size={18} weight="bold" />
            </button>
            <button ref={nextBtn} type="button" onClick={() => page(1)} className="btn btn-glass btn-icon" aria-label={nextLabel}>
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
        className={clsx("no-scrollbar flex snap-x snap-mandatory overflow-x-auto", trackClassName)}
      >
        {children}
      </div>

      {overflowing ? (
        <div className="mx-auto max-w-[1440px] px-5 sm:px-8" aria-hidden>
          <div className="relative h-px w-full overflow-hidden rounded-pill bg-line">
            <span ref={thumb} className="absolute inset-y-0 left-0 rounded-pill bg-ink-muted will-change-transform" />
          </div>
        </div>
      ) : null}
    </>
  );
}
