import type { Metadata } from "next";
import { ExploreApp } from "@/components/explore/explore-app";
import { getDictionary } from "@/lib/i18n/server";
import { loadBootstrap, loadPlaces, loadRoute, loadRouteCards } from "@/lib/public-data";

export const revalidate = 30;

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getDictionary();
  return { title: locale === "tr" ? "Rotalar" : "Routes" };
}

/**
 * The map screen deliberately renders without the site header: the city fills the
 * viewport and the only chrome is a floating cluster over it. `?view=all` (or no
 * route at all) opens on every published place rather than on one route.
 */
export default async function ExplorePage({ searchParams }: { searchParams: Promise<{ route?: string; stop?: string; view?: string }> }) {
  const { route: requested, stop, view } = await searchParams;
  const [cards, bootstrap, places] = await Promise.all([loadRouteCards(), loadBootstrap(), loadPlaces()]);
  const overview = view === "all";
  const slug = requested && cards.some((c) => c.slug === requested) ? requested : (bootstrap.featuredRoutes[0]?.slug ?? cards[0]?.slug);
  const initial = overview || !slug ? null : await loadRoute(slug);
  return <ExploreApp cards={cards} initialRoute={initial} initialStop={stop ?? null} places={places} startInOverview={overview || !initial} />;
}
