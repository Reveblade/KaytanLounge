"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { clsx } from "clsx";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";

/** Where the drawer rests: the picker alone, half the screen, or as much as the map can spare. */
export type Snap = "peek" | "half" | "full";

const SNAPS: Snap[] = ["peek", "half", "full"];
const EASE = [0.22, 1, 0.36, 1] as const;
/** The strip of map the drawer never takes, so the floating chrome stays clear of it. */
const HEADROOM = 96;

interface Props {
  /** Desktop draws a column; the phone draws a drawer. */
  wide: boolean;
  /** Desktop only: the column slides off to the left. */
  collapsed: boolean;
  snap: Snap;
  onSnapChange: (snap: Snap) => void;
  /**
   * Reported whenever the drawer settles: its own height, and how much of the map's
   * bottom the camera should treat as taken. The map keeps its pins above the drawer,
   * and the map's controls ride on top of it.
   */
  onSettle?: (metrics: { height: number; mapInset: number }) => void;
  handleLabel: string;
  brand: ReactNode;
  switcher: ReactNode;
  /** The decide bar. It sits on the bottom edge and is never scrolled away. */
  footer?: ReactNode;
  children: ReactNode;
}

interface Drag {
  id: number;
  startY: number;
  startH: number;
  lastY: number;
  lastT: number;
  v: number;
  moved: boolean;
}

/** Resistance past the first and the last snap, so the ends feel like ends rather than walls. */
const rubber = (over: number) => Math.min(64, over * 0.34);
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * The reading panel, in the two shapes it takes.
 *
 * Wide: a column pinned to the left of the map, which collapses out of the way.
 *
 * Phone: a drawer on the bottom edge, dragged between three heights. It is sized
 * rather than translated — the picker and the decide bar keep the two edges at every
 * height, and the body between them is a real scroll viewport, so a half-open drawer
 * scrolls the half you can see instead of a screenful you cannot. Releasing throws it
 * to the nearest snap and the flick is carried into that decision; a tap on the handle
 * drops it to the picker, or opens it all the way.
 */
