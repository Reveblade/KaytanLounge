"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { clsx } from "clsx";
import { api, qs } from "@/lib/api";
import type { BookingDetailDto, BookingStatus, Paginated } from "@/lib/contract/api";
import { dateTime, money, text } from "@/lib/format";
import { EmptyState, Pager, PageHeader, SearchBox, Skeleton, StatusBadge } from "@/components/ui/primitives";

const PAGE_SIZE = 25;

/** The tabs an operator actually works in, in the order the day runs. */
const TABS: { key: string; label: string; status?: BookingStatus }[] = [
  { key: "AWAITING_APPROVAL", label: "Awaiting approval", status: "AWAITING_APPROVAL" },
  { key: "CONFIRMED", label: "Confirmed", status: "CONFIRMED" },
  { key: "PENDING_PAYMENT", label: "Holding a seat", status: "PENDING_PAYMENT" },
  { key: "CANCELLED", label: "Cancelled", status: "CANCELLED" },
  { key: "REFUNDED", label: "Refunded", status: "REFUNDED" },
  { key: "", label: "All" },
];

/**
 * Every booking in the system, filtered the way the counter thinks: what needs a
 * decision first, then what is settled. Filters live in the URL so a link to
 * "everything awaiting approval" can be pasted into a message.
 */
export function BookingsView() {
  const router = useRouter();
  const params = useSearchParams();
  const status = params.get("status") ?? "AWAITING_APPROVAL";
  const page = Number(params.get("page") ?? 1);
  const [search, setSearch] = useState(params.get("q") ?? "");
  const q = params.get("q") ?? "";

  // Typing should not fire a request per keystroke, nor push a history entry per keystroke.
  useEffect(() => {
    if (search === q) return;
    const timer = setTimeout(() => setParams({ q: search, page: 1 }), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function setParams(next: Record<string, string | number | undefined>) {
    const merged = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value === undefined || value === "" || value === 1) merged.delete(key);
      else merged.set(key, String(value));
    }
    router.replace(`/bookings${merged.toString() ? `?${merged}` : ""}`, { scroll: false });
  }

  const { data, isLoading, error } = useQuery({
    queryKey: ["bookings", status, page, q],
    queryFn: () => api<Paginated<BookingDetailDto>>(`admin/bookings${qs({ status: status || undefined, page, pageSize: PAGE_SIZE, q: q || undefined })}`),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader
        title="Bookings"
        subtitle="Approve payments, look tickets up, cancel and refund."
        actions={<SearchBox value={search} onChange={setSearch} placeholder="Ticket, name, phone" />}
      />

      <div className="mb-4 flex flex-wrap gap-1.5">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setParams({ status: tab.key || undefined, page: 1 })}
            className={clsx("btn btn-sm", status === tab.key ? "btn-primary" : "btn-secondary")}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading && !data ? (
        <Skeleton rows={10} />
      ) : error || !data ? (
        <EmptyState title="Bookings unavailable" body="The API did not answer. Try again in a moment." />
      ) : data.items.length === 0 ? (
        <EmptyState title="Nothing here" body={q ? `No booking matches “${q}”.` : "No bookings in this state."} />
      ) : (
        <div className="panel overflow-x-auto p-1.5">
          <table className="table">
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Guest</th>
                <th>Route</th>
                <th>Departure</th>
                <th className="text-right">Seats</th>
                <th className="text-right">Total</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.items.map((booking) => (
                <tr key={booking.id}>
                  <td>
                    <Link href={`/bookings/${booking.id}`} className="mono hover:underline">
                      {booking.ticketCode}
                    </Link>
                  </td>
                  <td className="max-w-[200px] truncate">
                    {booking.contact.fullName}
                    <span className="block text-xs text-ink-faint">{booking.contact.phone}</span>
                  </td>
                  <td className="max-w-[190px] truncate">{text(booking.tour.route.name)}</td>
                  <td className="tnum whitespace-nowrap">{dateTime(booking.tour.startsAt)}</td>
                  <td className="tnum text-right">{booking.passengers.length}</td>
                  <td className="tnum text-right">{money(booking.total, booking.currency)}</td>
                  <td>
                    <StatusBadge value={booking.status} />
                  </td>
                  <td className="text-right">
                    <Link href={`/bookings/${booking.id}`} className="btn btn-ghost btn-sm">
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data ? <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={(p) => setParams({ page: p })} /> : null}
    </>
  );
}
