"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { clsx } from "clsx";
import { ArrowsClockwise, Plus } from "@phosphor-icons/react";
import { api, ApiError } from "@/lib/api";
import type { Paginated, SeatCell, SeatCellKind, SeatMap, VehicleDto, VehicleStatus, VehicleType } from "@/lib/contract/api";
import { text } from "@/lib/format";
import { useAdmin } from "@/lib/session/context";
import { ConfirmButton, EmptyState, Field, LocalizedInput, PageHeader, Section, Sheet, Skeleton, StatusBadge, TagsInput } from "@/components/ui/primitives";
import { MediaManager } from "@/components/ui/media-manager";

const TYPES: VehicleType[] = ["MINIBUS", "BUS", "VAN", "BOAT", "YACHT", "CAR"];
const STATUSES: VehicleStatus[] = ["ACTIVE", "MAINTENANCE", "RETIRED"];

function blank(): VehicleDto {
  const now = new Date().toISOString();
  return {
    id: "",
    name: "",
    type: "MINIBUS",
    seatMap: { rows: 0, cols: 0, cells: [] },
    seatCount: 0,
    amenities: [],
    description: {},
    media: [],
    status: "ACTIVE",
    createdAt: now,
    updatedAt: now,
  };
}

export function VehiclesView() {
  const { can } = useAdmin();
  const [editing, setEditing] = useState<VehicleDto | null>(null);
  const { data, isLoading, error } = useQuery({ queryKey: ["vehicles"], queryFn: () => api<Paginated<VehicleDto>>("admin/vehicles?pageSize=200") });
  const editable = can("FLEET_WRITE");

  return (
    <>
      <PageHeader
        title="Vehicles"
        subtitle="The fleet, and the seat plan each one sells."
        actions={editable ? <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing(blank())}><Plus size={15} weight="bold" /> New vehicle</button> : null}
      />

      {isLoading ? (
        <Skeleton rows={6} />
      ) : error || !data ? (
        <EmptyState title="Vehicles unavailable" body="The API did not answer." />
      ) : data.items.length === 0 ? (
        <EmptyState title="No vehicles" body="Add the first one." action={editable ? <button type="button" className="btn btn-primary" onClick={() => setEditing(blank())}>Add a vehicle</button> : undefined} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.items.map((vehicle) => (
            <article key={vehicle.id} className="panel panel-lift overflow-hidden">
              <button type="button" className="block w-full text-left" onClick={() => editable && setEditing(vehicle)}>
                <span className="relative block aspect-[16/9] w-full overflow-hidden bg-surface-2">
                  {vehicle.media[0] ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={vehicle.media[0].thumbnailUrl ?? vehicle.media[0].url} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : null}
                  <span className="badge-on-media absolute left-2.5 top-2.5">
                    <StatusBadge value={vehicle.status} />
                  </span>
                </span>
                <span className="block p-4">
                  <span className="block font-semibold tracking-[-0.014em]">{vehicle.name}</span>
                  <span className="mt-0.5 block text-xs text-ink-faint">
                    {vehicle.type.toLowerCase()} · {vehicle.seatCount} seats
                    {vehicle.make ? ` · ${vehicle.make} ${vehicle.model ?? ""}` : ""}
                  </span>
                  <span className="mt-2 block line-clamp-2 text-sm text-ink-muted">{text(vehicle.description)}</span>
                </span>
              </button>
              {editable ? (
                <div className="border-t border-line px-3 py-2">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(vehicle)}>
                    Edit and plan seats
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}

      <Sheet open={Boolean(editing)} onClose={() => setEditing(null)} title={editing?.id ? editing.name : "New vehicle"} wide>
        {editing ? <VehicleEditor value={editing} onClose={() => setEditing(null)} /> : null}
      </Sheet>
    </>
  );
}

function VehicleEditor({ value, onClose }: { value: VehicleDto; onClose: () => void }) {
  const client = useQueryClient();
  const [form, setForm] = useState(value);
  const isNew = !value.id;
  const set = <K extends keyof VehicleDto>(key: K, next: VehicleDto[K]) => setForm((f) => ({ ...f, [key]: next }));
  const seats = form.seatMap.cells.filter((c) => c.kind === "SEAT").length;

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name,
        type: form.type,
        make: form.make || undefined,
        model: form.model || undefined,
        year: form.year || undefined,
        plate: form.plate || undefined,
        seatMap: form.seatMap,
        amenities: form.amenities,
        description: form.description,
        media: form.media,
        status: form.status,
      };
      return isNew ? api<VehicleDto>("admin/vehicles", { method: "POST", body }) : api<VehicleDto>(`admin/vehicles/${form.id}`, { method: "PATCH", body });
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["vehicles"] });
      toast.success(isNew ? "Vehicle added" : "Vehicle saved");
      onClose();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Could not save"),
  });

  const remove = useMutation({
    mutationFn: () => api<void>(`admin/vehicles/${value.id}`, { method: "DELETE" }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["vehicles"] });
      toast.success("Vehicle deleted");
      onClose();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Could not delete"),
  });

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (!seats) return toast.error("Lay out at least one seat.");
        save.mutate();
      }}
    >
      <Section title="The vehicle">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Name" hint="What operations calls it.">
            <input className="field" value={form.name} onChange={(e) => set("name", e.target.value)} maxLength={80} required />
          </Field>
          <Field label="Type">
            <select className="field" value={form.type} onChange={(e) => set("type", e.target.value as VehicleType)}>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.toLowerCase()}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select className="field" value={form.status} onChange={(e) => set("status", e.target.value as VehicleStatus)}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.toLowerCase()}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Make">
            <input className="field" value={form.make ?? ""} onChange={(e) => set("make", e.target.value)} maxLength={60} />
          </Field>
          <Field label="Model">
            <input className="field" value={form.model ?? ""} onChange={(e) => set("model", e.target.value)} maxLength={60} />
          </Field>
          <Field label="Year">
            <input className="field tnum" type="number" min={1980} max={2100} value={form.year ?? ""} onChange={(e) => set("year", e.target.value ? Number(e.target.value) : undefined)} />
          </Field>
          <Field label="Plate">
            <input className="field mono" value={form.plate ?? ""} onChange={(e) => set("plate", e.target.value)} maxLength={20} />
          </Field>
          <TagsInput label="Amenities" value={form.amenities} onChange={(amenities) => set("amenities", amenities)} placeholder="wifi, usb, water" />
        </div>
        <div className="mt-4">
          <LocalizedInput label="Description" multiline rows={3} value={form.description} onChange={(description) => set("description", description)} />
        </div>
      </Section>

      <Section title="Seat plan" description={`${seats} sellable seat${seats === 1 ? "" : "s"}. Generate a layout, then click any cell to change what it is.`}>
        <SeatMapEditor value={form.seatMap} onChange={(seatMap) => set("seatMap", seatMap)} />
      </Section>

      <Section title="Photos">
        <MediaManager value={form.media} onChange={(media) => set("media", media)} folder="vehicles" />
      </Section>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        {isNew ? <span /> : <ConfirmButton label="Delete" confirmLabel="Delete this vehicle? Departures already using it keep their seat plan." onConfirm={() => remove.mutate()} />}
        <div className="flex gap-2">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={save.isPending}>
            {save.isPending ? "Saving" : isNew ? "Add the vehicle" : "Save"}
          </button>
        </div>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ seat map */

