"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CopySimple, FloppyDisk, BookmarkSimple } from "@phosphor-icons/react";
import { api, ApiError } from "@/lib/api";
import type { BookingDetailDto, TourDetailDto, TourDto, TourStatus, TourTemplateDto } from "@/lib/contract/api";
import { dateTime, fromLocalInput, money, text, timeOnly, toLocalInput } from "@/lib/format";
import { useAdmin } from "@/lib/session/context";
import { ConfirmButton, EmptyState, Field, PageHeader, Section, Sheet, Skeleton, StatusBadge } from "@/components/ui/primitives";
import { TourCoreFields, useCoreOptions, type TourCoreDraft } from "./tour-core-fields";

/**
 * One departure: its settings, who is on it, and the two shortcuts that make running a
 * season bearable — duplicate it onto another day, or save it as a template so the next
 * one only needs a guide changed.
 */
export function TourDetailView({ id }: { id: string }) {
  const options = useCoreOptions();
  const { data, isLoading, error } = useQuery({ queryKey: ["tour", id], queryFn: () => api<TourDetailDto>(`admin/tours/${id}`) });

  if (isLoading || options.loading) return <Skeleton rows={12} />;
  if (error || !data) return <EmptyState title="Departure not found" body="It may have been deleted." action={<Link href="/tours" className="btn btn-secondary">Back to tours</Link>} />;
  // The editor owns its draft from the moment it mounts, so nothing has to be synced after.
  return <TourDetail tour={data} options={options} />;
}

