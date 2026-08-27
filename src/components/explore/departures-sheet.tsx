"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { clsx } from "clsx";
import { AnimatePresence, motion, useDragControls, useReducedMotion, type PanInfo } from "motion/react";
import { ArrowRight, CaretDown, X } from "@phosphor-icons/react";
import type { RouteDetailDto, TourSummaryDto } from "@/lib/contract/api";
import { fareFrom, formatDate, formatMoney, formatTime, formatWeekday, languageName } from "@/lib/format";
import { useI18n } from "@/lib/i18n/context";
import { Avatar } from "@/components/media/avatar";
import { PlaceImage } from "@/components/media/place-image";

interface Props {
  route: RouteDetailDto | null;
  open: boolean;
  wide: boolean;
  onClose: () => void;
}

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Where a liked route becomes a booked day. Separate from the overview on purpose:
 * this sheet only lists departures — day by day, each with its guide, its vehicle,
 * its price and the seats still free — and one button per departure.
 */
export function DeparturesSheet({ route, open, wide, onClose }: Props) {
  const { t, pick } = useI18n();
  const reduce = useReducedMotion();
  const handle = useDragControls();

  /** On a phone the sheet is thrown away rather than dismissed: a flick down closes it. */
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 140 || info.velocity.y > 800) onClose();
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && route ? (
        <div key="departures" className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={t.explore.departuresTitle}>
          <motion.button
            type="button"
            aria-label={t.common.close}
            onClick={onClose}
            className="absolute inset-0 bg-[var(--scrim)] backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          />
          <motion.aside
            className={clsx(
              "glass-strong absolute flex flex-col overflow-hidden",
              wide ? "inset-y-4 right-4 w-[480px] rounded-panel" : "inset-x-0 bottom-0 max-h-[88dvh] rounded-t-[28px]",
            )}
            initial={reduce ? { opacity: 0 } : wide ? { opacity: 0, x: 40 } : { opacity: 0, y: 60 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={reduce ? { opacity: 0 } : wide ? { opacity: 0, x: 32, transition: { duration: 0.22 } } : { opacity: 0, y: 40, transition: { duration: 0.22 } }}
            transition={{ duration: 0.5, ease: EASE }}
            drag={wide ? false : "y"}
            dragControls={handle}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.7 }}
            onDragEnd={onDragEnd}
          >
            {!wide ? (
              /* Purely the drag grip: closing by keyboard is the X, which is next in the order. */
              <div onPointerDown={(e) => handle.start(e)} className="flex touch-none justify-center pt-3" aria-hidden>
                <span className="grab-handle" />
              </div>
            ) : null}
            <div className="flex items-start justify-between gap-4 border-b border-line px-6 pb-4 pt-5">
              <div className="min-w-0">
                <p className="label">{t.explore.departuresFor}</p>
                <p className="display-sm mt-1 truncate">{pick(route.name)}</p>
                <p className="mt-1 text-sm text-ink-muted">{t.explore.likeItHint}</p>
              </div>
              <button type="button" onClick={onClose} className="btn btn-glass btn-icon shrink-0" aria-label={t.common.close}>
                <X size={18} weight="bold" />
              </button>
            </div>
            <div className="no-scrollbar flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4">
              <DepartureList tours={route.tours} />
            </div>
          </motion.aside>
        </div>
      ) : null}
    </AnimatePresence>
  );
}

function DepartureList({ tours }: { tours: TourSummaryDto[] }) {
  const { t, locale } = useI18n();
  const reduce = useReducedMotion();
  const groups = useMemo(() => {
    const map = new Map<string, TourSummaryDto[]>();
    for (const tour of tours) {
      const key = formatDate(tour.startsAt, locale, { weekday: undefined });
      map.set(key, [...(map.get(key) ?? []), tour]);
    }
    return [...map.entries()];
  }, [tours, locale]);

  if (!tours.length) return <p className="px-2 py-6 text-sm text-ink-muted">{t.explore.noDepartures}</p>;

  return (
    <motion.div initial={reduce ? false : "hidden"} animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.15 } } }} className="space-y-6">
      {groups.map(([day, list]) => (
        <div key={day}>
          <motion.p variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }} className="mb-2.5 flex items-baseline gap-2 px-2">
            <span className="text-[1.05rem] font-semibold tracking-[-0.02em]">{day}</span>
            <span className="text-xs text-ink-faint">{formatWeekday(list[0].startsAt, locale)}</span>
          </motion.p>
          <div className="space-y-2.5">
            {list.map((tour) => (
              <motion.div key={tour.id} variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } } }}>
                <DepartureCard tour={tour} />
              </motion.div>
            ))}
          </div>
        </div>
      ))}
    </motion.div>
  );
}

