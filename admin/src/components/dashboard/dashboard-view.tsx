"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { DashboardDto } from "@/lib/contract/api";
import { dateTime, money, text, timeOnly } from "@/lib/format";
import { useAdmin } from "@/lib/session/context";
import { EmptyState, PageHeader, Section, Skeleton, StatusBadge } from "@/components/ui/primitives";

/** Numbers that matter this morning, then the two lists people act on: approvals and departures. */
export function DashboardView() {
  const { admin } = useAdmin();
  const { data, isLoading, error } = useQuery({ queryKey: ["dashboard"], queryFn: () => api<DashboardDto>("admin/dashboard"), refetchInterval: 60_000 });

  return (
    <>
      <PageHeader title={`Good day, ${admin.name.split(" ")[0]}`} subtitle={new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Istanbul", weekday: "long", day: "numeric", month: "long" }).format(new Date())} />
      {isLoading ? <Skeleton rows={8} /> : error || !data ? <EmptyState title="Dashboard unavailable" body="The API did not answer. Try again in a moment." /> : (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Tours today" value={String(data.today.tours)} sub={`${data.today.checkedIn}/${data.today.passengers} checked in`} />
            <Stat label="Awaiting approval" value={String(data.pending.approvals)} sub={money(data.pending.awaitingAmount.amount, data.pending.awaitingAmount.currency)} tone={data.pending.approvals ? "warning" : undefined} href="/bookings?status=AWAITING_APPROVAL" />
            <Stat label="Next 7 days" value={`${data.next7Days.seatsSold}/${data.next7Days.seatsTotal}`} sub={`seats sold across ${data.next7Days.tours} departures`} />
            <Stat label="Revenue, 30 days" value={money(data.revenue30d.amount, data.revenue30d.currency)} sub="approved payments" />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Section title="Recent bookings" description="Newest first, every status." className="min-w-0">
              {data.recentBookings.length === 0 ? (
                <p className="text-sm text-ink-muted">No bookings yet.</p>
              ) : (
                <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr><th>Ticket</th><th>Route</th><th>Departure</th><th className="text-right">Total</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {data.recentBookings.map((b) => (
                      <tr key={b.id}>
                        <td className="whitespace-nowrap"><Link href={`/bookings/${b.id}`} className="mono hover:underline">{b.ticketCode}</Link></td>
                        <td className="max-w-[180px] truncate">{text(b.tour.route.name)}</td>
                        <td className="tnum whitespace-nowrap">{dateTime(b.tour.startsAt)}</td>
                        <td className="tnum text-right">{money(b.total, b.currency)}</td>
                        <td><StatusBadge value={b.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
            </Section>
            <Section title="Upcoming departures" description="Published, next seven days." className="min-w-0">
              {data.upcomingTours.length === 0 ? (
                <p className="text-sm text-ink-muted">Nothing published for the coming week.</p>
              ) : (
                <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr><th>When</th><th>Route</th><th>Guide</th><th>Seats</th><th></th></tr>
                  </thead>
                  <tbody>
                    {data.upcomingTours.map((tour) => (
                      <tr key={tour.id}>
                        <td className="tnum whitespace-nowrap">{dateTime(tour.startsAt).replace(/, \d{2}:\d{2}$/, "")} <span className="text-ink-faint">{timeOnly(tour.startsAt)}</span></td>
                        <td className="max-w-[180px] truncate">{text(tour.routeName)}</td>
                        <td className="whitespace-nowrap">{tour.guideName}</td>
                        <td className="tnum">{tour.bookedSeats}/{tour.seatCount}{tour.pendingApprovals ? <span className="ml-1 badge badge-warning">{tour.pendingApprovals} pending</span> : null}</td>
                        <td className="text-right"><Link href={`/tours/${tour.id}`} className="btn btn-ghost btn-sm">Open</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
            </Section>
          </div>
        </div>
      )}
    </>
  );
}

function Stat({ label, value, sub, tone, href }: { label: string; value: string; sub?: string; tone?: "warning"; href?: string }) {
  const body = (
    <div className={`panel panel-lift p-5 ${tone === "warning" ? "!border-warning/50" : ""}`}>
      <p className="eyebrow">{label}</p>
      <p className="mt-2 text-[2rem] font-semibold leading-none tracking-[-0.03em] tnum">{value}</p>
      {sub ? <p className="mt-2.5 text-xs text-ink-faint">{sub}</p> : null}
    </div>
  );
  return href ? <Link href={href} className="block">{body}</Link> : body;
}
