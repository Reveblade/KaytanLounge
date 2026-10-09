"use client";

import { useState, type ComponentType, type ReactNode } from "react";
import { clsx } from "clsx";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Armchair,
  Bus,
  CalendarBlank,
  Certificate,
  Check,
  Clock,
  Gauge,
  MapPin,
  MapTrifold,
  Path,
  Phone,
  Sparkle,
  Translate,
  UserFocus,
  WhatsappLogo,
  X,
} from "@phosphor-icons/react";
import type { AttractionDto, BusinessDto, TourDetailDto } from "@/lib/contract/api";
import { formatDate, formatDuration, formatMoney, formatTime, kmLabel, languageName } from "@/lib/format";
import { useI18n } from "@/lib/i18n/context";
import { Avatar } from "@/components/media/avatar";
import { PlaceImage } from "@/components/media/place-image";
import { StaticMap } from "@/components/map/static-map";
import { SeatMapView } from "./seat-map";

export type TourTab = "tour" | "vehicle" | "guide";

type IconType = ComponentType<{ size?: number; weight?: "regular" | "bold" | "fill"; className?: string }>;

const TABS: { key: TourTab; Icon: IconType }[] = [
  { key: "tour", Icon: MapTrifold },
  { key: "vehicle", Icon: Bus },
  { key: "guide", Icon: UserFocus },
];

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Everything there is to know about a departure, filed rather than stacked: the day,
 * the vehicle and the guide each get a tab, so the page opens on the answer most
 * people came for and the rest stays one click away instead of one long scroll.
 */
