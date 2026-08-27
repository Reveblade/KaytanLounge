"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, CaretDown, Check, MapPin } from "@phosphor-icons/react";
import type { RouteDetailDto } from "@/lib/contract/api";
import { clockAt, fareFrom, formatDuration, formatMoney, kmLabel } from "@/lib/format";
import { useI18n } from "@/lib/i18n/context";
import { PlaceImage } from "@/components/media/place-image";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";

interface Props {
  route: RouteDetailDto | null;
  loading: boolean;
  activeNode: string | null;
  onSelectNode: (id: string) => void;
  emptyLabel: string;
}

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * The route, read top to bottom: what it is, why, then the stops in order. Deciding
 * is not in here — it is the bar below, which never scrolls away, so the reading
 * never competes with the booking.
 */
export function RoutePanel({ route, loading, activeNode, onSelectNode, emptyLabel }: Props) {
  const { t, locale, pick, pickList } = useI18n();
  const reduce = useReducedMotion();
  const [expanded, setExpanded] = useState(false);

  if (loading || !route) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex-1 overflow-hidden p-6">
          {loading ? <PanelSkeleton /> : <p className="text-ink-muted">{emptyLabel}</p>}
        </div>
      </div>
    );
  }

  const start = route.tours[0]?.startsAt ?? new Date(new Date().setHours(9, 0, 0, 0)).toISOString();
  const description = pick(route.description);
  const highlights = pickList(route.highlights);

  return (
    <div className="flex h-full flex-col">
      <div className="no-scrollbar flex-1 overflow-y-auto overscroll-contain">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={route.slug}
            initial={reduce ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -8, transition: { duration: 0.18 } }}
            transition={{ duration: 0.5, ease: EASE }}
          >
            {/* Identity */}
            <div className="px-6 pt-6">
              <p className="label">{t.explore.theme[route.theme]}</p>
              <h1 className="display-md mt-1.5 text-balance">{pick(route.name)}</h1>
              <div className="mt-4 flex flex-wrap gap-1.5">
                <span className="stat">{route.nodes.length} {t.explore.stops}</span>
                <span className="stat">{formatDuration(route.durationMinutes, locale)}</span>
                <span className="stat">{kmLabel(route.distanceKm)}</span>
                <span className="stat">{t.explore.pace[route.pace]}</span>
              </div>
            </div>

            {/* Words */}
            <div className="px-6 pt-6">
              <p className="text-[1.02rem] leading-relaxed text-ink">{pick(route.tagline)}</p>
              <p className={clsx("mt-3 text-[0.925rem] leading-relaxed text-ink-muted whitespace-pre-line", !expanded && "line-clamp-4")}>{description}</p>
              {description.length > 260 ? (
                <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-ink transition-colors hover:text-accent" aria-expanded={expanded}>
                  {expanded ? t.common.close : t.explore.readMore}
                  <CaretDown size={14} weight="bold" className={clsx("transition-transform duration-300", expanded && "rotate-180")} />
                </button>
              ) : null}
              {highlights.length ? (
                <ul className="mt-5 grid gap-2">
                  {highlights.map((h) => (
                    <li key={h} className="flex items-start gap-2.5 text-[0.9rem] text-ink">
                      <span className="mt-[3px] grid h-4 w-4 shrink-0 place-items-center rounded-pill bg-accent-soft text-accent">
                        <Check size={10} weight="bold" />
                      </span>
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            {/* Stops */}
            <div className="px-4 pb-6 pt-8">
              <p className="label mb-3 px-2">{t.explore.stopsTitle}</p>
              <ol className="stagger-now relative" style={{ "--stagger": "0.04s" } as React.CSSProperties}>
                <span className="absolute bottom-6 left-[27px] top-6 w-px bg-line" aria-hidden />
                {route.nodes.map((node) => {
                  const id = `${node.kind}:${node.refId}`;
                  const active = id === activeNode;
                  const media = node.place.media[0];
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        onClick={() => onSelectNode(id)}
                        className={clsx(
                          "group relative flex w-full items-center gap-3 rounded-card p-2 text-left transition-colors duration-200",
                          active ? "glass-soft" : "hover:bg-ink/5",
                        )}
                        aria-current={active ? "true" : undefined}
                      >
                        <span
                          className={clsx(
                            "relative z-[1] grid h-7 w-7 shrink-0 place-items-center rounded-pill border text-[0.78rem] font-semibold tnum transition-colors duration-200",
                            active ? "border-accent bg-accent text-on-accent shadow-[0_0_0_4px_var(--accent-soft)]" : "border-line-strong bg-surface text-ink group-hover:border-ink",
                          )}
                        >
                          {node.order + 1}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="title block truncate text-[0.95rem]">{pick(node.place.name)}</span>
                          <span className="mt-0.5 block text-xs text-ink-muted tnum">
                            {clockAt(start, node.arrivalOffsetMinutes, locale)} · {formatDuration(node.stayMinutes, locale)}
                            {node.kind === "BUSINESS" ? ` · ${t.explore.partnerVenue}` : ""}
                          </span>
                        </span>
                        {media ? (
                          <PlaceImage media={media} alt="" className="h-12 w-16 shrink-0 rounded-[12px]" sizes="64px" thumb />
                        ) : (
                          <span className="glass-soft grid h-12 w-16 shrink-0 place-items-center rounded-[12px] text-ink-faint" aria-hidden>
                            <MapPin size={18} weight="regular" />
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/**
 * Deciding, on the edge the panel never scrolls away: the price to beat and the one
 * button that opens the departures. The drawer keeps it on the bottom of the screen at
 * every height, so the phone reaches it without opening the panel at all.
 */
export function DecideBar({ route, onOpenDepartures }: { route: RouteDetailDto; onOpenDepartures: () => void }) {
  const { t, locale } = useI18n();
  const fares = route.tours.map((tour) => fareFrom(tour.pricing)).filter((fare): fare is number => fare !== null);
  const priceFrom = fares.length ? Math.min(...fares) : null;
  const currency = route.tours[0]?.pricing.currency;

  return (
    <div className="glass-strong rounded-b-[inherit] border-t border-line px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 lg:pb-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs text-ink-faint">{t.explore.likeIt}</p>
          {route.tours.length && priceFrom !== null && currency ? (
            <p className="mt-0.5 truncate text-sm font-medium tnum">
              {t.explore.from} <span className="text-[1.05rem] font-semibold">{formatMoney(priceFrom, currency, locale)}</span>
              <span className="text-ink-muted"> · {route.tours.length} {t.explore.upcoming}</span>
            </p>
          ) : (
            <p className="mt-0.5 text-sm text-ink-muted">{t.explore.noDeparturesShort}</p>
          )}
        </div>
        <button type="button" onClick={onOpenDepartures} disabled={!route.tours.length} className="btn btn-accent shrink-0">
          {t.explore.seeDepartures} <ArrowRight size={16} weight="bold" />
        </button>
      </div>
    </div>
  );
}

function PanelSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true">
      <Skeleton className="h-3 w-20 rounded-pill" />
      <Skeleton className="h-9 w-4/5" />
      <div className="flex gap-2">
        <Skeleton className="h-7 w-20 rounded-pill" />
        <Skeleton className="h-7 w-24 rounded-pill" />
        <Skeleton className="h-7 w-16 rounded-pill" />
      </div>
      <SkeletonText lines={4} className="pt-2" />
      <div className="space-y-3 pt-4">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-7 w-7 rounded-pill" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-2/3 rounded-pill" />
              <Skeleton className="h-3 w-1/3 rounded-pill" />
            </div>
            <Skeleton className="h-12 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
