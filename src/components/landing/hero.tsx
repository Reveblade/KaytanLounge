import Link from "next/link";
import { ArrowRight, CalendarBlank } from "@phosphor-icons/react/dist/ssr";
import type { RouteDetailDto } from "@/lib/contract/api";
import { fareFrom, formatDateTime, formatDuration, formatMoney } from "@/lib/format";
import { pickText } from "@/lib/i18n/pick";
import type { Dictionary, UiLocale } from "@/lib/i18n/dictionaries";
import { PlaceImage } from "@/components/media/place-image";
import { Reveal } from "@/components/motion/reveal";
import { HeroMap } from "./hero-map";

/**
 * The first viewport is the product: a living map of the featured route, pitched and
 * slowly turning behind the headline. On the right, one glass card — the route the map
 * is drawing — so the frosted surface has something real to sit on.
 */
export function Hero({ t, route, locale }: { t: Dictionary; route: RouteDetailDto | null; locale: UiLocale }) {
  const nodes = (route?.nodes ?? []).map((n) => ({
    id: `${n.kind}:${n.refId}`,
    order: n.order,
    kind: n.kind,
    location: n.place.location,
    label: pickText(n.place.name, locale),
  }));
  const next = route?.tours[0];
  const priceFrom = next ? fareFrom(next.pricing) : null;

  return (
    <section className="relative min-h-[100dvh] overflow-hidden bg-bg">
      <div id="header-sentinel" className="absolute top-0 h-px w-full" aria-hidden />
      <HeroMap path={route?.path} nodes={nodes} />
      <div className="pointer-events-none absolute inset-0 hidden md:block scrim-l" aria-hidden />
      <div className="pointer-events-none absolute inset-0 md:hidden scrim-b" aria-hidden />

      <div className="relative mx-auto flex min-h-[100dvh] max-w-[1440px] flex-col justify-end px-5 pb-12 pt-[44vh] sm:px-8 md:flex-row md:items-end md:justify-between md:pb-16 md:pt-28">
        <div className="max-w-[640px]">
          <p className="label rise mb-5 text-ink-muted">{t.hero.eyebrow}</p>
          <h1 className="display-xl rise text-ink">{t.hero.title}</h1>
          <p className="lede rise rise-2 mt-6">{t.hero.lede}</p>
          <div className="rise rise-3 mt-9 flex flex-wrap gap-3">
            <Link href="/explore" className="btn btn-primary btn-lg">
              {t.hero.cta} <ArrowRight size={18} weight="bold" />
            </Link>
            <a href="#day" className="btn btn-glass btn-lg">
              {t.hero.secondary}
            </a>
          </div>
          <ul className="rise rise-4 mt-10 flex flex-wrap gap-2">
            {t.hero.points.map((point) => (
              <li key={point} className="stat">
                <span className="h-1.5 w-1.5 rounded-pill bg-accent" aria-hidden />
                {point}
              </li>
            ))}
          </ul>
        </div>

        {route ? (
          <Reveal above className="mt-10 hidden w-full max-w-[380px] md:block">
            <Link href={`/explore?route=${route.slug}`} className="glass group block overflow-hidden rounded-panel p-2 transition-transform duration-500 ease-out-quint hover:-translate-y-1">
              <div className="relative aspect-[16/10] overflow-hidden rounded-[18px]">
                <PlaceImage media={route.cover} alt={pickText(route.name, locale)} mode="inset" className="transition-transform duration-700 ease-out-quint group-hover:scale-[1.04]" sizes="380px" />
                <span className="absolute left-3 top-3 rounded-pill bg-[rgba(8,9,13,0.55)] px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-white backdrop-blur-md">
                  {t.hero.featured}
                </span>
              </div>
              <div className="px-3 pb-3 pt-4">
                <p className="text-xs text-ink-faint">{t.explore.theme[route.theme]}</p>
                <p className="display-sm mt-0.5">{pickText(route.name, locale)}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <span className="stat">{route.nodes.length} {t.explore.stops}</span>
                  <span className="stat">{formatDuration(route.durationMinutes, locale)}</span>
                  {priceFrom !== null && next ? <span className="stat">{t.explore.from} {formatMoney(priceFrom, next.pricing.currency, locale)}</span> : null}
                </div>
                <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3">
                  {next ? (
                    <span className="flex items-center gap-2 text-sm text-ink-muted tnum">
                      <CalendarBlank size={16} weight="regular" /> {formatDateTime(next.startsAt, locale)}
                    </span>
                  ) : (
                    <span className="text-sm text-ink-faint">{t.explore.noDeparturesShort}</span>
                  )}
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-ink">
                    {t.hero.openRoute} <ArrowRight size={16} weight="bold" className="transition-transform duration-300 group-hover:translate-x-0.5" />
                  </span>
                </div>
              </div>
            </Link>
          </Reveal>
        ) : null}
      </div>
    </section>
  );
}