export function TourTabs({ tour, meetingPlace }: { tour: TourDetailDto; meetingPlace?: AttractionDto | BusinessDto | null }) {
  const { t } = useI18n();
  const reduce = useReducedMotion();
  const [tab, setTab] = useState<TourTab>("tour");

  return (
    <div className="lg:grid lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:gap-7">
      <div
        role="tablist"
        aria-label={t.tour.tabs.tour}
        className="rail no-scrollbar -mx-5 overflow-x-auto px-5 pb-1 sm:-mx-8 sm:px-8 lg:mx-0 lg:overflow-visible lg:px-0 lg:pb-0"
      >
        {TABS.map(({ key, Icon }) => (
          <button
            key={key}
            type="button"
            role="tab"
            id={`tourtab-${key}`}
            aria-controls={`tourpanel-${key}`}
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className="rail-item"
          >
            <Icon size={18} weight="regular" className="shrink-0 lg:mt-px" />
            <span>
              {t.tour.tabs[key]}
              <span className="rail-item-hint">{t.tour.tabHints[key]}</span>
            </span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          id={`tourpanel-${tab}`}
          role="tabpanel"
          aria-labelledby={`tourtab-${tab}`}
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? undefined : { opacity: 0, y: -6, transition: { duration: 0.15 } }}
          transition={{ duration: 0.38, ease: EASE }}
          className="glass-soft mt-5 rounded-panel p-5 sm:p-7 lg:mt-0"
        >
          {tab === "tour" ? <TourPanel tour={tour} meetingPlace={meetingPlace} /> : tab === "vehicle" ? <VehiclePanel tour={tour} /> : <GuidePanel tour={tour} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* -------------------------------------------------------------------------- tour */

function TourPanel({ tour, meetingPlace }: { tour: TourDetailDto; meetingPlace?: AttractionDto | BusinessDto | null }) {
  const { t, locale, pick, pickList } = useI18n();
  const highlights = pickList(tour.route.highlights);
  const included = pickList(tour.inclusions);
  const excluded = pickList(tour.exclusions);
  const minutes = tour.durationMinutes ?? tour.route.durationMinutes;
  const meetingName = pick(tour.meetingPoint.name);

  return (
    <div>
      <Section title={t.tour.about}>
        <p className="text-[1.05rem] leading-relaxed text-ink">{pick(tour.route.tagline)}</p>
        <Prose text={pick(tour.route.description)} className="mt-3" />
      </Section>

      {highlights.length ? (
        <Section title={t.tour.highlights}>
          <ul className="grid gap-2 sm:grid-cols-2">
            {highlights.map((line) => (
              <li key={line} className="flex items-start gap-2.5 text-[0.95rem] leading-snug">
                <Sparkle size={15} weight="fill" className="mt-[3px] shrink-0 text-accent" />
                {line}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section title={t.tour.atAGlance}>
        <dl className="grid grid-cols-2 gap-x-6 sm:grid-cols-3">
          <Fact
            icon={CalendarBlank}
            label={t.tour.departure}
            value={`${formatDate(tour.startsAt, locale, { weekday: "short" })} · ${formatTime(tour.startsAt, locale)}`}
          />
          <Fact icon={Clock} label={t.tour.endsAt} value={formatTime(tour.endsAt, locale)} />
          <Fact icon={Clock} label={t.tour.onTheRoad} value={formatDuration(minutes, locale)} />
          <Fact icon={Path} label={t.tour.distance} value={kmLabel(tour.route.distanceKm)} />
          <Fact icon={MapPin} label={t.tour.stops} value={String(tour.route.nodes.length)} />
          <Fact icon={Gauge} label={t.tour.pace} value={t.explore.pace[tour.route.pace]} />
          <Fact icon={Translate} label={t.tour.guidedIn} value={tour.languages.map((l) => languageName(l, locale)).join(", ")} />
        </dl>
      </Section>

      <Section title={t.tour.meetingPoint}>
        <div className="overflow-hidden rounded-card border border-line">
          <StaticMap location={tour.meetingPoint.location} label={meetingName} place={meetingPlace} className="h-44 w-full" />
          <div className="border-t border-line bg-glass-soft p-4">
            <p className="font-medium">{meetingName}</p>
            {tour.meetingPoint.address ? <p className="mt-1 text-sm text-ink-muted">{tour.meetingPoint.address}</p> : null}
            {pick(tour.meetingPoint.instructions) ? <p className="mt-2 text-sm text-ink-muted">{pick(tour.meetingPoint.instructions)}</p> : null}
          </div>
        </div>
      </Section>

      <Section title={t.tour.fares}>
        <ul className="text-[0.95rem]">
          {tour.pricing.tiers.map((tier) => (
            <li key={tier.key} className="flex items-baseline justify-between border-b border-line py-2.5 last:border-0">
              <span className="text-ink-muted">{pick(tier.label) || t.booking.tiers[tier.key]}</span>
              <span className="font-medium tnum">{formatMoney(tier.amount, tour.pricing.currency, locale)}</span>
            </li>
          ))}
          {tour.pricing.premiumSeatSurcharge ? (
            <li className="flex items-baseline justify-between pt-2.5 text-sm text-ink-faint">
              <span>{t.tour.frontRow}</span>
              <span className="tnum">+{formatMoney(tour.pricing.premiumSeatSurcharge, tour.pricing.currency, locale)}</span>
            </li>
          ) : null}
        </ul>
      </Section>

      {included.length ? (
        <Section title={t.tour.included}>
          <div className="grid gap-6 sm:grid-cols-2">
            <TickList items={included} tone="in" />
            {excluded.length ? (
              <div>
                <p className="label mb-2">{t.tour.excluded}</p>
                <TickList items={excluded} tone="out" />
              </div>
            ) : null}
          </div>
        </Section>
      ) : null}

      {pick(tour.cancellationPolicy) ? (
        <Section title={t.tour.cancellation}>
          <p className="text-[0.95rem] leading-relaxed text-ink-muted">{pick(tour.cancellationPolicy)}</p>
        </Section>
      ) : null}

      <Section title={t.tour.questions}>
        <div className="flex flex-wrap gap-2">
          <a href={`tel:${tour.contactPhone.replace(/\s/g, "")}`} className="btn btn-glass btn-sm">
            <Phone size={16} weight="bold" /> {tour.contactPhone}
          </a>
          {tour.whatsapp ? (
            <a href={`https://wa.me/${tour.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="btn btn-glass btn-sm">
              <WhatsappLogo size={16} weight="bold" /> {t.tour.whatsapp}
            </a>
          ) : null}
        </div>
      </Section>
    </div>
  );
}

/* ----------------------------------------------------------------------- vehicle */

function VehiclePanel({ tour }: { tour: TourDetailDto }) {
  const { t, pick } = useI18n();
  const { vehicle } = tour;
  const images = vehicle.media.filter((m) => m.kind === "IMAGE");
  const spec = [vehicle.make, vehicle.model, vehicle.year ? String(vehicle.year) : undefined].filter(Boolean).join(" ");

  return (
    <div>
      {images.length ? (
        <div className="mb-6 space-y-2">
          <PlaceImage media={images[0]} alt={vehicle.name} className="aspect-[16/9] w-full rounded-card" sizes="(min-width: 1024px) 560px, 100vw" />
          {images.length > 1 ? (
            <div className="no-scrollbar flex gap-2 overflow-x-auto">
              {images.slice(1).map((m) => (
                <PlaceImage key={m.url} media={m} alt={vehicle.name} className="h-20 w-32 shrink-0 rounded-[12px]" sizes="128px" thumb />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <p className="display-sm">{vehicle.name}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className="stat">{t.tour.vehicleTypes[vehicle.type]}</span>
        <span className="stat">
          <Armchair size={13} weight="regular" /> {vehicle.seatCount} {t.tour.seats}
        </span>
        {spec ? <span className="stat">{spec}</span> : null}
        {vehicle.plate ? (
          <span className="stat">
            {t.tour.plate} {vehicle.plate}
          </span>
        ) : null}
      </div>

      {pick(vehicle.description) ? (
        <Section title={t.tour.vehicleAbout}>
          <Prose text={pick(vehicle.description)} />
        </Section>
      ) : null}

      {vehicle.amenities.length ? (
        <Section title={t.tour.onBoard}>
          <ul className="flex flex-wrap gap-1.5">
            {vehicle.amenities.map((a) => (
              <li key={a} className="stat">
                <Check size={12} weight="bold" className="text-accent" /> {a}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section title={t.tour.seatPlan}>
        <div className="overflow-x-auto rounded-card border border-line p-4">
          <SeatMapView seatMap={vehicle.seatMap} unavailable={tour.unavailableSeats} compact labels={{ driver: t.booking.driver, guide: t.booking.guideSeat }} />
        </div>
        <p className="mt-2.5 text-sm text-ink-faint">{t.tour.seatPlanHint}</p>
      </Section>
    </div>
  );
}

/* ------------------------------------------------------------------------- guide */

function GuidePanel({ tour }: { tour: TourDetailDto }) {
  const { t, locale, pick } = useI18n();
  const { guide } = tour;

  return (
    <div>
      <div className="flex items-center gap-4">
        <Avatar media={guide.photo} name={guide.displayName} className="h-20 w-20 shrink-0 text-xl" sizes="80px" />
        <div className="min-w-0">
          <p className="display-sm truncate">{guide.displayName}</p>
          {guide.yearsExperience ? (
            <p className="mt-1 text-sm text-ink-muted tnum">
              {guide.yearsExperience} {t.tour.yearsGuiding}
            </p>
          ) : null}
        </div>
      </div>

      {pick(guide.bio) ? (
        <Section title={t.tour.guideBio}>
          <Prose text={pick(guide.bio)} />
        </Section>
      ) : null}

      <Section title={t.tour.speaks}>
        <ul className="flex flex-wrap gap-1.5">
          {guide.languages.map((l) => (
            <li key={l} className="stat">
              <Translate size={13} weight="regular" /> {languageName(l, locale)}
            </li>
          ))}
        </ul>
      </Section>

      {guide.specialties.length ? (
        <Section title={t.tour.specialises}>
          <ul className="flex flex-wrap gap-1.5">
            {guide.specialties.map((s) => (
              <li key={s} className="stat">
                {s}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {guide.licenseNo ? (
        <Section title={t.tour.licence}>
          <p className="flex items-center gap-2 text-[0.95rem] text-ink-muted tnum">
            <Certificate size={16} weight="regular" className="text-accent" />
            {guide.licenseNo}
          </p>
        </Section>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------------- parts */

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-7 first:mt-0">
      <h3 className="label mb-3">{title}</h3>
      {children}
    </section>
  );
}

/** Author-written copy: blank lines are paragraph breaks, nothing else is markup. */
function Prose({ text, className }: { text: string; className?: string }) {
  return (
    <div className={clsx("space-y-3 text-[0.98rem] leading-[1.7] text-ink-muted", className)}>
      {text.split(/\n\s*\n/).map((paragraph, i) => (
        <p key={i}>{paragraph}</p>
      ))}
    </div>
  );
}

function Fact({ icon: Icon, label, value }: { icon: IconType; label: string; value: string }) {
  return (
    <div className="border-b border-line py-3">
      <dt className="flex items-center gap-1.5 text-xs text-ink-faint">
        <Icon size={13} weight="regular" />
        {label}
      </dt>
      <dd className="mt-1 text-[0.95rem] font-medium tnum">{value}</dd>
    </div>
  );
}

function TickList({ items, tone }: { items: string[]; tone: "in" | "out" }) {
  if (!items.length) return null;
  const Icon = tone === "in" ? Check : X;
  return (
    <ul className="space-y-1.5 text-[0.95rem]">
      {items.map((line) => (
        <li key={line} className="flex items-start gap-2.5 leading-snug">
          <Icon size={14} weight="bold" className={clsx("mt-[3px] shrink-0", tone === "in" ? "text-success" : "text-ink-faint")} />
          <span className={tone === "in" ? undefined : "text-ink-muted"}>{line}</span>
        </li>
      ))}
    </ul>
  );
}
