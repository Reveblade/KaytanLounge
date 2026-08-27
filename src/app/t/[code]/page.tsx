import type { Metadata } from "next";
import { apiGetOrNull } from "@/lib/api/server";
import type { BookingDetailDto } from "@/lib/contract/api";
import { formatDateTime } from "@/lib/format";
import { pickText } from "@/lib/i18n/pick";
import { getDictionary } from "@/lib/i18n/server";
import { SiteHeader } from "@/components/chrome/site-header";
import { Wordmark } from "@/components/chrome/wordmark";
import { Reveal } from "@/components/motion/reveal";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return { title: t.ticket.title, robots: { index: false } };
}

/** What a scanned QR resolves to: enough to trust the ticket, nothing personal beyond names. */
export default async function PublicTicketPage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ s?: string }> }) {
  const { code } = await params;
  const { s } = await searchParams;
  const { t, locale } = await getDictionary();
  const booking = await apiGetOrNull<BookingDetailDto>(`tickets/${encodeURIComponent(code)}?s=${encodeURIComponent(s ?? "")}`, { revalidate: false }).catch(() => null);
  const valid = booking?.status === "CONFIRMED";

  return (
    <>
      <SiteHeader variant="solid" />
      <main className="page-in ambient mx-auto max-w-[640px] px-5 pb-24 pt-32 sm:px-8">
        <Reveal above>
          {!booking ? (
            <div className="glass rounded-panel p-10 text-center">
              <p className="display-md">{t.ticket.notFound}</p>
            </div>
          ) : (
            <div className="glass rounded-panel p-6 sm:p-8">
              <Wordmark size="sm" />
              <span className={`mt-6 inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-medium ${valid ? "bg-success/12 text-success" : "bg-danger/12 text-danger"}`}>
                <span className="h-1.5 w-1.5 rounded-pill bg-current" aria-hidden />
                {valid ? t.ticket.valid : t.status[booking.status]}
              </span>
              <p className="display-md mt-3">{pickText(booking.tour.route.name, locale)}</p>
              <p className="mt-2 text-ink-muted tnum">{formatDateTime(booking.tour.startsAt, locale)}</p>
              <p className="mt-6 text-[1.8rem] font-semibold tracking-[0.08em] tnum">{booking.ticketCode}</p>
              <ul className="mt-6 divide-y divide-line text-sm">
                {booking.passengers.map((p) => (
                  <li key={p.seatLabel} className="flex items-center justify-between py-2.5">
                    <span className="flex items-center gap-3">
                      <span className="grid h-8 w-8 place-items-center rounded-[9px] bg-accent-soft text-xs font-semibold text-accent tnum">{p.seatLabel}</span>
                      <span className="font-medium">{p.fullName}</span>
                    </span>
                    <span className="text-ink-muted">{p.checkedInAt ? t.ticket.checkedIn : t.booking.tiers[p.tierKey]}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-sm text-ink-muted">{t.ticket.guideContact}: {booking.tour.guide.displayName}</p>
            </div>
          )}
        </Reveal>
      </main>
    </>
  );
}
