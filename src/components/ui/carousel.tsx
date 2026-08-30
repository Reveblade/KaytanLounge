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
 * Padding lives on the inner rail, not on the scroller. Padding on an overflow
 * box plus `scroll-snap-type: mandatory` is why Chromium would advance a card
 * and then refuse to snap back to the first one — the first snap target sits
 * inside the scroller's own padding and is treated as unreachable.
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
  /** Extra classes for the scrolling viewport (margin, scroll-padding). */
  trackClassName?: string;
  /** Extra classes for the inner flex rail (gap, padding). */
  railClassName?: string;
}

const EPSILON = 2;

interface Dims {
  padLeft: number;
  max: number;
  thumbPx: number;
  travel: number;
}

export function Carousel({ children, header, label, prevLabel, nextLabel, trackClassName, railClassName }: CarouselProps) {
  const track = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  const thumb = useRef<HTMLSpanElement>(null);
  const prevBtn = useRef<HTMLButtonElement>(null);
  const nextBtn = useRef<HTMLButtonElement>(null);
  const dims = useRef<Dims>({ padLeft: 0, max: 0, thumbPx: 0, travel: 0 });
  const [overflowing, setOverflowing] = useState(false);

  const paint = () => {
    const el = track.current;
    if (!el) return;
    const { max, thumbPx, travel } = dims.current;
    const x = max > 0 ? (el.scrollLeft / max) * travel : 0;
    if (thumb.current) {
      thumb.current.style.width = `${thumbPx}px`;
      thumb.current.style.transform = `translate3d(${x}px, 0, 0)`;
    }
    if (prevBtn.current) prevBtn.current.disabled = el.scrollLeft <= EPSILON;
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
      padLeft: Number.parseFloat(getComputedStyle(el).scrollPaddingLeft) || 0,
      max,
      thumbPx,
      travel: Math.max(0, clientWidth - thumbPx),
    };
    const next = max > EPSILON;
    setOverflowing((prev) => (prev === next ? prev : next));
    paint();
  };

  const page = (direction: 1 | -1) => {
    const el = track.current;
    const railEl = rail.current;
    if (!el || !railEl) return;
    const cards = Array.from(railEl.children) as HTMLElement[];
    if (!cards.length) return;
    const pad = dims.current.padLeft;
    let index = 0;
    let nearest = Infinity;
    for (let i = 0; i < cards.length; i++) {
      const distance = Math.abs(el.scrollLeft - (cards[i].offsetLeft - pad));
      if (distance < nearest) {
        nearest = distance;
        index = i;
      }
    }
    const gap = Number.parseFloat(getComputedStyle(railEl).columnGap) || 0;
    const card = cards[0].offsetWidth + gap;
    const step = card > 0 ? Math.max(1, Math.floor(el.clientWidth / card)) : 1;
    const next = Math.max(0, Math.min(cards.length - 1, index + step * direction));
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ left: Math.max(0, cards[next].offsetLeft - pad), behavior: reduce ? "auto" : "smooth" });
  };

  useEffect(() => {
    const el = track.current;
    const railEl = rail.current;
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
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        page(-1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        page(1);
      }
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("keydown", onKey);
    /** Catches both the viewport resizing and children arriving or changing width. */
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (railEl) {
      ro.observe(railEl);
      for (const child of Array.from(railEl.children)) ro.observe(child);
    }
    return () => {
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("keydown", onKey);
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

  return (
    <>
      <div className="mx-auto flex max-w-[1440px] items-end justify-between gap-8 px-5 sm:px-8">
        {header}
        {overflowing ? (
          <div className="hidden shrink-0 gap-2 md:flex">
            <button ref={prevBtn} type="button" onClick={() => page(-1)} className="btn btn-glass btn-icon" aria-label={prevLabel}>
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
        className={clsx("no-scrollbar snap-x snap-proximity overflow-x-auto overscroll-x-contain", trackClassName)}
      >
        <div ref={rail} className={clsx("flex w-max", railClassName)}>
          {children}
        </div>
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
