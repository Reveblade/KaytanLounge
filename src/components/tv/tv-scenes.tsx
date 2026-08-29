"use client";

import type { CSSProperties } from "react";
import { clsx } from "clsx";
import type { AttractionDto, BusinessDto, MediaItem, RouteCardDto, RouteDetailDto, TourDetailDto } from "@/lib/contract/api";
import { clockAt, formatDuration, formatMoney, languageName } from "@/lib/format";
import { pickText } from "@/lib/i18n/pick";
import type { Dictionary, UiLocale } from "@/lib/i18n/dictionaries";
import { TRACKS } from "@/lib/music";
import { SeatMapView } from "@/components/booking/seat-map";
import { PlaceImage } from "@/components/media/place-image";
import { InstagramReel } from "./instagram-reel";

export type SceneId = "open" | "routes" | "day" | "map" | "places" | "partners" | "company" | "book" | "music" | "close";

export interface TvData {
  routes: RouteCardDto[];
  featured: RouteDetailDto | null;
  tour: TourDetailDto | null;
  highlights: AttractionDto[];
  titleSponsor: BusinessDto | null;
  host: string;
}

export function Scene({
  id,
  beat,
  data,
  t,
  locale,
}: {
  id: SceneId;
  beat: number;
  data: TvData;
  t: Dictionary;
  locale: UiLocale;
}) {
  switch (id) {
    case "open":
      return <Open t={t} />;
    case "routes":
      return <Routes t={t} locale={locale} routes={data.routes} />;
    case "day":
      return data.featured ? <Day t={t} locale={locale} route={data.featured} beat={beat} /> : null;
    case "map":
      return <MapBeat t={t} locale={locale} route={data.featured} beat={beat} />;
    case "places":
      return <Places t={t} locale={locale} places={data.highlights} />;
    case "partners":
      return data.titleSponsor ? <Partners t={t} locale={locale} title={data.titleSponsor} /> : null;
    case "company":
      return <Company t={t} locale={locale} tour={data.tour} beat={beat} />;
    case "book":
      return <Book t={t} locale={locale} route={data.featured} beat={beat} />;
    case "music":
      return <Music t={t} locale={locale} />;
    case "close":
      return <Close t={t} host={data.host} />;
  }
}

