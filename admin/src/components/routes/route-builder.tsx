"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { clsx } from "clsx";
import { DotsSixVertical, FloppyDisk, MagnifyingGlass, Storefront, Trash } from "@phosphor-icons/react";
import { api, ApiError } from "@/lib/api";
import { ROUTE_THEMES } from "@/lib/contract/api";
import type { AttractionDto, BusinessDto, GeoJsonLineString, LocalizedText, MediaItem, Paginated, RouteDto, RouteNodeKind, RoutePace, RouteTheme } from "@/lib/contract/api";
import { duration, text } from "@/lib/format";
import { useAdmin } from "@/lib/session/context";
import { ConfirmButton, EmptyState, Field, LocalizedInput, LocalizedListInput, PageHeader, Section, Skeleton, Toggle } from "@/components/ui/primitives";
import { MediaManager } from "@/components/ui/media-manager";
import { BuilderMap, type BuilderStop } from "./builder-map";

const PACES: RoutePace[] = ["RELAXED", "BALANCED", "FULL"];

interface Stop {
  key: string;
  kind: RouteNodeKind;
  refId: string;
  stayMinutes: number;
  note?: LocalizedText;
  /** Denormalised for the list and the map; never sent back. */
  name: LocalizedText;
  district: string;
  location: { lat: number; lng: number };
}

interface Draft {
  slug: string;
  name: LocalizedText;
  tagline: LocalizedText;
  description: LocalizedText;
  highlights: { tr?: string[]; en?: string[] };
  theme: RouteTheme;
  pace: RoutePace;
  featured: boolean;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  cover?: MediaItem;
}

const BLANK: Draft = { slug: "", name: {}, tagline: {}, description: {}, highlights: {}, theme: "CLASSICS", pace: "BALANCED", featured: false, status: "DRAFT" };

/**
 * The route builder. Stops are dragged into order on the left and drawn on the right;
 * distances and times come from the routing service through the preview endpoint, so
 * what the builder shows is what the route will store.
 */
export function RouteBuilder({ id }: { id?: string }) {
  const existing = useQuery({ queryKey: ["route", id], queryFn: () => api<RouteDto>(`admin/routes/${id}`), enabled: Boolean(id) });
  const places = usePlaces();

  if (places.loading || (id && existing.isLoading)) return <Skeleton rows={12} />;
  if (id && (existing.error || !existing.data)) {
    return <EmptyState title="Route not found" body="It may have been deleted." action={<Link href="/routes" className="btn btn-secondary">Back to routes</Link>} />;
  }
  /**
   * Keyed on the route so a different route mounts a fresh builder rather than trying to
   * reconcile one draft into another. Everything below then owns its own state outright.
   */
  return <Builder key={id ?? "new"} id={id} route={existing.data} places={places} />;
}

