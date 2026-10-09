"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { clsx } from "clsx";
import { CheckCircle, MagnifyingGlass, XCircle } from "@phosphor-icons/react";
import { api, ApiError, qs } from "@/lib/api";
import type { BookingDetailDto, Paginated, TourListItemDto } from "@/lib/contract/api";
import { dateTime, text, timeOnly } from "@/lib/format";
import { useAdmin } from "@/lib/session/context";
import { PageHeader, Section, Skeleton, StatusBadge } from "@/components/ui/primitives";

/** Midnight Istanbul, `days` from today, as an ISO instant. */
function istanbulDay(days: number): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return new Date(Date.UTC(get("year"), get("month") - 1, get("day") + days) - 3 * 3_600_000).toISOString();
}

/**
 * The screen a guide holds at the meeting point. A ticket code is typed or scanned into
 * one box; below it, today's departures with their manifests, because half the time the
 * guest has lost the code and gives a name instead.
 */
export function CheckInView() {
  const { can } = useAdmin();
  const [code, setCode] = useState("");
  const [looked, setLooked] = useState<string | null>(null);

  const today = useQuery({
    queryKey: ["tours", "today"],
    queryFn: () => api<Paginated<TourListItemDto>>(`admin/tours${qs({ from: istanbulDay(0), to: istanbulDay(1), status: "PUBLISHED", pageSize: 50 })}`),
  });

  const found = useQuery({
    queryKey: ["ticket", looked],
    queryFn: () => api<BookingDetailDto>(`admin/bookings/ticket/${encodeURIComponent(looked!)}`),
    enabled: Boolean(looked),
    retry: false,
  });

  return (
    <>
      <PageHeader title="Check-in" subtitle="Scan or type a ticket code at the meeting point." />

      <form
        className="panel mb-6 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          setLooked(code.trim().toUpperCase());
        }}
      >
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-[240px] flex-1">
            <MagnifyingGlass size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input
              className="field mono !h-14 pl-11 text-lg tracking-[0.08em]"
              placeholder="BIY-XXXX-XXXX"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoFocus
              autoCapitalize="characters"
              spellCheck={false}
            />
          </div>
          <button type="submit" className="btn btn-primary !h-14 px-7" disabled={!code.trim()}>
            Look it up
          </button>
        </div>
      </form>

      {looked ? (
        found.isLoading ? (
          <Skeleton rows={4} />
        ) : found.error || !found.data ? (
          <div className="panel mb-6 flex items-center gap-3 border-danger/50 p-5">
            <XCircle size={24} weight="fill" className="shrink-0 text-danger" />
            <div>
              <p className="font-semibold">No ticket with that code</p>
              <p className="text-sm text-ink-muted">Check the code, or find the guest in a manifest below.</p>
            </div>
          </div>
        ) : (
          <TicketCard booking={found.data} canCheckIn={can("BOOKINGS_CHECKIN")} />
        )
      ) : null}

      <Section title="Leaving today" description="Manifests for every published departure today.">
        {today.isLoading ? (
          <Skeleton rows={4} />
        ) : !today.data?.items.length ? (
          <p className="text-sm text-ink-muted">Nothing leaves today.</p>
        ) : (
          <div className="space-y-2">
            {today.data.items.map((tour) => (
              <Link key={tour.id} href={`/tours/${tour.id}`} className="flex items-center gap-3 rounded-control border border-line p-3 transition-colors hover:border-line-strong">
                <span className="tnum text-lg font-semibold">{timeOnly(tour.startsAt)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{text(tour.routeName)}</span>
                  <span className="block truncate text-xs text-ink-faint">
                    {tour.guideName} · {tour.vehicleName}
                  </span>
                </span>
                <span className="tnum shrink-0 text-sm text-ink-muted">
                  {tour.bookedSeats}/{tour.seatCount}
                </span>
              </Link>
            ))}
          </div>
        )}
      </Section>
    </>
  );
}

function TicketCard({ booking, canCheckIn }: { booking: BookingDetailDto; canCheckIn: boolean }) {
  const client = useQueryClient();
  const checkedIn = booking.passengers.filter((p) => p.checkedInAt).length;
  const valid = booking.status === "CONFIRMED";

  const act = useMutation({
    mutationFn: (body: { seatLabels?: string[]; undo?: boolean }) => api<BookingDetailDto>(`admin/bookings/${booking.id}/check-in`, { method: "POST", body }),
    onSuccess: (next) => {
      client.setQueryData(["ticket", booking.ticketCode], next);
      void client.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Check-in updated");
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Could not check in"),
  });

  return (
    <div className={clsx("panel mb-6 p-5", valid ? "border-success/50" : "border-warning/50")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {valid ? <CheckCircle size={28} weight="fill" className="shrink-0 text-success" /> : <XCircle size={28} weight="fill" className="shrink-0 text-warning" />}
          <div>
            <p className="mono text-lg font-semibold">{booking.ticketCode}</p>
            <p className="text-sm text-ink-muted">
              {booking.contact.fullName} · {text(booking.tour.route.name)} · {dateTime(booking.tour.startsAt)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge value={booking.status} />
          <Link href={`/bookings/${booking.id}`} className="btn btn-ghost btn-sm">
            Open
          </Link>
        </div>
      </div>

      {!valid ? (
        <p className="mt-4 rounded-control bg-warning/10 px-3 py-2 text-sm">
          This ticket is <strong>{booking.status.replace(/_/g, " ").toLowerCase()}</strong>. Do not board the guest until it is confirmed.
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-1.5">
        {booking.passengers.map((passenger) => (
          <button
            key={passenger.seatLabel}
            type="button"
            disabled={!canCheckIn || !valid || act.isPending}
            onClick={() => act.mutate({ seatLabels: [passenger.seatLabel], undo: Boolean(passenger.checkedInAt) })}
            className={clsx(
              "rounded-control border px-3 py-2 text-left text-sm transition-colors",
              passenger.checkedInAt ? "border-success bg-success/10" : "border-line hover:border-line-strong",
              (!canCheckIn || !valid) && "cursor-not-allowed opacity-60",
            )}
          >
            <span className="mono block text-xs text-ink-faint">{passenger.seatLabel}</span>
            <span className="block font-medium">{passenger.fullName}</span>
            <span className="block text-xs text-ink-faint">{passenger.checkedInAt ? `aboard ${timeOnly(passenger.checkedInAt)}` : "not aboard"}</span>
          </button>
        ))}
      </div>

      {canCheckIn && valid ? (
        <div className="mt-4 flex gap-2">
          <button type="button" className="btn btn-primary btn-sm" disabled={act.isPending || checkedIn === booking.passengers.length} onClick={() => act.mutate({})}>
            Everyone aboard
          </button>
          {checkedIn ? (
            <button type="button" className="btn btn-ghost btn-sm" disabled={act.isPending} onClick={() => act.mutate({ undo: true })}>
              Undo
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