function Open({ t }: { t: Dictionary }) {
  return (
    <div className="absolute inset-0 flex flex-col justify-end px-8 pb-[12vh] sm:px-14 md:px-20">
      <div className="pointer-events-none absolute inset-0 hidden md:block scrim-l" aria-hidden />
      <div className="pointer-events-none absolute inset-0 md:hidden scrim-b" aria-hidden />
      <p className="label tv-rise">{t.hero.eyebrow}</p>
      <h1 className="tv-rise tv-d1 mt-5 font-script leading-none text-[clamp(2.6rem,8vw,6.4rem)] text-ink">Başka İstanbul Yok</h1>
      <p className="lede tv-rise tv-d2 mt-6">{t.hero.lede}</p>
      <ul className="tv-rise tv-d3 mt-10 flex flex-wrap gap-2">
        {t.hero.points.map((point) => (
          <li key={point} className="stat">
            <span className="h-1.5 w-1.5 rounded-pill bg-accent" aria-hidden />
            {point}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Routes({ t, locale, routes }: { t: Dictionary; locale: UiLocale; routes: RouteCardDto[] }) {
  return (
    <div className="absolute inset-0 flex flex-col justify-end pb-[10vh]">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[rgba(8,9,13,0.88)] via-[rgba(8,9,13,0.35)] to-transparent" aria-hidden />
      <div className="relative px-8 sm:px-14 md:px-20">
        <p className="label tv-rise">{t.nav.routes}</p>
        <h2 className="display-lg tv-rise tv-d1 mt-3 max-w-[18ch]">{t.landing.routesTitle}</h2>
        <p className="lede tv-rise tv-d2 mt-4">{t.landing.routesLede}</p>
      </div>
      <div className="relative mt-10 overflow-hidden">
        <div
          className="tv-film flex gap-4 px-8 sm:px-14 md:px-20"
          style={{ "--tv-film-end": `-${Math.max(0, routes.length - 2.2) * 22}vw` } as CSSProperties}
        >
          {routes.map((route, i) => (
            <article key={route.id} className="relative h-[42vh] w-[min(72vw,340px)] shrink-0 overflow-hidden rounded-panel">
              <Still media={route.cover} alt={pickText(route.name, locale)} />
              <div className="absolute inset-0 bg-gradient-to-t from-[rgba(8,9,13,0.7)] via-transparent to-transparent" aria-hidden />
              <span className="glass-frost absolute left-4 top-4 rounded-pill px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-white">
                {t.explore.theme[route.theme]}
              </span>
              <div className="glass-frost absolute inset-x-3 bottom-3 rounded-[20px] p-4 text-white">
                <h3 className="display-sm">{pickText(route.name, locale)}</h3>
                <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8rem] text-white/75 tnum">
                  <span>
                    {route.nodeCount} {t.explore.stops}
                  </span>
                  <span className="h-1 w-1 rounded-pill bg-white/40" aria-hidden />
                  <span>{formatDuration(route.durationMinutes, locale)}</span>
                  {route.priceFrom ? (
                    <>
                      <span className="h-1 w-1 rounded-pill bg-white/40" aria-hidden />
                      <span className="font-semibold text-white">
                        {t.explore.from} {formatMoney(route.priceFrom.amount, route.priceFrom.currency, locale)}
                      </span>
                    </>
                  ) : null}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

function Day({ t, locale, route, beat }: { t: Dictionary; locale: UiLocale; route: RouteDetailDto; beat: number }) {
  const nodes = route.nodes;
  const active = Math.min(nodes.length - 1, Math.floor(beat * Math.max(nodes.length, 1)));
  const node = nodes[active];
  const start = route.tours[0]?.startsAt ?? new Date(new Date().setHours(9, 0, 0, 0)).toISOString();
  if (!node) return null;
  return (
    <div className="absolute inset-0 grid md:grid-cols-12">
      <Still media={node.place.media[0]} alt={pickText(node.place.name, locale)} />
      <div className="absolute inset-0 bg-gradient-to-r from-[rgba(8,9,13,0.88)] via-[rgba(8,9,13,0.45)] to-[rgba(8,9,13,0.12)]" aria-hidden />
      <div className="relative col-span-5 flex flex-col justify-end px-8 py-[12vh] sm:px-14 md:px-16">
        <p className="label tv-rise">{t.landing.dayTitle}</p>
        <h2 className="display-lg tv-rise tv-d1 mt-3">{pickText(route.name, locale)}</h2>
        <div className="tv-rise tv-d2 mt-4 flex flex-wrap gap-1.5">
          <span className="stat">
            {route.nodes.length} {t.explore.stops}
          </span>
          <span className="stat">{formatDuration(route.durationMinutes, locale)}</span>
          <span className="stat">{t.explore.pace[route.pace]}</span>
        </div>
        <p className="tv-rise tv-d3 mt-10 font-semibold tracking-[-0.04em] text-accent tnum text-[clamp(2.4rem,5vw,4.2rem)]">
          {clockAt(start, node.arrivalOffsetMinutes, locale)}
        </p>
        <p className="display-md tv-rise tv-d3 mt-1">{pickText(node.place.name, locale)}</p>
        <p className="tv-rise tv-d4 mt-3 max-w-[36ch] text-ink-muted">{pickText(node.place.summary, locale)}</p>
      </div>
      <ol className="relative col-span-7 hidden flex-col justify-end gap-1 px-10 py-[12vh] md:flex">
        {visibleStops(nodes, active).map(({ node: n, index: i }) => (
          <li
            key={`${n.kind}:${n.refId}`}
            className={clsx(
              "grid grid-cols-[4.5rem_1fr] items-baseline gap-5 rounded-card px-4 py-2.5 transition-colors duration-500",
              i === active ? "bg-white/10" : "opacity-40",
            )}
          >
            <span className="text-lg font-semibold tnum">{clockAt(start, n.arrivalOffsetMinutes, locale)}</span>
            <span className="display-sm truncate">{pickText(n.place.name, locale)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function MapBeat({ t, locale, route, beat }: { t: Dictionary; locale: UiLocale; route: RouteDetailDto | null; beat: number }) {
  const nodes = route?.nodes ?? [];
  const shown = Math.min(nodes.length, Math.max(1, Math.ceil(beat * nodes.length)));
  return (
    <div className="absolute inset-0 flex flex-col justify-between px-8 py-[12vh] sm:px-14 md:px-20">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[rgba(8,9,13,0.72)] via-transparent to-[rgba(8,9,13,0.35)]" aria-hidden />
      <div className="relative max-w-[640px]">
        <p className="label tv-rise">{t.common.map}</p>
        <h2 className="display-lg tv-rise tv-d1 mt-3">{t.tv.mapTitle}</h2>
        <p className="lede tv-rise tv-d2 mt-4">{t.explore.allPlacesLede}</p>
      </div>
      {nodes.length ? (
        <ul className="relative flex flex-wrap gap-2">
          {nodes.slice(0, shown).map((n, i) => (
            <li key={`${n.kind}:${n.refId}`} className="stat tv-rise" style={{ animationDelay: `${i * 60}ms` }}>
              <span className="grid h-5 w-5 place-items-center rounded-pill bg-accent text-[0.65rem] font-semibold text-on-accent tnum">
                {i + 1}
              </span>
              {pickText(n.place.name, locale)}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Places({ t, locale, places }: { t: Dictionary; locale: UiLocale; places: AttractionDto[] }) {
  const wall = places.slice(0, 5);
  return (
    <div className="absolute inset-0">
      <div className="absolute inset-0 grid grid-cols-4 grid-rows-2 gap-2 p-2 sm:gap-3 sm:p-3">
        {wall.map((place, i) => (
          <figure
            key={place.id}
            className={clsx("relative overflow-hidden rounded-card", i === 0 && "col-span-2 row-span-2")}
          >
            <Still media={place.media[0]} alt={pickText(place.name, locale)} />
            <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[rgba(8,9,13,0.7)] to-transparent px-3 pb-3 pt-10">
              <p className="title text-[0.95rem] text-white">{pickText(place.name, locale)}</p>
              <p className="text-xs text-white/65">
                {t.explore.types[place.type]} · {place.district}
              </p>
            </figcaption>
          </figure>
        ))}
      </div>
      <div className="absolute left-8 top-8 max-w-[28ch] text-white sm:left-14 sm:top-12 [text-shadow:0_12px_32px_rgba(0,0,0,0.7)]">
        <p className="label label-on-dark tv-rise">{t.nav.places}</p>
        <h2 className="display-lg tv-rise tv-d1 mt-2">{t.landing.placesTitle}</h2>
      </div>
    </div>
  );
}

function Partners({ t, locale, title }: { t: Dictionary; locale: UiLocale; title: BusinessDto }) {
  return (
    <div className="absolute inset-0">
      <Still media={title.media[0]} alt={pickText(title.name, locale)} priority />
      <div className="absolute inset-0 bg-gradient-to-r from-[rgba(8,9,13,0.9)] via-[rgba(8,9,13,0.45)] to-[rgba(8,9,13,0.18)]" aria-hidden />
      <div className="relative grid h-full md:grid-cols-12">
        <div className="relative z-10 col-span-7 flex flex-col justify-end px-8 pb-[12vh] sm:px-14 md:px-16 lg:px-20">
          <h2 className="display-lg tv-rise max-w-[16ch] text-white">{t.landing.sponsorTitle}</h2>
          <p className="tv-rise tv-d1 mt-5 max-w-[46ch] text-lg leading-relaxed text-white/80">{t.landing.sponsorBody}</p>
        </div>
        <div className="pointer-events-none absolute inset-y-[7vh] right-4 z-10 flex items-center sm:right-8 md:relative md:inset-auto md:col-span-5 md:justify-center md:pr-10 lg:pr-16">
          <InstagramReel />
        </div>
      </div>
    </div>
  );
}

function Company({ t, locale, tour, beat }: { t: Dictionary; locale: UiLocale; tour: TourDetailDto | null; beat: number }) {
  const guide = tour?.guide;
  const vehicle = tour?.vehicle;
  const labels = vehicle?.seatMap.cells.filter((c) => c.kind === "SEAT" && c.label).map((c) => c.label!) ?? [];
  const lit = Math.max(1, Math.min(labels.length, 2 + Math.floor(beat * 3)));
  const selected = labels.slice(2, 2 + lit);
  return (
    <div className="absolute inset-0 flex flex-col px-6 pb-[8vh] pt-[5.5rem] sm:px-10">
      <div className="pointer-events-none absolute inset-0 bg-[rgba(8,9,13,0.28)]" aria-hidden />
      <div className="relative shrink-0">
        <p className="label tv-rise">{t.explore.guide} · {t.explore.vehicle}</p>
        <h2 className="display-lg tv-rise tv-d1 mt-2 max-w-[16ch]">{t.landing.fleetTitle}</h2>
      </div>
      <div className="relative mt-5 grid min-h-0 flex-1 gap-3 md:grid-cols-12 md:grid-rows-2">
        <div className="relative min-h-[180px] overflow-hidden rounded-panel md:col-span-7 md:row-span-2">
          {vehicle?.media[0] ? (
            <Still media={vehicle.media[0]} alt={vehicle.name} />
          ) : (
            <div className="absolute inset-0 bg-[#101218]">
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "radial-gradient(90% 80% at 80% 10%, rgba(255,160,122,0.2), transparent 55%), radial-gradient(70% 60% at 10% 90%, rgba(255,255,255,0.08), transparent 50%)",
                }}
              />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[rgba(8,9,13,0.65)] via-transparent to-transparent" aria-hidden />
          <div className="glass-frost absolute inset-x-4 bottom-4 rounded-[22px] p-5 text-white sm:p-6">
            <p className="label label-on-dark">{t.explore.vehicle}</p>
            <p className="display-md mt-1">{vehicle?.name ?? t.landing.fleetVehicles}</p>
            {vehicle ? (
              <p className="mt-2 text-sm text-white/75">
                {t.tour.vehicleTypes[vehicle.type]} · {vehicle.seatCount} {t.common.seats.toLowerCase()}
              </p>
            ) : null}
          </div>
        </div>

        <div className="relative min-h-[140px] overflow-hidden rounded-panel md:col-span-5">
          {guide?.photo ? (
            <Still media={guide.photo} alt={guide.displayName} />
          ) : (
            <div className="absolute inset-0 bg-[#101218]">
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "radial-gradient(120% 90% at 18% 12%, rgba(255,160,122,0.28), transparent 60%), radial-gradient(90% 70% at 88% 8%, rgba(255,255,255,0.10), transparent 55%)",
                }}
              />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[rgba(8,9,13,0.6)] to-transparent" aria-hidden />
          <div className="glass-frost absolute inset-x-3 bottom-3 rounded-[20px] p-4 text-white">
            <p className="label label-on-dark">{t.explore.guide}</p>
            <p className="display-sm mt-1">{guide?.displayName ?? t.landing.fleetTitle}</p>
            <p className="mt-1 text-sm text-white/80">
              {guide
                ? `${guide.languages.map((l) => languageName(l, locale)).join(", ")}${guide.yearsExperience ? ` · ${guide.yearsExperience} ${t.explore.experience}` : ""}`
                : t.landing.fleetGuides}
            </p>
          </div>
        </div>

        <div className="glass-card flex min-h-0 flex-col justify-between overflow-hidden rounded-panel p-5 md:col-span-5">
          <div>
            <p className="label">{t.booking.step1}</p>
            <p className="display-sm mt-1">{t.landing.fleetSeats}</p>
          </div>
          {vehicle ? (
            <div className="mt-4 overflow-x-auto">
              <SeatMapView
                seatMap={vehicle.seatMap}
                selected={selected}
                unavailable={tour?.unavailableSeats}
                compact
                labels={{ driver: t.booking.driver, guide: t.booking.guideSeat }}
              />
            </div>
          ) : (
            <p className="mt-4 text-sm text-ink-muted">{t.landing.fleetVehicles}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Book({ t, locale, route, beat }: { t: Dictionary; locale: UiLocale; route: RouteDetailDto | null; beat: number }) {
  const steps = [
    { key: "seats", title: t.booking.steps.seats, hint: t.booking.seatsStepHint },
    { key: "passengers", title: t.booking.steps.passengers, hint: t.booking.passengersStepHint },
    { key: "payment", title: t.booking.steps.payment, hint: t.booking.payStepHint },
  ] as const;
  return (
    <div className="absolute inset-0 flex flex-col justify-center px-8 sm:px-14 md:px-20">
      <div className="pointer-events-none absolute inset-0 bg-[rgba(8,9,13,0.55)]" aria-hidden />
      <div className="relative">
        <p className="label tv-rise">{t.booking.title}</p>
        <h2 className="display-lg tv-rise tv-d1 mt-3 max-w-[18ch]">{t.tv.bookTitle}</h2>
        <p className="lede tv-rise tv-d2 mt-4">{t.login.lede}</p>
        <ol className="mt-12 grid gap-4 md:grid-cols-3">
          {steps.map((step, i) => (
            <li key={step.key} className="glass-card tv-rise rounded-panel p-6" style={{ animationDelay: `${180 + i * 120}ms` }}>
              <span className="grid h-8 w-8 place-items-center rounded-pill bg-accent-soft text-sm font-semibold text-accent tnum">
                {i + 1}
              </span>
              <p className="display-sm mt-4">{step.title}</p>
              <p className="mt-2 text-sm text-ink-muted">{step.hint}</p>
            </li>
          ))}
        </ol>
        {beat > 0.55 && route ? (
          <div className="glass tv-rise mt-8 flex max-w-[520px] items-center gap-4 rounded-panel p-3">
            <span className="relative h-16 w-24 shrink-0 overflow-hidden rounded-card">
              <PlaceImage media={route.cover} alt={pickText(route.name, locale)} mode="inset" sizes="96px" thumb />
            </span>
            <span>
              <span className="label">{t.ticket.title}</span>
              <span className="display-sm mt-0.5 block">{t.tv.ticketTitle}</span>
              <span className="mt-1 block text-sm text-ink-muted">{t.ticket.showAtBoarding}</span>
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Music({ t, locale }: { t: Dictionary; locale: UiLocale }) {
  return (
    <div className="absolute inset-0 flex flex-col justify-center px-8 sm:px-14 md:px-20">
      <div className="pointer-events-none absolute inset-0 bg-[rgba(8,9,13,0.5)]" aria-hidden />
      <div className="relative grid items-center gap-12 md:grid-cols-12">
        <div className="md:col-span-6">
          <span className="player-art tv-rise grid h-28 w-28 place-items-center rounded-panel border border-line">
            <span className="eq h-10 w-8" data-on="true" aria-hidden>
              <i />
              <i />
              <i />
              <i />
              <i />
            </span>
          </span>
          <p className="label tv-rise tv-d1 mt-8">{t.music.title}</p>
          <h2 className="display-lg tv-rise tv-d2 mt-3">{t.music.lede}</h2>
          <p className="lede tv-rise tv-d3 mt-4">{t.music.trackCount}</p>
        </div>
        <ol className="md:col-span-6">
          {TRACKS.map((track, i) => (
            <li
              key={track.id}
              className="tv-rise flex items-baseline justify-between gap-4 border-b border-line py-3.5"
              style={{ animationDelay: `${160 + i * 70}ms` }}
            >
              <span>
                <span className="block font-semibold tracking-[-0.01em]">{track.title}</span>
                <span className="block text-sm text-ink-faint">{track.note[locale]}</span>
              </span>
              <span className="text-xs tnum text-ink-faint">{i + 1}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function Close({ t, host }: { t: Dictionary; host: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-start justify-end px-8 pb-[14vh] sm:px-14 md:px-20">
      <div className="pointer-events-none absolute inset-0 hidden md:block scrim-l" aria-hidden />
      <div className="pointer-events-none absolute inset-0 md:hidden scrim-b" aria-hidden />
      <p className="tv-rise font-script leading-none text-[clamp(2.6rem,8vw,6.4rem)] text-ink">Başka İstanbul Yok</p>
      <p className="lede tv-rise tv-d1 mt-5">{t.tv.closeCta}</p>
      {host ? <p className="tv-rise tv-d2 mt-6 text-2xl font-semibold tracking-[-0.03em] text-accent sm:text-3xl">{host}</p> : null}
      <div className="tv-rise tv-d3 mt-8 flex flex-wrap gap-2">
        <span className="stat">{t.tv.langs}</span>
        <span className="stat">{t.theme.dark}</span>
        <span className="stat">{t.theme.light}</span>
        <span className="stat">{t.nav.explore}</span>
      </div>
    </div>
  );
}

function visibleStops<T>(nodes: T[], active: number): { node: T; index: number }[] {
  const cap = 7;
  if (nodes.length <= cap) return nodes.map((node, index) => ({ node, index }));
  const start = Math.max(0, Math.min(active - 3, nodes.length - cap));
  return nodes.slice(start, start + cap).map((node, i) => ({ node, index: start + i }));
}

function Still({
  media,
  alt,
  priority,
}: {
  media?: MediaItem;
  alt: string;
  priority?: boolean;
}) {
  return (
    <span className="absolute inset-0 overflow-hidden bg-[#101218]">
      <PlaceImage media={media} alt={alt} mode="inset" sizes="100vw" priority={priority} />
    </span>
  );
}