export function ReadingSheet({ wide, collapsed, snap, onSnapChange, onSettle, handleLabel, brand, switcher, footer, children }: Props) {
  const reduce = useReducedMotion();
  const height = useMotionValue(0);
  // Until the drawer has measured itself it renders at the height the stylesheet would
  // have given it, so the server, the first paint and the first snap all agree.
  const cssHeight = useTransform(height, (v) => (v > 0 ? `${Math.round(v)}px` : "52dvh"));
  const headRef = useRef<HTMLDivElement>(null);
  const footRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const dragged = useRef(false);
  const settled = useRef(-1);
  const [vh, setVh] = useState(0);
  const [peek, setPeek] = useState(0);
  /** Nothing moves until the drawer knows the viewport and its own fixed rows. */
  const ready = !wide && vh > 0 && peek > 0;

  // The viewport, measured rather than assumed: a phone's toolbars change it mid-session.
  useEffect(() => {
    if (wide) return;
    const el = document.documentElement;
    const apply = () => setVh(el.clientHeight);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [wide]);

  // The smallest the drawer goes is the rows that never leave: handle, picker, decide bar.
  useEffect(() => {
    if (wide) return;
    const apply = () => setPeek((headRef.current?.offsetHeight ?? 0) + (footRef.current?.offsetHeight ?? 0));
    apply();
    const ro = new ResizeObserver(apply);
    if (headRef.current) ro.observe(headRef.current);
    if (footRef.current) ro.observe(footRef.current);
    return () => ro.disconnect();
  }, [wide]);

  const snapPx = useMemo<Record<Snap, number>>(() => {
    const full = Math.max(peek, vh - HEADROOM);
    return { peek, half: clamp(Math.round(vh * 0.52), peek, full), full };
  }, [peek, vh]);

  // First measurement: land on the starting snap rather than animate into it.
  useLayoutEffect(() => {
    if (!ready || settled.current >= 0) return;
    height.set(snapPx[snap]);
    settled.current = snapPx[snap];
  }, [ready, snap, snapPx, height]);

  // The camera keeps its pins above the drawer — but never hands it two thirds of the map.
  useEffect(() => {
    if (!ready) return;
    // 44 over the drawer, not 0: a marker is pinned by its point and hangs below it.
    onSettle?.({ height: snapPx[snap], mapInset: Math.min(snapPx[snap] + 44, Math.round(vh * 0.62)) });
  }, [ready, snap, snapPx, vh, onSettle]);

  const goTo = useCallback(
    (next: Snap) => {
      settled.current = snapPx[next];
      onSnapChange(next);
      animate(height, snapPx[next], reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 44, mass: 0.9 });
    },
    [snapPx, onSnapChange, height, reduce],
  );

  // Anything that moves the drawer from outside — a new route, a turned phone — lands the same way.
  useEffect(() => {
    if (!ready || drag.current || settled.current === snapPx[snap]) return;
    goTo(snap);
  }, [ready, snap, snapPx, goTo]);

  function onPointerDown(e: ReactPointerEvent<HTMLElement>) {
    if (!ready) return;
    dragged.current = false;
    height.stop();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: e.pointerId, startY: e.clientY, startH: height.get(), lastY: e.clientY, lastT: e.timeStamp, v: 0, moved: false };
  }

  function onPointerMove(e: ReactPointerEvent<HTMLElement>) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dy = d.startY - e.clientY;
    if (Math.abs(dy) > 5) d.moved = true;
    const dt = e.timeStamp - d.lastT;
    if (dt > 0) d.v = ((d.lastY - e.clientY) / dt) * 1000;
    d.lastY = e.clientY;
    d.lastT = e.timeStamp;
    const raw = d.startH + dy;
    const { peek: min, full: max } = snapPx;
    height.set(raw < min ? min - rubber(min - raw) : raw > max ? max + rubber(raw - max) : raw);
  }

  function onPointerUp(e: ReactPointerEvent<HTMLElement>) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    dragged.current = d.moved;
    if (!d.moved) return;
    // The flick counts: the snap follows where the drawer was heading, not where the finger stopped.
    const projected = height.get() + clamp(d.v, -2400, 2400) * 0.14;
    let best: Snap = snap;
    let distance = Infinity;
    for (const candidate of SNAPS) {
      const delta = Math.abs(snapPx[candidate] - projected);
      if (delta < distance) {
        distance = delta;
        best = candidate;
      }
    }
    goTo(best);
  }

  function onHandleClick() {
    if (dragged.current) {
      dragged.current = false;
      return;
    }
    goTo(snap === "peek" ? "full" : "peek");
  }

  return (
    <motion.div
      initial={false}
      animate={wide && collapsed ? { opacity: 0, x: -24 } : { opacity: 1, x: 0 }}
      transition={{ duration: 0.35, ease: EASE }}
      /* A custom property rather than `height`, so the wide layout can still say `auto` in CSS. */
      style={{ "--sheet-h": cssHeight } as CSSProperties}
      className={clsx(
        "fixed inset-x-0 bottom-0 z-20 h-[var(--sheet-h,52dvh)]",
        "lg:absolute lg:inset-x-auto lg:bottom-5 lg:left-5 lg:top-4 lg:h-auto lg:w-[460px]",
        wide && collapsed && "pointer-events-none",
      )}
      aria-hidden={wide && collapsed}
    >
      <div className="glass-strong sheet-up flex h-full flex-col overflow-hidden rounded-t-[28px] lg:rounded-panel">
        <div ref={headRef} className="shrink-0">
          {/* The grab handle is the phone's collapse control: drag it, or tap it. */}
          <button
            type="button"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onClick={onHandleClick}
            aria-label={handleLabel}
            aria-expanded={snap !== "peek"}
            className="flex w-full touch-none select-none justify-center py-3.5 lg:hidden"
          >
            <span className="grab-handle" />
          </button>
          <div className="hidden h-14 items-center gap-1 border-b border-line pl-4 pr-2 lg:flex">{brand}</div>
          <div className="border-b border-line p-3">{switcher}</div>
        </div>
        {/* Collapsed, the body has no height: take it out of the tab order rather than
            let focus wander into a strip nobody can see. */}
        <div className="min-h-0 flex-1" inert={!wide && snap === "peek"}>
          {children}
        </div>
        <div ref={footRef} className="shrink-0">
          {footer}
        </div>
      </div>
    </motion.div>
  );
}
