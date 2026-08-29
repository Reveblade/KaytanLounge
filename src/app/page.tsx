import { apiGetOrNull } from "@/lib/api/server";
import type { TourDetailDto } from "@/lib/contract/api";
import { getDictionary } from "@/lib/i18n/server";
import { loadBootstrap, loadRoute, loadRouteCards } from "@/lib/public-data";
import { SiteFooter } from "@/components/chrome/site-footer";
import { SiteHeader } from "@/components/chrome/site-header";
import { DayTimeline } from "@/components/landing/day-timeline";
import { FleetBento } from "@/components/landing/fleet-bento";
import { Hero } from "@/components/landing/hero";
import { PlacesMosaic } from "@/components/landing/places-mosaic";
import { RoutesStrip } from "@/components/landing/routes-strip";
import { SponsorBlock } from "@/components/landing/sponsor-block";

export const revalidate = 60;

export default async function LandingPage() {
  const { t, locale } = await getDictionary();
  const [bootstrap, cards] = await Promise.all([loadBootstrap(), loadRouteCards()]);
  const featuredSlug = bootstrap.featuredRoutes[0]?.slug ?? cards[0]?.slug;
  const featured = featuredSlug ? await loadRoute(featuredSlug) : null;
  const firstTourId = featured?.tours[0]?.id;
  const sampleTour = firstTourId
    ? await apiGetOrNull<TourDetailDto>(`public/tours/${firstTourId}`, { revalidate: 60 }).catch(() => null)
    : null;
  const title = bootstrap.sponsors.find((b) => b.sponsorTier === "TITLE");
  const sponsorRoute = cards.find((c) => c.slug.includes("kaytan")) ?? cards[0];

  return (
    <>
      <SiteHeader />
      <main className="page-in">
        <Hero t={t} route={featured} locale={locale} />
        <RoutesStrip t={t} locale={locale} routes={cards} />
        {featured ? <DayTimeline t={t} locale={locale} route={featured} /> : null}
        {title ? <SponsorBlock t={t} locale={locale} title={title} route={sponsorRoute} /> : null}
        {sampleTour ? <FleetBento t={t} locale={locale} tour={sampleTour} /> : null}
        {bootstrap.highlights.length ? <PlacesMosaic t={t} locale={locale} places={bootstrap.highlights} /> : null}
      </main>
      <SiteFooter t={t} locale={locale} settings={bootstrap.settings} routes={cards} sponsors={bootstrap.sponsors} />
    </>
  );
}
