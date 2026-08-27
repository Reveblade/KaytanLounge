"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowsClockwise, Plus, Star } from "@phosphor-icons/react";
import { api, ApiError, qs } from "@/lib/api";
import type { Paginated, RouteDto } from "@/lib/contract/api";
import { duration, text } from "@/lib/format";
import { useAdmin } from "@/lib/session/context";
import { EmptyState, PageHeader, SearchBox, Skeleton, StatusBadge } from "@/components/ui/primitives";

/** Every itinerary, published or not. The map lives on the builder, not here. */
export function RoutesView() {
  const { can } = useAdmin();
  const client = useQueryClient();
  const [q, setQ] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["routes", q],
    queryFn: () => api<Paginated<RouteDto>>(`admin/routes${qs({ pageSize: 100, q: q || undefined })}`),
  });

  const recompute = useMutation({
    mutationFn: (id: string) => api<RouteDto>(`admin/routes/${id}/recompute`, { method: "POST" }),
    onSuccess: (route) => {
      void client.invalidateQueries({ queryKey: ["routes"] });
      toast.success(`${text(route.name)}: ${route.distanceKm.toFixed(1)} km, ${duration(route.durationMinutes)}`);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Could not recompute"),
  });

  return (
    <>
      <PageHeader
        title="Routes"
        subtitle="The itineraries a day out is built from."
        actions={
          <>
            <SearchBox value={q} onChange={setQ} placeholder="Search routes" />
            {can("ROUTES_WRITE") ? (
              <Link href="/routes/new" className="btn btn-primary btn-sm">
                <Plus size={15} weight="bold" /> New route
              </Link>
            ) : null}
          </>
        }
      />

      {isLoading ? (
        <Skeleton rows={8} />
      ) : error || !data ? (
        <EmptyState title="Routes unavailable" body="The API did not answer." />
      ) : data.items.length === 0 ? (
        <EmptyState title="No routes" body={q ? `Nothing matches “${q}”.` : "Build the first itinerary."} action={can("ROUTES_WRITE") ? <Link href="/routes/new" className="btn btn-primary">New route</Link> : undefined} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.items.map((route) => (
            <div key={route.id} className="panel panel-lift flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <p className="eyebrow">{route.theme.replace(/_/g, " ")}</p>
                <div className="flex items-center gap-1.5">
                  {route.featured ? <Star size={14} weight="fill" className="text-accent" aria-label="Featured" /> : null}
                  <StatusBadge value={route.status} />
                </div>
              </div>
              <h3 className="mt-1.5 text-[1.05rem] font-semibold tracking-[-0.014em]">
                <Link href={`/routes/${route.id}`} className="hover:underline">
                  {text(route.name)}
                </Link>
              </h3>
              <p className="mt-1 line-clamp-2 text-sm text-ink-muted">{text(route.tagline)}</p>
              <p className="mt-4 flex-1 text-sm text-ink-faint tnum">
                {route.nodes.length} stops · {route.distanceKm.toFixed(1)} km · {duration(route.durationMinutes)} · {route.pace.toLowerCase()}
              </p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                <Link href={`/routes/${route.id}`} className="btn btn-secondary btn-sm">
                  Open the builder
                </Link>
                {can("ROUTES_WRITE") ? (
                  <button type="button" className="btn btn-ghost btn-sm" disabled={recompute.isPending} onClick={() => recompute.mutate(route.id)} title="Ask the routing service for fresh distances and times">
                    <ArrowsClockwise size={15} /> Recompute
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
