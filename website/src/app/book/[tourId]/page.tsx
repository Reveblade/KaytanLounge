import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { apiGetOrNull } from "@/lib/api/server";
import type { TourDetailDto } from "@/lib/contract/api";
import { nearlySamePoint } from "@/lib/geo";
import { pickText } from "@/lib/i18n/pick";
import { getDictionary } from "@/lib/i18n/server";
import { loadBootstrap, loadRoute } from "@/lib/public-data";
import { SiteHeader } from "@/components/chrome/site-header";
import { BookingFlow } from "@/components/booking/booking-flow";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ tourId: string }> }): Promise<Metadata> {
  const { tourId } = await params;
  const { t, locale } = await getDictionary();
  const tour = await apiGetOrNull<TourDetailDto>(`public/tours/${encodeURIComponent(tourId)}`, { revalidate: false }).catch(() => null);
  if (!tour) return { title: t.booking.title };
  return { title: pickText(tour.route.name, locale), description: pickText(tour.route.tagline, locale) };
}

export default async function BookPage({ params }: { params: Promise<{ tourId: string }> }) {
  const { tourId } = await params;
  const { locale } = await getDictionary();
  const [tour, bootstrap] = await Promise.all([
    apiGetOrNull<TourDetailDto>(`public/tours/${encodeURIComponent(tourId)}`, { revalidate: false }).catch(() => null),
    loadBootstrap(),
  ]);
  if (!tour) notFound();
  // A departure carries its meeting point as a name and a pin, not as a place — but the
  // meeting point is nearly always one of the route's own stops. Resolving it against the
  // route gives the card the same photograph the map draws for that stop.
  const detail = await loadRoute(tour.route.slug);
  const meetingPlace = detail?.nodes.find((node) => nearlySamePoint(node.place.location, tour.meetingPoint.location))?.place ?? null;
  return (
    <>
      <SiteHeader variant="solid" />
      <main className="page-in ambient mx-auto max-w-[1440px] px-5 pb-32 pt-28 sm:px-8">
        <BookingFlow
          tour={tour}
          meetingPlace={meetingPlace}
          routeName={pickText(tour.route.name, locale)}
          paymentOptions={bootstrap.paymentOptions}
          settings={bootstrap.settings}
        />
      </main>
    </>
  );
}