function TourDetail({ tour: data, options }: { tour: TourDetailDto; options: ReturnType<typeof useCoreOptions> }) {
  const id = data.id;
  const { can } = useAdmin();
  const router = useRouter();
  const client = useQueryClient();
  const [draft, setDraft] = useState<TourCoreDraft>(() => core(data));
  const [startsAt, setStartsAt] = useState(() => toLocalInput(data.startsAt));
  const [duplicating, setDuplicating] = useState(false);
  const [templating, setTemplating] = useState(false);

  const { data: manifest } = useQuery({ queryKey: ["tour", id, "bookings"], queryFn: () => api<BookingDetailDto[]>(`admin/bookings/tour/${id}`) });

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => api<TourDto>(`admin/tours/${id}`, { method: "PATCH", body }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["tour", id] });
      void client.invalidateQueries({ queryKey: ["tours"] });
      toast.success("Departure saved");
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Could not save"),
  });

  const setStatus = useMutation({
    mutationFn: (status: TourStatus) => api<TourDto>(`admin/tours/${id}/status`, { method: "POST", body: { status } }),
    onSuccess: (_next, status) => {
      void client.invalidateQueries({ queryKey: ["tour", id] });
      void client.invalidateQueries({ queryKey: ["tours"] });
      void client.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(status === "PUBLISHED" ? "Published, it is on sale now" : `Moved to ${status.toLowerCase()}`);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Could not change the status"),
  });

  const duplicate = useMutation({
    mutationFn: (body: { startsAt: string; guideId?: string; vehicleId?: string }) => api<TourDto>(`admin/tours/${id}/duplicate`, { method: "POST", body }),
    onSuccess: (created) => {
      setDuplicating(false);
      toast.success("Copied to a new departure");
      router.push(`/tours/${created.id}`);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Could not duplicate"),
  });

  const saveTemplate = useMutation({
    mutationFn: (name: string) => api<TourTemplateDto>(`admin/tours/${id}/save-template`, { method: "POST", body: { name } }),
    onSuccess: (template) => {
      setTemplating(false);
      void client.invalidateQueries({ queryKey: ["templates"] });
      toast.success(`Saved as “${template.name}”`);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Could not save the template"),
  });

  const remove = useMutation({
    mutationFn: () => api<void>(`admin/tours/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["tours"] });
      toast.success("Departure deleted");
      router.push("/tours");
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Could not delete"),
  });

  const editable = can("TOURS_WRITE") && data.status !== "COMPLETED";
  const sold = manifest?.filter((b) => b.status === "CONFIRMED" || b.status === "AWAITING_APPROVAL") ?? [];

  return (
    <>
      <PageHeader
        back={{ href: "/tours", label: "Tours" }}
        title={text(data.route.name)}
        subtitle={`${dateTime(data.startsAt)} · ${data.guide.displayName} · ${data.vehicle.name}`}
        actions={
          <>
            <StatusBadge value={data.status} />
            {can("TOURS_WRITE") ? (
              <>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setTemplating(true)}>
                  <BookmarkSimple size={15} /> Save as template
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDuplicating(true)}>
                  <CopySimple size={15} /> Duplicate
                </button>
              </>
            ) : null}
            {can("TOURS_PUBLISH") && data.status === "DRAFT" ? (
              <button type="button" className="btn btn-primary btn-sm" disabled={setStatus.isPending} onClick={() => setStatus.mutate("PUBLISHED")}>
                Publish
              </button>
            ) : null}
            {can("TOURS_PUBLISH") && data.status === "PUBLISHED" ? (
              <ConfirmButton
                label="Cancel departure"
                confirmLabel={sold.length ? `${sold.length} booking(s) are on this departure. Cancel it anyway?` : "Cancel this departure?"}
                onConfirm={() => setStatus.mutate("CANCELLED")}
                className="btn btn-secondary btn-sm"
              />
            ) : null}
          </>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Seats sold" value={`${data.bookedSeats}/${data.seatCount}`} sub={`${data.seatsLeft} still free`} />
        <Tile label="Leaves" value={timeOnly(data.startsAt)} sub={dateTime(data.startsAt).replace(/, \d{2}:\d{2}$/, "")} />
        <Tile label="Returns" value={timeOnly(data.endsAt)} sub={`${data.durationMinutes ?? data.route.durationMinutes} min on the road`} />
        <Tile label="Taken" value={money(sold.reduce((sum, b) => sum + b.total, 0), data.pricing.currency)} sub={`${sold.length} bookings`} />
      </div>

      <Section title="Who is on it" description="Every booking against this departure." className="mb-6">
        {!manifest?.length ? (
          <p className="text-sm text-ink-muted">Nobody has booked yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Guest</th>
                <th>Seats</th>
                <th className="text-right">Total</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {manifest.map((booking) => (
                <tr key={booking.id}>
                  <td className="mono">{booking.ticketCode}</td>
                  <td className="max-w-[200px] truncate">
                    {booking.contact.fullName}
                    <span className="block text-xs text-ink-faint">{booking.contact.phone}</span>
                  </td>
                  <td className="mono text-xs">{booking.passengers.map((p) => p.seatLabel).join(" ")}</td>
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
        )}
      </Section>

      <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate({ ...draft, startsAt: fromLocalInput(startsAt) });
          }}
        >
          <fieldset disabled={!editable} className="space-y-6">
            <Section title="When it leaves">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Departure" hint="Istanbul time.">
                  <input className="field" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required />
                </Field>
              </div>
            </Section>
            <TourCoreFields value={draft} onChange={setDraft} options={options} />
          </fieldset>

          {editable ? (
            <div className="sticky bottom-4 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-panel border border-line bg-surface/90 p-3 backdrop-blur-xl">
              <ConfirmButton
                label="Delete departure"
                confirmLabel={sold.length ? "This departure has bookings and cannot be deleted. Try cancelling it instead." : "Delete this departure for good?"}
                disabled={sold.length > 0}
                onConfirm={() => remove.mutate()}
              />
              <button type="submit" className="btn btn-primary" disabled={save.isPending}>
                <FloppyDisk size={16} /> {save.isPending ? "Saving" : "Save changes"}
              </button>
            </div>
          ) : null}
      </form>

      <DuplicateSheet open={duplicating} onClose={() => setDuplicating(false)} tour={data} options={options} busy={duplicate.isPending} onSubmit={(body) => duplicate.mutate(body)} />
      <TemplateSheet open={templating} onClose={() => setTemplating(false)} suggestion={text(data.route.name)} busy={saveTemplate.isPending} onSubmit={(name) => saveTemplate.mutate(name)} />
    </>
  );
}

export function core(tour: TourDetailDto): TourCoreDraft {
  return {
    routeId: tour.routeId,
    vehicleId: tour.vehicleId,
    guideId: tour.guideId,
    meetingPoint: tour.meetingPoint,
    languages: tour.languages,
    pricing: tour.pricing,
    inclusions: tour.inclusions,
    exclusions: tour.exclusions,
    contactPhone: tour.contactPhone,
    whatsapp: tour.whatsapp,
    cancellationPolicy: tour.cancellationPolicy,
    blockedSeats: tour.blockedSeats,
    minPassengers: tour.minPassengers,
    durationMinutes: tour.durationMinutes,
    internalNotes: tour.internalNotes,
  };
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="panel p-5">
      <p className="eyebrow">{label}</p>
      <p className="mt-2 text-[1.75rem] font-semibold leading-none tracking-[-0.03em] tnum">{value}</p>
      {sub ? <p className="mt-2.5 text-xs text-ink-faint">{sub}</p> : null}
    </div>
  );
}

/** The everyday case: the same day out, another date, often another guide. */
function DuplicateSheet({
  open,
  onClose,
  tour,
  options,
  busy,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  tour: TourDetailDto;
  options: ReturnType<typeof useCoreOptions>;
  busy: boolean;
  onSubmit: (body: { startsAt: string; guideId?: string; vehicleId?: string }) => void;
}) {
  const [when, setWhen] = useState(toLocalInput(tour.startsAt));
  const [guideId, setGuideId] = useState(tour.guideId);
  const [vehicleId, setVehicleId] = useState(tour.vehicleId);
  return (
    <Sheet open={open} onClose={onClose} title="Duplicate this departure">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ startsAt: fromLocalInput(when), guideId, vehicleId });
        }}
      >
        <p className="text-sm text-ink-muted">Everything is copied — route, prices, meeting point, what is included. Change only what differs.</p>
        <Field label="New departure" hint="Istanbul time.">
          <input className="field" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} required autoFocus />
        </Field>
        <Field label="Guide">
          <select className="field" value={guideId} onChange={(e) => setGuideId(e.target.value)}>
            {options.guides.map((g) => (
              <option key={g.id} value={g.id}>
                {g.displayName}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Vehicle">
          <select className="field" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
            {options.vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </Field>
        <p className="hint">The copy starts as a draft, so nothing goes on sale until you publish it.</p>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Copying" : "Create the copy"}
          </button>
        </div>
      </form>
    </Sheet>
  );
}

function TemplateSheet({ open, onClose, suggestion, busy, onSubmit }: { open: boolean; onClose: () => void; suggestion: string; busy: boolean; onSubmit: (name: string) => void }) {
  const [name, setName] = useState(suggestion);
  return (
    <Sheet open={open} onClose={onClose} title="Save as a template">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onSubmit(name.trim());
        }}
      >
        <p className="text-sm text-ink-muted">
          The whole configuration is stored under a name. From the templates page you can then roll out a season of departures in one go, changing only the dates and the guide.
        </p>
        <Field label="Name">
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required autoFocus />
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy || !name.trim()}>
            {busy ? "Saving" : "Save the template"}
          </button>
        </div>
      </form>
    </Sheet>
  );
}
