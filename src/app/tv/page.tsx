import type { Metadata } from "next";
import { headers } from "next/headers";
import { apiGetOrNull } from "@/lib/api/server";
import type { TourDetailDto } from "@/lib/contract/api";
import { isLoungeUA } from "@/lib/lounge";
import { loadBootstrap, loadRoute, loadRouteCards } from "@/lib/public-data";
import { TvGate } from "@/components/tv/tv-gate";
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
 * radio still plays underneath, the city still turns, and the loop is meant to run
 * unattended on a lounge screen or a booth. Lounge TVs play a baked loop of the
 * same orbit; they do not start WebGL.
 */
export default async function TvPage({ searchParams }: { searchParams: Promise<{ bg?: string }> }) {
  const query = await searchParams;
  const lounge = query.bg === "loop" || isLoungeUA((await headers()).get("user-agent") ?? "");
  const [bootstrap, cards] = await Promise.all([loadBootstrap(), loadRouteCards()]);
  const featuredSlug = bootstrap.featuredRoutes[0]?.slug ?? cards[0]?.slug;
  const featured = featuredSlug ? await loadRoute(featuredSlug) : null;
  const firstTourId = featured?.tours[0]?.id;
  const sampleTour = firstTourId
    ? await apiGetOrNull<TourDetailDto>(`public/tours/${firstTourId}`, { revalidate: 60 }).catch(() => null)
    : null;
  const titleSponsor = bootstrap.sponsors.find((b) => b.sponsorTier === "TITLE") ?? null;

  return (
    <TvGate wait="city" required={lounge}>
      <TvShow
        routes={cards}
        featured={featured}
        tour={sampleTour}
        highlights={bootstrap.highlights}
        titleSponsor={titleSponsor}
        host={publicHost()}
        loop={lounge}
      />
    </TvGate>
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
