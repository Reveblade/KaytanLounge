import type { Metadata } from "next";
import { SiteHeader } from "@/components/chrome/site-header";
import { BookingView } from "@/components/booking/booking-view";
import { getDictionary } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return { title: t.ticket.title };
}

export default async function BookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <SiteHeader variant="solid" />
      <main className="page-in ambient mx-auto max-w-[1100px] px-5 pb-32 pt-28 sm:px-8">
        <BookingView bookingId={id} />
      </main>
    </>
  );
}
