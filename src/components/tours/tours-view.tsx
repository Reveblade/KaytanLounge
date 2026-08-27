"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { clsx } from "clsx";
import { Plus } from "@phosphor-icons/react";
import { api, qs } from "@/lib/api";
import type { GuideDto, Paginated, RouteDto, TourListItemDto, TourStatus } from "@/lib/contract/api";
import { dateOnly, money, text, timeOnly } from "@/lib/format";
import { useAdmin } from "@/lib/session/context";
import { EmptyState, Pager, PageHeader, Skeleton, StatusBadge } from "@/components/ui/primitives";

const PAGE_SIZE = 50;

const RANGES: { key: string; label: string; from?: () => string; to?: () => string }[] = [
  { key: "upcoming", label: "Upcoming", from: () => new Date().toISOString() },
  { key: "today", label: "Today", from: () => startOfIstanbulDay(0), to: () => startOfIstanbulDay(1) },
  { key: "week", label: "Next 7 days", from: () => startOfIstanbulDay(0), to: () => startOfIstanbulDay(7) },
  { key: "past", label: "Past", to: () => new Date().toISOString() },
  { key: "all", label: "All" },
];

const STATUSES: TourStatus[] = ["DRAFT", "PUBLISHED", "CANCELLED", "COMPLETED"];

/** Midnight Istanbul, `days` from today, as an ISO instant. */
function startOfIstanbulDay(days: number): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const midnightUtc = Date.UTC(get("year"), get("month") - 1, get("day") + days);
  // Istanbul is UTC+3 year round, so local midnight is 21:00 UTC the day before.
  return new Date(midnightUtc - 3 * 3_600_000).toISOString();
}