/** The whole card is the way in: tap it to pick seats. Only the details toggle stays on the card. */
function DepartureCard({ tour }: { tour: TourSummaryDto }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const cheapest = fareFrom(tour.pricing);
  const soldOut = tour.seatsLeft <= 0;
  const scarce = !soldOut && tour.seatsLeft <= 4;
  const href = `/book/${tour.id}`;

  function go() {
    if (!soldOut) router.push(href);
  }

  return (
    <div
      role="link"
      tabIndex={soldOut ? -1 : 0}
      aria-disabled={soldOut}
      aria-label={`${formatTime(tour.startsAt, locale)} · ${tour.guide.displayName} · ${t.explore.bookNow}`}
      onClick={go}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          go();
        }
      }}
      onMouseEnter={() => !soldOut && router.prefetch(href)}
      className={clsx(
        "glass-card group relative rounded-card p-4 outline-none focus-visible:ring-2 focus-visible:ring-accent",
        soldOut ? "cursor-not-allowed opacity-70" : "cursor-pointer",
        open && "border-line-strong",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[1.6rem] font-semibold leading-none tracking-[-0.03em] tnum">{formatTime(tour.startsAt, locale)}</p>
          <p className="mt-1.5 text-xs text-ink-faint tnum">
            {t.explore.endsAt} {formatTime(tour.endsAt, locale)}
          </p>
        </div>
        <div className="text-right">
          {cheapest !== null ? (
            <>
              <p className="text-sm text-ink-muted">{t.explore.from}</p>
              <p className="text-[1.15rem] font-semibold leading-tight tracking-[-0.02em] tnum">{formatMoney(cheapest, tour.pricing.currency, locale)}</p>
            </>
          ) : null}
          <span
            className={clsx(
              "mt-1.5 inline-flex items-center gap-1.5 rounded-pill px-2 py-0.5 text-[0.72rem] font-medium tnum",
              soldOut ? "bg-danger/12 text-danger" : scarce ? "bg-warning/12 text-warning" : "bg-success/12 text-success",
            )}
          >
            <span className="h-1.5 w-1.5 rounded-pill bg-current" aria-hidden />
            {soldOut ? t.explore.soldOut : `${tour.seatsLeft} ${t.explore.seatsLeft}`}
          </span>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Avatar media={tour.guide.photo} name={tour.guide.displayName} className="h-10 w-10 shrink-0 text-sm" sizes="40px" />
        <div className="min-w-0 flex-1 text-sm">
          <p className="truncate font-medium">{tour.guide.displayName}</p>
          <p className="truncate text-xs text-ink-muted">
            {tour.languages.map((l) => languageName(l, locale)).join(", ")} · {tour.vehicle.name} · {tour.seatCount} {t.explore.vehicleSeats}
          </p>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="details"
            initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { height: "auto", opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.36, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="pt-4">
              {tour.vehicle.media[0] ? <PlaceImage media={tour.vehicle.media[0]} alt={tour.vehicle.name} className="aspect-[16/7] w-full rounded-[14px]" sizes="420px" thumb /> : null}
              <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                {tour.pricing.tiers.map((tier) => (
                  <li key={tier.key} className="flex justify-between border-b border-line py-1.5">
                    <span className="text-ink-muted">{tier.label[locale] ?? tier.label.en ?? t.booking.tiers[tier.key]}</span>
                    <span className="font-medium tnum">{formatMoney(tier.amount, tour.pricing.currency, locale)}</span>
                  </li>
                ))}
                {tour.pricing.premiumSeatSurcharge ? (
                  <li className="col-span-2 flex justify-between py-1.5 text-xs text-ink-faint">
                    <span>{t.booking.seatLegendPremium}</span>
                    <span className="tnum">+{formatMoney(tour.pricing.premiumSeatSurcharge, tour.pricing.currency, locale)}</span>
                  </li>
                ) : null}
              </ul>
              {tour.guide.yearsExperience ? (
                <p className="mt-2 text-xs text-ink-faint">
                  {tour.guide.yearsExperience} {t.explore.experience}
                </p>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpen((v) => !v);
          }}
          onKeyDown={(e) => e.stopPropagation()}
          className="btn btn-quiet btn-sm -ml-2"
          aria-expanded={open}
        >
          {open ? t.explore.hideDetails : t.explore.details}
          <CaretDown size={14} weight="bold" className={clsx("transition-transform duration-300", open && "rotate-180")} />
        </button>
        {!soldOut ? (
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink">
            {t.explore.bookNow}
            <ArrowRight size={14} weight="bold" className="transition-transform duration-300 group-hover:translate-x-0.5" />
          </span>
        ) : null}
      </div>
    </div>
  );
}
