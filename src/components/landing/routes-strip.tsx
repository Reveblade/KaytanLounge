import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import type { RouteCardDto } from "@/lib/contract/api";
import { formatDuration, formatMoney } from "@/lib/format";
import { pickText } from "@/lib/i18n/pick";
import type { Dictionary, UiLocale } from "@/lib/i18n/dictionaries";
import { PlaceImage } from "@/components/media/place-image";
import { Item, Reveal } from "@/components/motion/reveal";
import { Carousel } from "@/components/ui/carousel";

/** Every route as a tall photographic card with a solid caption plate; the row breathes past the right edge. */
export function RoutesStrip({ t, locale, routes }: { t: Dictionary; locale: UiLocale; routes: RouteCardDto[] }) {
  if (!routes.length) return null;
  return (
    <section className="py-24 sm:py-32">
      <Carousel
        label={t.landing.routesTitle}
        prevLabel={t.common.previous}
        nextLabel={t.common.next}
        trackClassName="mt-12 pb-6 scroll-px-5 sm:scroll-px-8 lg:scroll-px-[max(2rem,calc((100vw-1440px)/2+2rem))]"
        railClassName="gap-4 px-5 sm:gap-5 sm:px-8 lg:px-[max(2rem,calc((100vw-1440px)/2+2rem))]"
        header={
          <Reveal>
            <h2 className="display-lg max-w-[18ch]">{t.landing.routesTitle}</h2>
            <p className="lede mt-4">{t.landing.routesLede}</p>
          </Reveal>
        }
      >
        {routes.map((route, i) => (
          <Item key={route.id} className="w-[78vw] shrink-0 snap-start sm:w-[360px]">
            <Link
              href={`/explore?route=${route.slug}`}
              className="group relative block overflow-hidden rounded-panel bg-surface-2 transition-transform duration-500 ease-out-quint hover:-translate-y-1"
              style={{ aspectRatio: "4 / 5" }}
            >
              <PlaceImage media={route.cover} alt={pickText(route.name, locale)} mode="inset" className="transition-transform duration-700 ease-out-quint group-hover:scale-[1.05]" sizes="(min-width: 640px) 360px, 78vw" priority={i < 2} thumb />
              <div className="absolute inset-0 bg-gradient-to-t from-[rgba(8,9,13,0.55)] via-transparent to-transparent" aria-hidden />
              <span className="photo-chip absolute left-4 top-4 rounded-pill px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-white">
                {t.explore.theme[route.theme]}
              </span>
              <div className="photo-plate absolute inset-x-3 bottom-3 rounded-[20px] p-4 text-white">
                <h3 className="display-sm">{pickText(route.name, locale)}</h3>
                <p className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8rem] text-white/75 tnum">
                  <span>{route.nodeCount} {t.explore.stops}</span>
                  <span className="h-1 w-1 rounded-pill bg-white/40" aria-hidden />
                  <span>{formatDuration(route.durationMinutes, locale)}</span>
                  {route.priceFrom ? (
                    <>
                      <span className="h-1 w-1 rounded-pill bg-white/40" aria-hidden />
                      <span className="font-semibold text-white">{t.explore.from} {formatMoney(route.priceFrom.amount, route.priceFrom.currency, locale)}</span>
                    </>
                  ) : null}
                </p>
              </div>
            </Link>
          </Item>
        ))}
        <Item className="w-[60vw] shrink-0 snap-start sm:w-[220px]">
          <Link href="/explore" className="glass-card flex h-full items-center justify-center rounded-panel text-ink-muted hover:text-ink" style={{ aspectRatio: "4 / 5" }}>
            <span className="inline-flex items-center gap-2 font-medium">
              {t.landing.seeAll} <ArrowRight size={18} weight="bold" />
            </span>
          </Link>
        </Item>
      </Carousel>
    </section>
  );
}
