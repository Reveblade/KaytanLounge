"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarPlus, PencilSimple } from "@phosphor-icons/react";
import { api, ApiError } from "@/lib/api";
import type { TourBatchResultDto, TourTemplateDto } from "@/lib/contract/api";
import { money, text } from "@/lib/format";
import { useAdmin } from "@/lib/session/context";
import { ConfirmButton, EmptyState, Field, PageHeader, Section, Sheet, Skeleton } from "@/components/ui/primitives";
import { TourCoreFields, useCoreOptions, type TourCoreDraft } from "./tour-core-fields";

/**
 * Saved tour configurations. A template is everything about a day out except the day:
 * pick dates, optionally swap the guide, and a season appears on the calendar.
 */
export function TemplatesView() {
  const { can } = useAdmin();
  const client = useQueryClient();
  const options = useCoreOptions();
  const [rollingOut, setRollingOut] = useState<TourTemplateDto | null>(null);
  const [editing, setEditing] = useState<TourTemplateDto | null>(null);

  const { data, isLoading, error } = useQuery({ queryKey: ["templates"], queryFn: () => api<TourTemplateDto[]>("admin/tour-templates") });

  const remove = useMutation({
    mutationFn: (id: string) => api<void>(`admin/tour-templates/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["templates"] });
      toast.success("Template deleted");
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Could not delete"),
  });

  if (isLoading || options.loading) return <Skeleton rows={8} />;
  if (error || !data) return <EmptyState title="Templates unavailable" body="The API did not answer." />;

  return (
    <>
      <PageHeader
        title="Tour templates"
        subtitle="A saved configuration, ready to become any number of departures."
        actions={can("TOURS_WRITE") ? <Link href="/tours/new" className="btn btn-secondary btn-sm">New departure</Link> : null}
      />

      {data.length === 0 ? (
        <EmptyState
          title="No templates yet"
          body="Set a departure up exactly how you want it, then use “Save as template” on it. Every departure after that is a date and a guide."
          action={<Link href="/tours" className="btn btn-primary">Go to tours</Link>}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.map((template) => {
            const route = options.routes.find((r) => r.id === template.routeId);
            const guide = options.guides.find((g) => g.id === template.guideId);
            const vehicle = options.vehicles.find((v) => v.id === template.vehicleId);
            const adult = template.pricing.tiers.find((t) => t.key === "ADULT");
            return (
              <div key={template.id} className="panel panel-lift flex flex-col p-5">
                {/* The eyebrow names the route the template serves; suppressed when the name already says it. */}
                <p className="eyebrow">{!route ? "Route removed" : template.name.startsWith(text(route.name)) ? "Template" : text(route.name)}</p>
                <h3 className="mt-1 text-[1.05rem] font-semibold tracking-[-0.014em]">{template.name}</h3>
                <dl className="mt-4 flex-1 space-y-1.5 text-sm text-ink-muted">
                  <Row label="Starts" value={template.defaultStartTime} />
                  <Row label="Guide" value={guide?.displayName ?? "—"} />
                  <Row label="Vehicle" value={vehicle ? `${vehicle.name} · ${vehicle.seatCount} seats` : "—"} />
                  <Row label="Adult" value={adult ? money(adult.amount, template.pricing.currency) : "—"} />
                  <Row label="Languages" value={template.languages.join(", ").toUpperCase()} />
                </dl>
                {can("TOURS_WRITE") ? (
                  <div className="mt-5 flex flex-wrap gap-1.5">
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => setRollingOut(template)}>
                      <CalendarPlus size={15} /> Schedule dates
                    </button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(template)}>
                      <PencilSimple size={15} /> Edit
                    </button>
                    <ConfirmButton label="Delete" confirmLabel={`Delete “${template.name}”? Departures already created keep running.`} onConfirm={() => remove.mutate(template.id)} className="btn btn-ghost btn-sm text-danger" />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {rollingOut ? <RollOutSheet template={rollingOut} options={options} onClose={() => setRollingOut(null)} /> : null}
      {editing ? <EditSheet template={editing} options={options} onClose={() => setEditing(null)} /> : null}
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt>{label}</dt>
      <dd className="truncate text-right text-ink">{value}</dd>
    </div>
  );
}

/**
 * Dates are picked as calendar days rather than instants: an operator thinks
 * "every Tuesday and Saturday in September", not in ISO timestamps.
 */
function RollOutSheet({ template, options, onClose }: { template: TourTemplateDto; options: ReturnType<typeof useCoreOptions>; onClose: () => void }) {
  const client = useQueryClient();
  const { can } = useAdmin();
  const [dates, setDates] = useState<string[]>([]);
  const [startTime, setStartTime] = useState(template.defaultStartTime);
  const [guideId, setGuideId] = useState(template.guideId);
  const [vehicleId, setVehicleId] = useState(template.vehicleId);
  const [publish, setPublish] = useState(false);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));

  const days = useMemo(() => calendarDays(month), [month]);
  const picked = new Set(dates);

  const create = useMutation({
    mutationFn: () =>
      api<TourBatchResultDto>("admin/tour-templates/instantiate", {
        method: "POST",
        body: { templateId: template.id, dates: [...dates].sort(), startTime, guideId, vehicleId, status: publish ? "PUBLISHED" : "DRAFT" },
      }),
    onSuccess: ({ created, skipped }) => {
      void client.invalidateQueries({ queryKey: ["tours"] });
      void client.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(`${created.length} ${created.length === 1 ? "departure" : "departures"} created`);
      // A clash is normal in a batch; naming the days is the only way to act on it.
      if (skipped.length) {
        toast.warning(`${skipped.length} skipped: ${skipped.map((s) => s.date).join(", ")}`, { description: skipped[0].reason, duration: 10_000 });
      }
      onClose();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Could not create the departures"),
  });

  function toggleWeekday(weekday: number) {
    const matching = days.filter((d) => d.date && new Date(`${d.date}T12:00:00Z`).getUTCDay() === weekday).map((d) => d.date!);
    const allOn = matching.every((d) => picked.has(d));
    setDates(allOn ? dates.filter((d) => !matching.includes(d)) : [...new Set([...dates, ...matching])]);
  }

  return (
    <Sheet open onClose={onClose} title={`Schedule “${template.name}”`} wide>
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (dates.length) create.mutate();
        }}
      >
        <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="label mb-0">Dates</label>
              <input className="field max-w-[160px]" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
            </div>
            <div className="rounded-control border border-line p-3">
              <div className="grid grid-cols-7 gap-1">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label, i) => (
                  <button key={label} type="button" className="pb-1 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-ink-faint hover:text-ink" onClick={() => toggleWeekday((i + 1) % 7)}>
                    {label}
                  </button>
                ))}
                {days.map((day, i) =>
                  day.date ? (
                    <button
                      key={day.date}
                      type="button"
                      onClick={() => setDates(picked.has(day.date!) ? dates.filter((d) => d !== day.date) : [...dates, day.date!])}
                      className={`grid h-9 place-items-center rounded-control text-sm tnum transition-colors ${
                        picked.has(day.date) ? "bg-accent text-on-accent" : day.past ? "text-ink-faint hover:bg-surface-2" : "hover:bg-surface-2"
                      }`}
                    >
                      {Number(day.date.slice(-2))}
                    </button>
                  ) : (
                    <span key={`pad-${i}`} />
                  ),
                )}
              </div>
              <p className="hint mt-2">Click a weekday name to take every one of them in the month.</p>
            </div>
          </div>

          <div className="space-y-4">
            <Field label="Departure time" hint="Istanbul time, applied to every date.">
              <input className="field" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
            </Field>
            <Field label="Guide" hint="The usual reason to reach for a template.">
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
            {can("TOURS_PUBLISH") ? (
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} />
                Publish them straight away
              </label>
            ) : null}
            <p className="hint">
              A date where the guide or the vehicle is already busy is skipped, and you are told which. Nothing is double booked.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <p className="text-sm text-ink-muted">{dates.length ? `${dates.length} ${dates.length === 1 ? "date" : "dates"} selected` : "Pick at least one date."}</p>
          <div className="flex gap-2">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={create.isPending || !dates.length}>
              {create.isPending ? "Creating" : `Create ${dates.length || ""} ${dates.length === 1 ? "departure" : "departures"}`}
            </button>
          </div>
        </div>
      </form>
    </Sheet>
  );
}

function EditSheet({ template, options, onClose }: { template: TourTemplateDto; options: ReturnType<typeof useCoreOptions>; onClose: () => void }) {
  const client = useQueryClient();
  const [name, setName] = useState(template.name);
  const [startTime, setStartTime] = useState(template.defaultStartTime);
  const [draft, setDraft] = useState<TourCoreDraft>(() => {
    const { id: _id, name: _n, defaultStartTime: _d, createdAt: _c, updatedAt: _u, ...core } = template;
    return core;
  });

  const save = useMutation({
    mutationFn: () => api<TourTemplateDto>(`admin/tour-templates/${template.id}`, { method: "PATCH", body: { ...draft, name, defaultStartTime: startTime } }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["templates"] });
      toast.success("Template saved");
      onClose();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Could not save"),
  });

  return (
    <Sheet open onClose={onClose} title={`Edit “${template.name}”`} wide>
      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <Section title="Template">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Name">
              <input className="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />
            </Field>
            <Field label="Usual departure time" hint="Offered as the default when scheduling dates.">
              <input className="field" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
            </Field>
          </div>
        </Section>
        <TourCoreFields value={draft} onChange={setDraft} options={options} />
        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={save.isPending}>
            {save.isPending ? "Saving" : "Save the template"}
          </button>
        </div>
      </form>
    </Sheet>
  );
}

/** A month grid starting on Monday; `null` dates are the leading blanks. */
function calendarDays(month: string): { date: string | null; past: boolean }[] {
  const [year, mon] = month.split("-").map(Number);
  if (!year || !mon) return [];
  const first = new Date(Date.UTC(year, mon - 1, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  const length = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  const today = new Date().toISOString().slice(0, 10);
  const cells: { date: string | null; past: boolean }[] = Array.from({ length: lead }, () => ({ date: null, past: false }));
  for (let day = 1; day <= length; day += 1) {
    const date = `${year}-${String(mon).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    cells.push({ date, past: date < today });
  }
  return cells;
}