function Builder({ id, route, places }: { id?: string; route?: RouteDto; places: ReturnType<typeof usePlaces> }) {
  const { can } = useAdmin();
  const router = useRouter();
  const client = useQueryClient();
  const [draft, setDraft] = useState<Draft>(() =>
    route
      ? {
          slug: route.slug,
          name: route.name,
          tagline: route.tagline,
          description: route.description,
          highlights: route.highlights,
          theme: route.theme,
          pace: route.pace,
          featured: route.featured,
          status: route.status,
          cover: route.cover,
        }
      : BLANK,
  );
  const [stops, setStops] = useState<Stop[]>(() =>
    (route?.nodes ?? [])
      .slice()
      .sort((a, b) => a.order - b.order)
      // A node whose place has since been deleted simply drops out of the builder.
      .flatMap((node) => {
        const place = places.byId.get(node.refId);
        if (!place) return [];
        return [{ key: `${node.kind}:${node.refId}`, kind: node.kind, refId: node.refId, stayMinutes: node.stayMinutes, note: node.note, name: place.name, district: place.district, location: place.location }];
      }),
  );
  const [active, setActive] = useState<string | undefined>();

  const preview = usePreview(stops);

  const save = useMutation({
    mutationFn: () => {
      const body = { ...draft, slug: draft.slug || undefined, nodes: stops.map((s) => ({ kind: s.kind, refId: s.refId, stayMinutes: s.stayMinutes, note: s.note })) };
      return id ? api<RouteDto>(`admin/routes/${id}`, { method: "PATCH", body }) : api<RouteDto>("admin/routes", { method: "POST", body });
    },
    onSuccess: (route) => {
      void client.invalidateQueries({ queryKey: ["routes"] });
      void client.invalidateQueries({ queryKey: ["route", route.id] });
      toast.success(id ? "Route saved" : "Route created");
      if (!id) router.replace(`/routes/${route.id}`);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Could not save the route"),
  });

  const remove = useMutation({
    mutationFn: () => api<void>(`admin/routes/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["routes"] });
      toast.success("Route deleted");
      router.push("/routes");
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Could not delete"),
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  function onDragEnd(event: DragEndEvent) {
    const { active: from, over } = event;
    if (!over || from.id === over.id) return;
    setStops((current) => arrayMove(current, current.findIndex((s) => s.key === from.id), current.findIndex((s) => s.key === over.id)));
  }

  const editable = can("ROUTES_WRITE");
  const mapStops: BuilderStop[] = stops.map((s) => ({ key: s.key, label: text(s.name), location: s.location, kind: s.kind }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (stops.length < 2) return toast.error("A route needs at least two stops.");
        save.mutate();
      }}
    >
      <PageHeader
        back={{ href: "/routes", label: "Routes" }}
        title={id ? text(draft.name) || "Route" : "New route"}
        subtitle={
          stops.length < 2
            ? "Add at least two stops."
            : `${stops.length} stops · ${preview.data ? `${preview.data.distanceKm.toFixed(1)} km · ${duration(preview.data.durationMinutes)}` : "measuring…"}`
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_1fr]">
        <div className="space-y-4">
          <Section title="Stops" description="Drag to reorder. The order is the day.">
            {stops.length === 0 ? (
              <p className="text-sm text-ink-muted">No stops yet. Add them from the list below.</p>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={stops.map((s) => s.key)} strategy={verticalListSortingStrategy}>
                  <ol className="space-y-1.5">
                    {stops.map((stop, i) => (
                      <StopRow
                        key={stop.key}
                        stop={stop}
                        index={i}
                        active={active === stop.key}
                        travel={preview.data?.nodes[i]}
                        editable={editable}
                        onSelect={() => setActive(stop.key)}
                        onStay={(stayMinutes) => setStops((current) => current.map((s) => (s.key === stop.key ? { ...s, stayMinutes } : s)))}
                        onRemove={() => setStops((current) => current.filter((s) => s.key !== stop.key))}
                      />
                    ))}
                  </ol>
                </SortableContext>
              </DndContext>
            )}
          </Section>

          {editable ? <PlacePicker places={places} chosen={new Set(stops.map((s) => s.key))} onAdd={(stop) => setStops((current) => [...current, stop])} /> : null}
        </div>

        <div className="space-y-4">
          <BuilderMap stops={mapStops} path={preview.data?.path} active={active} onSelect={setActive} height={520} />

          <fieldset disabled={!editable} className="space-y-4">
            <Section title="How it is sold">
              <div className="grid gap-4">
                <LocalizedInput label="Name" value={draft.name} onChange={(name) => setDraft({ ...draft, name })} />
                <LocalizedInput label="Tagline" value={draft.tagline} onChange={(tagline) => setDraft({ ...draft, tagline })} hint="One line under the title on the card." />
                <LocalizedInput label="Description" multiline rows={5} value={draft.description} onChange={(description) => setDraft({ ...draft, description })} />
                <LocalizedListInput label="Highlights" value={draft.highlights} onChange={(highlights) => setDraft({ ...draft, highlights })} hint="The six lines that sell the day. One per line." />
              </div>
            </Section>

            <Section title="Cover">
              <MediaManager value={draft.cover ? [draft.cover] : []} onChange={(media) => setDraft({ ...draft, cover: media[0] })} folder="routes" single />
            </Section>

            <Section title="Filing">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Theme">
                  <select className="field" value={draft.theme} onChange={(e) => setDraft({ ...draft, theme: e.target.value as RouteTheme })}>
                    {ROUTE_THEMES.map((theme) => (
                      <option key={theme} value={theme}>
                        {theme.replace(/_/g, " ").toLowerCase()}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Pace">
                  <select className="field" value={draft.pace} onChange={(e) => setDraft({ ...draft, pace: e.target.value as RoutePace })}>
                    {PACES.map((pace) => (
                      <option key={pace} value={pace}>
                        {pace.toLowerCase()}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Slug" hint="Leave empty to build one from the name.">
                  <input className="field mono" value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} maxLength={80} />
                </Field>
                <Field label="Status">
                  <select className="field" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as Draft["status"] })}>
                    <option value="DRAFT">Draft</option>
                    <option value="PUBLISHED">Published</option>
                    <option value="ARCHIVED">Archived</option>
                  </select>
                </Field>
              </div>
              <div className="mt-4">
                <Toggle label="Feature on the landing page" description="Featured routes lead the website." checked={draft.featured} onChange={(featured) => setDraft({ ...draft, featured })} />
              </div>
            </Section>
          </fieldset>
        </div>
      </div>

      {editable ? (
        <div className="sticky bottom-4 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-panel border border-line bg-surface/90 p-3 backdrop-blur-xl">
          {id ? <ConfirmButton label="Delete route" confirmLabel="Delete this route? Departures already scheduled on it will lose their itinerary." onConfirm={() => remove.mutate()} /> : <span />}
          <button type="submit" className="btn btn-primary" disabled={save.isPending || stops.length < 2}>
            <FloppyDisk size={16} /> {save.isPending ? "Saving" : id ? "Save the route" : "Create the route"}
          </button>
        </div>
      ) : null}
    </form>
  );
}

/* ------------------------------------------------------------------ stop row */

function StopRow({
  stop,
  index,
  active,
  travel,
  editable,
  onSelect,
  onStay,
  onRemove,
}: {
  stop: Stop;
  index: number;
  active: boolean;
  travel?: { travelMinutes: number; travelKm: number };
  editable: boolean;
  onSelect: () => void;
  onStay: (minutes: number) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stop.key, disabled: !editable });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={clsx("relative", isDragging && "z-10")}>
      {index > 0 && travel ? (
        <p className="py-1 pl-9 text-[0.72rem] text-ink-faint tnum">
          {travel.travelMinutes} min · {travel.travelKm.toFixed(1)} km
        </p>
      ) : null}
      <div
        onClick={onSelect}
        className={clsx(
          "flex items-center gap-2 rounded-control border p-2 transition-colors",
          active ? "border-accent bg-accent-soft" : "border-line bg-surface hover:border-line-strong",
          isDragging && "shadow-lg",
        )}
      >
        {editable ? (
          <button type="button" className="btn btn-ghost btn-icon btn-sm cursor-grab active:cursor-grabbing" aria-label={`Reorder ${text(stop.name)}`} {...attributes} {...listeners}>
            <DotsSixVertical size={16} />
          </button>
        ) : null}
        <span className={clsx("grid h-6 w-6 shrink-0 place-items-center rounded-pill text-[0.7rem] font-bold tnum", stop.kind === "BUSINESS" ? "bg-accent text-on-accent" : "bg-ink text-surface")}>{index + 1}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{text(stop.name)}</p>
          <p className="truncate text-xs text-ink-faint">
            {stop.district}
            {stop.kind === "BUSINESS" ? " · partner" : ""}
          </p>
        </div>
        <label className="flex shrink-0 items-center gap-1 text-xs text-ink-faint">
          <input
            className="field tnum w-[62px] px-2 py-1 text-center"
            type="number"
            min={0}
            max={600}
            value={stop.stayMinutes}
            disabled={!editable}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onStay(Number(e.target.value))}
          />
          min
        </label>
        {editable ? (
          <button type="button" className="btn btn-ghost btn-icon btn-sm text-danger" aria-label={`Remove ${text(stop.name)}`} onClick={(e) => { e.stopPropagation(); onRemove(); }}>
            <Trash size={15} />
          </button>
        ) : null}
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ picker */

function PlacePicker({ places, chosen, onAdd }: { places: ReturnType<typeof usePlaces>; chosen: Set<string>; onAdd: (stop: Stop) => void }) {
  const [q, setQ] = useState("");
  const matches = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase("tr");
    return places.all
      .filter((p) => !chosen.has(`${p.kind}:${p.id}`))
      .filter((p) => !needle || text(p.name).toLocaleLowerCase("tr").includes(needle) || p.district.toLocaleLowerCase("tr").includes(needle))
      .slice(0, 40);
  }, [places.all, chosen, q]);

  return (
    <Section title="Add a stop" description="Attractions and partner venues that are published.">
      <div className="relative">
        <MagnifyingGlass size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
        <input className="field pl-9" placeholder="Search by name or district" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <ul className="mt-3 max-h-[340px] space-y-1 overflow-y-auto pr-1">
        {matches.map((place) => (
          <li key={`${place.kind}:${place.id}`}>
            <button
              type="button"
              className="flex w-full items-center gap-2.5 rounded-control p-2 text-left transition-colors hover:bg-surface-2"
              onClick={() =>
                onAdd({
                  key: `${place.kind}:${place.id}`,
                  kind: place.kind,
                  refId: place.id,
                  stayMinutes: place.visitMinutes ?? 45,
                  name: place.name,
                  district: place.district,
                  location: place.location,
                })
              }
            >
              {place.kind === "BUSINESS" ? <Storefront size={16} className="shrink-0 text-accent" /> : <span className="h-1.5 w-1.5 shrink-0 rounded-pill bg-ink-faint" />}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{text(place.name)}</span>
                <span className="block truncate text-xs text-ink-faint">{place.district}</span>
              </span>
              <span className="shrink-0 text-xs text-ink-faint tnum">{place.visitMinutes ?? 45} min</span>
            </button>
          </li>
        ))}
        {matches.length === 0 ? <li className="px-2 py-4 text-sm text-ink-muted">Nothing left to add.</li> : null}
      </ul>
    </Section>
  );
}

/* ------------------------------------------------------------------ data */

interface PlaceOption {
  id: string;
  kind: RouteNodeKind;
  name: LocalizedText;
  district: string;
  location: { lat: number; lng: number };
  visitMinutes?: number;
}

function usePlaces() {
  const attractions = useQuery({ queryKey: ["attractions", "options"], queryFn: () => api<Paginated<AttractionDto>>("admin/attractions?pageSize=200") });
  const businesses = useQuery({ queryKey: ["businesses", "options"], queryFn: () => api<Paginated<BusinessDto>>("admin/businesses?pageSize=200") });
  const all = useMemo<PlaceOption[]>(
    () => [
      ...(attractions.data?.items ?? []).map((a) => ({ id: a.id, kind: "ATTRACTION" as const, name: a.name, district: a.district, location: a.location, visitMinutes: a.visitMinutes })),
      ...(businesses.data?.items ?? []).map((b) => ({ id: b.id, kind: "BUSINESS" as const, name: b.name, district: b.district, location: b.location, visitMinutes: b.visitMinutes })),
    ],
    [attractions.data, businesses.data],
  );
  const byId = useMemo(() => new Map(all.map((p) => [p.id, p])), [all]);
  return { all, byId, loading: attractions.isLoading || businesses.isLoading };
}

/**
 * Distances and times come from the same endpoint the save will use, so the builder
 * never shows a number the stored route will disagree with. Requests are debounced
 * because dragging a stop fires a change per frame.
 */
function usePreview(stops: Stop[]) {
  const signature = stops.map((s) => `${s.kind}:${s.refId}:${s.stayMinutes}`).join("|");
  const [settled, setSettled] = useState(signature);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setSettled(signature), 400);
    return () => clearTimeout(timer.current);
  }, [signature]);

  return useQuery({
    queryKey: ["route-preview", settled],
    enabled: stops.length >= 2 && settled === signature,
    queryFn: () =>
      api<{ nodes: { travelMinutes: number; travelKm: number }[]; path?: GeoJsonLineString; distanceKm: number; durationMinutes: number }>("admin/routes/preview", {
        method: "POST",
        body: { nodes: stops.map((s) => ({ kind: s.kind, refId: s.refId, stayMinutes: s.stayMinutes })) },
      }),
    staleTime: 5 * 60_000,
  });
}