/** Cycled through when a cell is clicked; the order matches how a plan is usually corrected. */
const CYCLE: SeatCellKind[] = ["SEAT", "AISLE", "EMPTY", "DOOR", "TABLE", "DRIVER", "GUIDE"];

const KIND_SHORT: Record<SeatCellKind, string> = { SEAT: "", AISLE: "", EMPTY: "", DOOR: "Door", TABLE: "Tbl", DRIVER: "Drv", GUIDE: "Gd" };

/**
 * The generator lays a conventional coach out in one go; the grid then lets a real
 * vehicle's quirks in — a door mid-row, a table on a yacht, a missing seat.
 */
function SeatMapEditor({ value, onChange }: { value: SeatMap; onChange: (next: SeatMap) => void }) {
  const [rows, setRows] = useState(Math.max(1, value.rows || 4));
  const [left, setLeft] = useState(2);
  const [right, setRight] = useState(2);
  const [premiumRows, setPremiumRows] = useState(1);
  const [fullBackRow, setFullBackRow] = useState(false);
  const [withDriverRow, setWithDriverRow] = useState(true);

  const generate = useMutation({
    mutationFn: () => api<SeatMap>("admin/vehicles/seat-map/generate", { method: "POST", body: { rows, left, right, premiumRows, fullBackRow, withDriverRow } }),
    onSuccess: (map) => onChange(map),
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Could not generate the plan"),
  });

  function cycle(row: number, col: number) {
    const cells = value.cells.slice();
    const index = cells.findIndex((c) => c.row === row && c.col === col);
    const current = index >= 0 ? cells[index] : ({ row, col, kind: "EMPTY" } as SeatCell);
    const next = CYCLE[(CYCLE.indexOf(current.kind) + 1) % CYCLE.length];
    // A cell that stops being a seat must lose its label, or the plan sells a seat that is a door.
    const updated: SeatCell = { row, col, kind: next, ...(next === "SEAT" ? { label: current.label ?? nextLabel(cells, row, col), premium: current.premium } : {}) };
    if (index >= 0) cells[index] = updated;
    else cells.push(updated);
    onChange({ ...value, cells });
  }

  function togglePremium(row: number, col: number) {
    onChange({ ...value, cells: value.cells.map((c) => (c.row === row && c.col === col && c.kind === "SEAT" ? { ...c, premium: !c.premium } : c)) });
  }

  return (
    <>
      <div className="flex flex-wrap items-end gap-3 rounded-control border border-line p-3">
        <Field label="Rows" className="w-[84px]">
          <input className="field tnum" type="number" min={1} max={30} value={rows} onChange={(e) => setRows(Number(e.target.value))} />
        </Field>
        <Field label="Left" className="w-[84px]">
          <input className="field tnum" type="number" min={0} max={4} value={left} onChange={(e) => setLeft(Number(e.target.value))} />
        </Field>
        <Field label="Right" className="w-[84px]">
          <input className="field tnum" type="number" min={0} max={4} value={right} onChange={(e) => setRight(Number(e.target.value))} />
        </Field>
        <Field label="Premium rows" className="w-[120px]">
          <input className="field tnum" type="number" min={0} max={10} value={premiumRows} onChange={(e) => setPremiumRows(Number(e.target.value))} />
        </Field>
        <label className="flex h-10 items-center gap-2 text-sm">
          <input type="checkbox" checked={fullBackRow} onChange={(e) => setFullBackRow(e.target.checked)} /> Full back row
        </label>
        <label className="flex h-10 items-center gap-2 text-sm">
          <input type="checkbox" checked={withDriverRow} onChange={(e) => setWithDriverRow(e.target.checked)} /> Driver row
        </label>
        <button type="button" className="btn btn-secondary" disabled={generate.isPending} onClick={() => generate.mutate()}>
          <ArrowsClockwise size={15} /> {value.cells.length ? "Replace the plan" : "Generate"}
        </button>
      </div>

      {value.cells.length ? (
        <>
          <div className="mt-4 inline-grid gap-1 rounded-control bg-surface-2 p-3" style={{ gridTemplateColumns: `repeat(${value.cols}, minmax(0, 2.5rem))` }}>
            {Array.from({ length: value.rows * value.cols }, (_, i) => {
              const row = Math.floor(i / value.cols);
              const col = i % value.cols;
              const cell = value.cells.find((c) => c.row === row && c.col === col);
              const kind = cell?.kind ?? "EMPTY";
              return (
                <button
                  key={i}
                  type="button"
                  onClick={(e) => (e.altKey ? togglePremium(row, col) : cycle(row, col))}
                  title={`${kind.toLowerCase()}${cell?.label ? ` ${cell.label}` : ""} — click to change, alt-click to mark premium`}
                  className={clsx(
                    "grid h-10 place-items-center rounded-control border text-[0.7rem] font-medium tnum transition-colors",
                    kind === "SEAT" && (cell?.premium ? "border-accent bg-accent-soft text-ink" : "border-line-strong bg-surface text-ink"),
                    kind === "AISLE" && "border-transparent bg-transparent",
                    kind === "EMPTY" && "border-dashed border-line text-ink-faint",
                    (kind === "DRIVER" || kind === "GUIDE" || kind === "DOOR" || kind === "TABLE") && "border-dashed border-line-strong bg-surface text-ink-faint uppercase",
                  )}
                >
                  {kind === "SEAT" ? cell?.label : KIND_SHORT[kind]}
                </button>
              );
            })}
          </div>
          <p className="hint mt-2">Click a cell to cycle seat → aisle → empty → door → table → driver → guide. Alt-click a seat to make it premium.</p>
        </>
      ) : (
        <p className="mt-4 text-sm text-ink-muted">No plan yet. Set the shape above and generate one.</p>
      )}
    </>
  );
}

/** Row letter and column index, matching how the generator labels a coach. */
function nextLabel(cells: SeatCell[], row: number, col: number): string {
  const letters = "ABCDEF";
  const seatsBefore = cells.filter((c) => c.kind === "SEAT" && c.row === row && c.col < col).length;
  return `${row + 1}${letters[seatsBefore] ?? String(col)}`;
}
