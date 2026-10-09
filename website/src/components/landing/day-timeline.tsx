import Link from "next/link";
import type { RouteDetailDto } from "@/lib/contract/api";
import { clockAt, formatDuration } from "@/lib/format";
import { pickText } from "@/lib/i18n/pick";
import type { Dictionary, UiLocale } from "@/lib/i18n/dictionaries";
import { PlaceImage } from "@/components/media/place-image";
import { Item, Reveal, Stagger } from "@/components/motion/reveal";

/**
 * One real route, hour by hour. Times come from the route's own travel and stay
 * figures, so what the page promises is what the guide drives.
 */
export function DayTimeline({ t, locale, route }: { t: Dictionary; locale: UiLocale; route: RouteDetailDto }) {
  const start = route.tours[0]?.startsAt ?? new Date(new Date().setHours(9, 0, 0, 0)).toISOString();
  return (
    <section id="day" className="scroll-mt-24 border-t border-line py-24 sm:py-32">
      <div className="mx-auto max-w-[1440px] px-5 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-12">
          <Reveal className="lg:col-span-4">
            <div className="lg:sticky lg:top-28">
              <h2 className="display-lg">{t.landing.dayTitle}</h2>
              <p className="mt-5 text-lg font-medium tracking-[-0.01em] text-ink">{pickText(route.name, locale)}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="stat">{route.nodes.length} {t.explore.stops}</span>
                <span className="stat">{formatDuration(route.durationMinutes, locale)}</span>
                <span className="stat">{t.explore.pace[route.pace]}</span>
              </div>
              <Link href={`/explore?route=${route.slug}`} className="btn btn-glass mt-8">
                {t.landing.viewRoute}
              </Link>
            </div>
          </Reveal>
          <Stagger as="ol" className="relative lg:col-span-8" gap={0.05}>
            {route.nodes.map((node, i) => (
              <Item key={`${node.kind}:${node.refId}`} as="li">
                <div className="group relative grid grid-cols-[60px_1fr_92px] items-center gap-4 border-b border-line py-5 sm:grid-cols-[96px_1fr_150px] sm:gap-8">
                  <span className="text-xl font-semibold tracking-[-0.03em] text-ink tnum sm:text-2xl">{clockAt(start, node.arrivalOffsetMinutes, locale)}</span>
                  <div className="min-w-0">
                    <p className="display-sm truncate">{pickText(node.place.name, locale)}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-ink-muted">{pickText(node.place.summary, locale)}</p>
                    <p className="mt-1.5 text-xs text-ink-faint tnum">
                      {formatDuration(node.stayMinutes, locale)}
                      {i < route.nodes.length - 1 && route.nodes[i + 1].travelMinutes ? ` · ${formatDuration(route.nodes[i + 1].travelMinutes, locale)} ${t.explore.travel}` : ""}
                    </p>
                  </div>
                  <Link href={`/places/${node.place.slug}`} className="block overflow-hidden rounded-card transition-transform duration-500 ease-out-quint group-hover:-translate-y-0.5" aria-label={pickText(node.place.name, locale)}>
                    <PlaceImage media={node.place.media[0]} alt={pickText(node.place.name, locale)} className="aspect-[4/3] w-full" sizes="150px" thumb />
                  </Link>
                </div>
              </Item>
            ))}
          </Stagger>
        </div>
      </div>
    </section>
  );
}