/** The departure calendar: every scheduled day, what it is, who leads it, how full it is. */
export function ToursView() {
  const { can } = useAdmin();
  const router = useRouter();
  const params = useSearchParams();
  const range = params.get("range") ?? "upcoming";
  const status = params.get("status") ?? "";
  const routeId = params.get("routeId") ?? "";
  const guideId = params.get("guideId") ?? "";
  const page = Number(params.get("page") ?? 1);

  function setParams(next: Record<string, string | number | undefined>) {
    const merged = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value === undefined || value === "" || value === 1) merged.delete(key);
      else merged.set(key, String(value));
    }
    router.replace(`/tours${merged.toString() ? `?${merged}` : ""}`, { scroll: false });
  }

  const window = useMemo(() => {
    const found = RANGES.find((r) => r.key === range) ?? RANGES[0];
    return { from: found.from?.(), to: found.to?.() };
  }, [range]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["tours", range, status, routeId, guideId, page],
    queryFn: () =>
      api<Paginated<TourListItemDto>>(
        `admin/tours${qs({ from: window.from, to: window.to, status: status || undefined, routeId: routeId || undefined, guideId: guideId || undefined, page, pageSize: PAGE_SIZE })}`,
      ),
    placeholderData: keepPreviousData,
  });

  const { data: routes } = useQuery({ queryKey: ["routes", "options"], queryFn: () => api<Paginated<RouteDto>>("admin/routes?pageSize=200") });
  const { data: guides } = useQuery({ queryKey: ["guides", "options"], queryFn: () => api<Paginated<GuideDto>>("admin/guides?pageSize=200") });

  const days = useMemo(() => groupByDay(data?.items ?? []), [data]);

  return (
    <>
      <PageHeader
        title="Tours"
        subtitle="Every departure on the calendar."
        actions={
          can("TOURS_WRITE") ? (
            <>
              <Link href="/templates" className="btn btn-secondary btn-sm">
                Templates
              </Link>
              <Link href="/tours/new" className="btn btn-primary btn-sm">
                <Plus size={15} weight="bold" /> New departure
              </Link>
            </>
          ) : null
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1.5">
          {RANGES.map((r) => (
            <button key={r.key} type="button" onClick={() => setParams({ range: r.key === "upcoming" ? undefined : r.key, page: 1 })} className={clsx("btn btn-sm", range === r.key ? "btn-primary" : "btn-secondary")}>
              {r.label}
            </button>
          ))}
        </div>
        <select className="field max-w-[170px]" value={status} onChange={(e) => setParams({ status: e.target.value, page: 1 })}>
          <option value="">Any status</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.toLowerCase()}
            </option>
          ))}
        </select>
        <select className="field max-w-[220px]" value={routeId} onChange={(e) => setParams({ routeId: e.target.value, page: 1 })}>
          <option value="">Any route</option>
          {(routes?.items ?? []).map((r) => (
            <option key={r.id} value={r.id}>
              {text(r.name)}
            </option>
          ))}
        </select>
        <select className="field max-w-[190px]" value={guideId} onChange={(e) => setParams({ guideId: e.target.value, page: 1 })}>
          <option value="">Any guide</option>
          {(guides?.items ?? []).map((g) => (
            <option key={g.id} value={g.id}>
              {g.displayName}
            </option>
          ))}
        </select>
      </div>

      {isLoading && !data ? (
        <Skeleton rows={10} />
      ) : error || !data ? (
        <EmptyState title="Tours unavailable" body="The API did not answer. Try again in a moment." />
      ) : data.items.length === 0 ? (
        <EmptyState
          title="Nothing scheduled"
          body="No departure matches these filters."
          action={can("TOURS_WRITE") ? <Link href="/tours/new" className="btn btn-primary">Schedule one</Link> : undefined}
        />
      ) : (
        <div className="space-y-5">
          {days.map(([day, tours]) => (
            <section key={day}>
              <h2 className="eyebrow mb-2 px-1">{dateOnly(day)}</h2>
              <div className="panel overflow-x-auto p-1.5">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Route</th>
                      <th>Guide</th>
                      <th>Vehicle</th>
                      <th className="text-right">Seats</th>
                      <th className="text-right">Adult</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {tours.map((tour) => (
                      <tr key={tour.id}>
                        <td className="tnum whitespace-nowrap font-medium">{timeOnly(tour.startsAt)}</td>
                        <td className="max-w-[220px] truncate">
                          <Link href={`/tours/${tour.id}`} className="hover:underline">
                            {text(tour.routeName)}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap">{tour.guideName}</td>
                        <td className="max-w-[150px] truncate text-ink-muted">{tour.vehicleName}</td>
                        <td className="tnum whitespace-nowrap text-right">
                          {tour.bookedSeats}/{tour.seatCount}
                          {tour.pendingApprovals ? <Link href={`/bookings?status=AWAITING_APPROVAL`} className="badge badge-warning ml-1.5">{tour.pendingApprovals}</Link> : null}
                        </td>
                        <td className="tnum text-right">{adultFare(tour)}</td>
                        <td>
                          <StatusBadge value={tour.status} />
                        </td>
                        <td className="text-right">
                          <Link href={`/tours/${tour.id}`} className="btn btn-ghost btn-sm">
                            Open
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}

      {data ? <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={(p) => setParams({ page: p })} /> : null}
    </>
  );
}

function adultFare(tour: TourListItemDto): string {
  const tier = tour.pricing.tiers.find((t) => t.key === "ADULT");
  return tier ? money(tier.amount, tour.pricing.currency) : "—";
}

/** Departures read as a calendar, so they are grouped by the Istanbul day they leave on. */
function groupByDay(tours: TourListItemDto[]): [string, TourListItemDto[]][] {
  const map = new Map<string, TourListItemDto[]>();
  const key = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" });
  for (const tour of tours) {
    const day = key.format(new Date(tour.startsAt));
    const bucket = map.get(day);
    if (bucket) bucket.push(tour);
    else map.set(day, [tour]);
  }
  return [...map.values()].map((list) => [list[0].startsAt, list] as [string, TourListItemDto[]]);
}
