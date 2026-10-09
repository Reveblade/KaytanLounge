"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CaretDown, Check, MapTrifold } from "@phosphor-icons/react";
import type { RouteCardDto } from "@/lib/contract/api";
import { formatDuration, formatMoney } from "@/lib/format";
import { useI18n } from "@/lib/i18n/context";
import { PlaceImage } from "@/components/media/place-image";

interface Props {
  cards: RouteCardDto[];
  activeSlug: string | null;
  overview: boolean;
  loadingSlug: string | null;
  onSelectRoute: (slug: string) => void;
  onSelectOverview: () => void;
  /** The list needs room to drop into: on a phone, opening it opens the drawer. */
  onOpenChange?: (open: boolean) => void;
}

/**
 * The route picker at the top of the reading panel. One button shows what the map
 * is drawing; opening it lists every route (and the all-places overview) as rows
 * with a cover, stops, duration and starting price, so choosing a day is one tap
 * without leaving the panel.
 */
export function RouteSwitcher({ cards, activeSlug, overview, loadingSlug, onSelectRoute, onSelectOverview, onOpenChange }: Props) {
  const { t, locale, pick } = useI18n();
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = cards.find((c) => c.slug === activeSlug) ?? null;

  const change = useCallback(
    (next: boolean) => {
      setOpen(next);
      onOpenChange?.(next);
    },
    [onOpenChange],
  );

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) change(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && change(false);
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, change]);

  return (
    <div ref={ref} className="relative min-w-0 flex-1">
      <button
        type="button"
        onClick={() => change(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={clsx("glass-soft flex w-full items-center gap-3 rounded-card p-2 pr-3 text-left transition-colors duration-200 hover:border-line-strong", open && "border-line-strong")}
      >
        {overview || !active ? (
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] bg-accent-soft text-accent">
            <MapTrifold size={20} weight="bold" />
          </span>
        ) : (
          <PlaceImage media={active.cover} alt="" className="h-11 w-11 shrink-0 rounded-[12px]" sizes="44px" thumb />
        )}
        <span className="min-w-0 flex-1">
          <span className="label block">{overview || !active ? t.explore.allPlaces : t.explore.theme[active.theme]}</span>
          <span className="title mt-0.5 block truncate text-[0.98rem]">{overview || !active ? t.explore.allPlacesTitle : pick(active.name)}</span>
        </span>
        <CaretDown size={16} weight="bold" className={clsx("shrink-0 text-ink-muted transition-transform duration-300", open && "rotate-180")} />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            role="listbox"
            aria-label={t.explore.routes}
            initial={reduce ? false : { opacity: 0, y: -6, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.985, transition: { duration: 0.14 } }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="glass-strong absolute inset-x-0 top-[calc(100%+8px)] z-30 max-h-[min(60dvh,560px)] origin-top overflow-y-auto rounded-card p-1.5"
          >
            <button
              type="button"
              role="option"
              aria-selected={overview}
              onClick={() => {
                onSelectOverview();
                change(false);
              }}
              className={clsx("flex w-full items-center gap-3 rounded-[14px] p-2 text-left transition-colors hover:bg-ink/6", overview && "bg-ink/6")}
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] bg-accent-soft text-accent">
                <MapTrifold size={20} weight="bold" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="title block text-[0.95rem]">{t.explore.allPlacesChip}</span>
                <span className="block truncate text-xs text-ink-muted">{t.explore.allPlacesLede}</span>
              </span>
              {overview ? <Check size={16} weight="bold" className="mr-1 shrink-0 text-accent" /> : null}
            </button>
            <span className="my-1.5 block h-px bg-line" aria-hidden />
            <ul className="space-y-0.5">
              {cards.map((card) => {
                const current = !overview && card.slug === activeSlug;
                const loading = card.slug === loadingSlug;
                return (
                  <li key={card.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={current}
                      onClick={() => {
                        onSelectRoute(card.slug);
                        change(false);
                      }}
                      className={clsx("flex w-full items-center gap-3 rounded-[14px] p-2 text-left transition-colors hover:bg-ink/6", current && "bg-ink/6")}
                    >
                      <PlaceImage media={card.cover} alt="" className="h-11 w-11 shrink-0 rounded-[12px]" sizes="44px" thumb />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-ink-faint">{t.explore.theme[card.theme]}</span>
                        <span className="title block truncate text-[0.95rem]">{pick(card.name)}</span>
                        <span className="block truncate text-xs text-ink-muted tnum">
                          {card.nodeCount} {t.explore.stops} · {formatDuration(card.durationMinutes, locale)}
                          {card.priceFrom ? ` · ${t.explore.from} ${formatMoney(card.priceFrom.amount, card.priceFrom.currency, locale)}` : ""}
                        </span>
                      </span>
                      {loading ? <span className="mr-1 h-2 w-2 shrink-0 animate-pulse rounded-pill bg-accent" /> : current ? <Check size={16} weight="bold" className="mr-1 shrink-0 text-accent" /> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
