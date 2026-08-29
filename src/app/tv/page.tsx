import type { Metadata } from "next";
import { apiGetOrNull } from "@/lib/api/server";
import type { TourDetailDto } from "@/lib/contract/api";
import { loadBootstrap, loadRoute, loadRouteCards } from "@/lib/public-data";
import { TvShow } from "@/components/tv/tv-show";

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "TV",
    robots: { index: false, follow: false },
  };
}

/**
 * A full-viewport reel of the product. No chrome of the site itself — the house
 * radio still plays underneath, the map still turns, and the loop is meant to run
 * unattended on a lounge screen or a booth.
 */
export default async function TvPage() {
  const [bootstrap, cards] = await Promise.all([loadBootstrap(), loadRouteCards()]);
  const featuredSlug = bootstrap.featuredRoutes[0]?.slug ?? cards[0]?.slug;
  const featured = featuredSlug ? await loadRoute(featuredSlug) : null;
  const firstTourId = featured?.tours[0]?.id;
  const sampleTour = firstTourId
    ? await apiGetOrNull<TourDetailDto>(`public/tours/${firstTourId}`, { revalidate: 60 }).catch(() => null)
    : null;
  const titleSponsor = bootstrap.sponsors.find((b) => b.sponsorTier === "TITLE") ?? null;

  return (
    <TvShow
      routes={cards}
      featured={featured}
      tour={sampleTour}
      highlights={bootstrap.highlights}
      titleSponsor={titleSponsor}
      host={publicHost()}
    />
  );
}

/** A hostname worth putting on a wall. Loopback is not. */
function publicHost(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_ORIGIN;
  if (!raw) return "";
  try {
    const host = new URL(raw).hostname;
    if (host === "localhost" || host === "127.0.0.1") return "";
    return host.replace(/^www\./, "");
  } catch {
    return "";
  }
}
