"use client";

import { clsx } from "clsx";
import { SteeringWheel, UserFocus } from "@phosphor-icons/react";
import type { SeatMap } from "@/lib/contract/api";

interface Props {
  seatMap: SeatMap;
  unavailable?: string[];
  selected?: string[];
  onToggle?: (label: string) => void;
  /** Smaller cells for previews. */
  compact?: boolean;
  labels?: { driver: string; guide: string };
  className?: string;
}

/**
 * The vehicle plan as the customer sees it: front at the top, an aisle where the
 * operator drew one, seats as soft squares. Selected seats turn cobalt; taken seats fade.
 */
export function SeatMapView({ seatMap, unavailable = [], selected = [], onToggle, compact, labels, className }: Props) {
  const taken = new Set(unavailable);
  const chosen = new Set(selected);
  const size = compact ? "h-7 w-7 text-[10px] rounded-[8px]" : "h-10 w-10 text-[12px] rounded-[11px] sm:h-11 sm:w-11";
  const gap = compact ? "gap-1" : "gap-1.5 sm:gap-2";
  const cells = new Map(seatMap.cells.map((c) => [`${c.row}:${c.col}`, c]));

  return (
    <div className={clsx("inline-block", className)}>
      <div className={clsx("grid", gap)} style={{ gridTemplateColumns: `repeat(${seatMap.cols}, minmax(0, 1fr))` }} role={onToggle ? "group" : undefined}>
        {Array.from({ length: seatMap.rows * seatMap.cols }, (_, i) => {
          const row = Math.floor(i / seatMap.cols);
          const col = i % seatMap.cols;
          const cell = cells.get(`${row}:${col}`);
          if (!cell || cell.kind === "EMPTY" || cell.kind === "AISLE") {
            return <div key={i} className={size} aria-hidden />;
          }
          if (cell.kind === "DRIVER" || cell.kind === "GUIDE") {
            return (
              <div key={i} className={clsx(size, "grid place-items-center border border-dashed border-line-strong text-ink-faint")} title={cell.kind === "DRIVER" ? labels?.driver : labels?.guide}>
                {cell.kind === "DRIVER" ? <SteeringWheel size={compact ? 12 : 16} weight="regular" /> : <UserFocus size={compact ? 12 : 16} weight="regular" />}
              </div>
            );
          }
          if (cell.kind === "DOOR" || cell.kind === "TABLE") {
            return <div key={i} className={clsx(size, "border border-line/60")} aria-hidden />;
          }
          const label = cell.label ?? "";
          const isTaken = taken.has(label);
          const isChosen = chosen.has(label);
          return (
            <button
              key={i}
              type="button"
              disabled={isTaken || !onToggle}
              onClick={() => onToggle?.(label)}
              aria-pressed={isChosen}
              aria-label={label}
              className={clsx(
                size,
                "relative grid place-items-center border font-semibold tnum transition-all duration-200",
                isChosen
                  ? "border-accent bg-accent text-on-accent shadow-[0_8px_20px_-8px_var(--accent)]"
                  : isTaken
                    ? "cursor-not-allowed border-transparent bg-surface-2 text-ink-faint/60"
                    : cell.premium
                      ? "border-accent/60 bg-accent-soft text-ink hover:border-accent hover:-translate-y-px"
                      : "border-line-strong bg-glass-soft text-ink hover:border-ink hover:-translate-y-px",
                onToggle && !isTaken && "active:scale-95",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
