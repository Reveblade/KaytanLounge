"use client";

import { useQuery } from "@tanstack/react-query";
import { clsx } from "clsx";
import { Plus, Trash } from "@phosphor-icons/react";
import { api } from "@/lib/api";
import { PRICE_TIER_KEYS } from "@/lib/contract/api";
import type { CurrencyCode, GuideDto, LocalizedText, Paginated, PriceTier, PriceTierKey, RouteDto, SeatMap, TourCore, TourPricing, VehicleDto } from "@/lib/contract/api";
import { text } from "@/lib/format";
import { Field, LocalizedInput, LocalizedListInput, Section } from "@/components/ui/primitives";
import { MapPicker } from "@/components/ui/map-picker";

const CURRENCIES: CurrencyCode[] = ["EUR", "TRY", "USD", "GBP"];

/** ISO 639-1 codes a guide realistically leads a tour in. Free text would be a typo farm. */
const LANGUAGES: { code: string; label: string }[] = [
  { code: "tr", label: "Turkish" },
  { code: "en", label: "English" },
  { code: "de", label: "German" },
  { code: "fr", label: "French" },
  { code: "es", label: "Spanish" },
  { code: "it", label: "Italian" },
  { code: "ru", label: "Russian" },
  { code: "ar", label: "Arabic" },
  { code: "zh", label: "Chinese" },
  { code: "ja", label: "Japanese" },
];

const TIER_LABELS: Record<PriceTierKey, LocalizedText> = {
  ADULT: { en: "Adult", tr: "Yetişkin" },
  CHILD: { en: "Child (6–12)", tr: "Çocuk (6-12)" },
  INFANT: { en: "Infant (0–5)", tr: "Bebek (0-5)" },
  STUDENT: { en: "Student", tr: "Öğrenci" },
  SENIOR: { en: "Senior", tr: "65+" },
};

/** A departure and a template are the same object apart from when they run. */
export type TourCoreDraft = Partial<TourCore>;

export interface CoreOptions {
  routes: RouteDto[];
  vehicles: VehicleDto[];
  guides: GuideDto[];
}

export function useCoreOptions(): CoreOptions & { loading: boolean } {
  const routes = useQuery({ queryKey: ["routes", "options"], queryFn: () => api<Paginated<RouteDto>>("admin/routes?pageSize=200") });
  const vehicles = useQuery({ queryKey: ["vehicles", "options"], queryFn: () => api<Paginated<VehicleDto>>("admin/vehicles?pageSize=200") });
  const guides = useQuery({ queryKey: ["guides", "options"], queryFn: () => api<Paginated<GuideDto>>("admin/guides?pageSize=200") });
  return {
    routes: routes.data?.items ?? [],
    vehicles: vehicles.data?.items ?? [],
    guides: guides.data?.items ?? [],
    loading: routes.isLoading || vehicles.isLoading || guides.isLoading,
  };
}

/** The fields a departure shares with the template it came from. */
export function TourCoreFields({ value, onChange, options }: { value: TourCoreDraft; onChange: (next: TourCoreDraft) => void; options: CoreOptions }) {
  const set = <K extends keyof TourCore>(key: K, next: TourCore[K] | undefined) => onChange({ ...value, [key]: next });
  const vehicle = options.vehicles.find((v) => v.id === value.vehicleId);
  const route = options.routes.find((r) => r.id === value.routeId);
  const guide = options.guides.find((g) => g.id === value.guideId);

  return (
    <div className="space-y-6">
      <Section title="What runs" description="The route, the vehicle it runs in and the guide who leads it.">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Route">
            <select className="field" value={value.routeId ?? ""} onChange={(e) => set("routeId", e.target.value)} required>
              <option value="" disabled>
                Choose a route
              </option>
              {options.routes.map((r) => (
                <option key={r.id} value={r.id}>
                  {text(r.name)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Vehicle" hint={vehicle ? `${vehicle.seatCount} seats` : undefined}>
            <select className="field" value={value.vehicleId ?? ""} onChange={(e) => set("vehicleId", e.target.value)} required>
              <option value="" disabled>
                Choose a vehicle
              </option>
              {options.vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Guide" hint={guide ? guide.languages.join(", ").toUpperCase() : undefined}>
            <select className="field" value={value.guideId ?? ""} onChange={(e) => set("guideId", e.target.value)} required>
              <option value="" disabled>
                Choose a guide
              </option>
              {options.guides.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.displayName}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Field label="Languages on the day" hint="What the guide will actually speak on this departure.">
            <div className="flex flex-wrap gap-1.5">
              {LANGUAGES.map((lang) => {
                const on = (value.languages ?? []).includes(lang.code);
                return (
                  <button
                    key={lang.code}
                    type="button"
                    className={clsx("btn btn-sm", on ? "btn-primary" : "btn-secondary")}
                    onClick={() => set("languages", on ? (value.languages ?? []).filter((l) => l !== lang.code) : [...(value.languages ?? []), lang.code])}
                  >
                    {lang.label}
                  </button>
                );
              })}
            </div>
          </Field>
          <Field label="Duration override" hint={route ? `The route itself takes ${route.durationMinutes} min. Leave empty to use it.` : "Minutes. Leave empty to use the route's own duration."}>
            <input
              className="field"
              type="number"
              min={30}
              max={1440}
              value={value.durationMinutes ?? ""}
              onChange={(e) => set("durationMinutes", e.target.value ? Number(e.target.value) : undefined)}
            />
          </Field>
          <Field label="Minimum passengers" hint="Below this the departure is not worth running. Advisory only.">
            <input className="field" type="number" min={1} value={value.minPassengers ?? ""} onChange={(e) => set("minPassengers", e.target.value ? Number(e.target.value) : undefined)} />
          </Field>
        </div>
      </Section>

      <Section title="Where it starts" description="What the guest is told, and the pin they navigate to.">
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-4">
            <LocalizedInput label="Meeting point" value={value.meetingPoint?.name} onChange={(name) => set("meetingPoint", { ...meeting(value), name })} />
            <Field label="Address">
              <input className="field" value={value.meetingPoint?.address ?? ""} maxLength={300} onChange={(e) => set("meetingPoint", { ...meeting(value), address: e.target.value })} />
            </Field>
            <LocalizedInput
              label="How to find it"
              multiline
              rows={3}
              value={value.meetingPoint?.instructions}
              onChange={(instructions) => set("meetingPoint", { ...meeting(value), instructions })}
              hint="“Under the clock tower, by the ticket booth.” The line that stops a phone call."
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Latitude">
                <input
                  className="field tnum"
                  value={value.meetingPoint?.location?.lat ?? ""}
                  onChange={(e) => set("meetingPoint", { ...meeting(value), location: { lat: Number(e.target.value), lng: value.meetingPoint?.location?.lng ?? 0 } })}
                />
              </Field>
              <Field label="Longitude">
                <input
                  className="field tnum"
                  value={value.meetingPoint?.location?.lng ?? ""}
                  onChange={(e) => set("meetingPoint", { ...meeting(value), location: { lat: value.meetingPoint?.location?.lat ?? 0, lng: Number(e.target.value) } })}
                />
              </Field>
            </div>
          </div>
          <MapPicker value={value.meetingPoint?.location} onChange={(location) => set("meetingPoint", { ...meeting(value), location })} height={380} />
        </div>
      </Section>

      <Section title="Price" description="What each kind of guest pays. Fares are entered in whole currency, stored in minor units.">
        <PricingEditor value={value.pricing} onChange={(pricing) => set("pricing", pricing)} />
      </Section>

      {vehicle ? (
        <Section title="Seats held back" description="Seats that are never sold on this departure — a guide's seat, a broken belt, a seat kept for a partner.">
          <SeatBlocker seatMap={vehicle.seatMap} blocked={value.blockedSeats ?? []} onChange={(blockedSeats) => set("blockedSeats", blockedSeats)} />
        </Section>
      ) : null}

      <Section title="What the guest is told">
        <div className="grid gap-5 lg:grid-cols-2">
          <LocalizedListInput label="Included" value={value.inclusions} onChange={(inclusions) => set("inclusions", inclusions)} />
          <LocalizedListInput label="Not included" value={value.exclusions} onChange={(exclusions) => set("exclusions", exclusions)} />
        </div>
        <div className="mt-4">
          <LocalizedInput label="Cancellation policy" multiline rows={3} value={value.cancellationPolicy} onChange={(cancellationPolicy) => set("cancellationPolicy", cancellationPolicy)} />
        </div>
      </Section>

      <Section title="Who they call">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Contact phone" hint="Printed on the ticket.">
            <input className="field" value={value.contactPhone ?? ""} maxLength={32} onChange={(e) => set("contactPhone", e.target.value)} required />
          </Field>
          <Field label="WhatsApp" hint="Optional. Leave empty to use the contact phone.">
            <input className="field" value={value.whatsapp ?? ""} maxLength={32} onChange={(e) => set("whatsapp", e.target.value)} />
          </Field>
        </div>
        <Field label="Internal notes" hint="Never shown to guests." className="mt-4">
          <textarea className="field" rows={3} maxLength={4000} value={value.internalNotes ?? ""} onChange={(e) => set("internalNotes", e.target.value)} />
        </Field>
      </Section>
    </div>
  );
}

function meeting(value: TourCoreDraft) {
  return value.meetingPoint ?? { name: {} as LocalizedText, location: { lat: 41.0082, lng: 28.9784 } };
}

/* ------------------------------------------------------------------ pricing */

export function PricingEditor({ value, onChange }: { value: TourPricing | undefined; onChange: (next: TourPricing) => void }) {
  const pricing: TourPricing = value ?? { currency: "EUR", premiumSeatSurcharge: 0, tiers: [{ key: "ADULT", label: TIER_LABELS.ADULT, amount: 0 }] };
  const used = new Set(pricing.tiers.map((t) => t.key));
  const available = PRICE_TIER_KEYS.filter((k) => !used.has(k));

  function patch(index: number, next: Partial<PriceTier>) {
    onChange({ ...pricing, tiers: pricing.tiers.map((tier, i) => (i === index ? { ...tier, ...next } : tier)) });
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Currency">
          <select className="field" value={pricing.currency} onChange={(e) => onChange({ ...pricing, currency: e.target.value as CurrencyCode })}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Front-row surcharge" hint="Added once per premium seat chosen.">
          <input
            className="field tnum"
            inputMode="decimal"
            value={major(pricing.premiumSeatSurcharge ?? 0)}
            onChange={(e) => onChange({ ...pricing, premiumSeatSurcharge: minor(e.target.value) })}
          />
        </Field>
      </div>

      <table className="table mt-4">
        <thead>
          <tr>
            <th>Tier</th>
            <th>Label shown to the guest</th>
            <th className="w-[130px]">Fare</th>
            <th className="w-[150px]">Ages</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {pricing.tiers.map((tier, i) => (
            <tr key={tier.key}>
              <td className="font-medium">{tier.key.toLowerCase()}</td>
              <td>
                <div className="grid grid-cols-2 gap-2">
                  <input className="field" value={tier.label.tr ?? ""} placeholder="TR" onChange={(e) => patch(i, { label: { ...tier.label, tr: e.target.value } })} />
                  <input className="field" value={tier.label.en ?? ""} placeholder="EN" onChange={(e) => patch(i, { label: { ...tier.label, en: e.target.value } })} />
                </div>
              </td>
              <td>
                <input className="field tnum" inputMode="decimal" value={major(tier.amount)} onChange={(e) => patch(i, { amount: minor(e.target.value) })} />
              </td>
              <td>
                <div className="grid grid-cols-2 gap-1">
                  <input className="field tnum px-2" placeholder="from" value={tier.minAge ?? ""} onChange={(e) => patch(i, { minAge: e.target.value ? Number(e.target.value) : undefined })} />
                  <input className="field tnum px-2" placeholder="to" value={tier.maxAge ?? ""} onChange={(e) => patch(i, { maxAge: e.target.value ? Number(e.target.value) : undefined })} />
                </div>
              </td>
              <td className="text-right">
                {pricing.tiers.length > 1 ? (
                  <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={`Remove ${tier.key}`} onClick={() => onChange({ ...pricing, tiers: pricing.tiers.filter((_, j) => j !== i) })}>
                    <Trash size={15} />
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {available.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {available.map((key) => (
            <button
              key={key}
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => onChange({ ...pricing, tiers: [...pricing.tiers, { key, label: TIER_LABELS[key], amount: 0 }] })}
            >
              <Plus size={14} weight="bold" /> {key.toLowerCase()}
            </button>
          ))}
        </div>
      ) : null}
    </>
  );
}

function major(amountMinor: number): string {
  return String(amountMinor / 100);
}

function minor(input: string): number {
  const n = Number(input.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : 0;
}

/* ------------------------------------------------------------------ seats */

/** The real seat plan, clickable, so held-back seats are picked off the diagram. */
export function SeatBlocker({ seatMap, blocked, onChange }: { seatMap: SeatMap; blocked: string[]; onChange: (next: string[]) => void }) {
  const held = new Set(blocked);
  return (
    <>
      <div className="inline-grid gap-1 rounded-control bg-surface-2 p-3" style={{ gridTemplateColumns: `repeat(${seatMap.cols}, minmax(0, 2.25rem))` }}>
        {Array.from({ length: seatMap.rows * seatMap.cols }, (_, i) => {
          const row = Math.floor(i / seatMap.cols);
          const col = i % seatMap.cols;
          const cell = seatMap.cells.find((c) => c.row === row && c.col === col);
          if (!cell || cell.kind === "AISLE" || cell.kind === "EMPTY") return <span key={i} />;
          if (cell.kind !== "SEAT") {
            return (
              <span key={i} className="grid h-9 place-items-center rounded-control border border-dashed border-line text-[0.6rem] uppercase text-ink-faint">
                {cell.kind === "DRIVER" ? "Drv" : cell.kind === "GUIDE" ? "Gd" : cell.kind.slice(0, 3)}
              </span>
            );
          }
          const label = cell.label ?? "";
          const on = held.has(label);
          return (
            <button
              key={i}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? blocked.filter((l) => l !== label) : [...blocked, label])}
              className={clsx(
                "grid h-9 place-items-center rounded-control border text-[0.7rem] font-medium tnum transition-colors",
                on ? "border-danger bg-danger-soft text-danger line-through" : cell.premium ? "border-accent/40 bg-accent-soft text-ink" : "border-line bg-surface text-ink-muted hover:border-line-strong",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
      <p className="hint mt-2">
        {blocked.length ? `${blocked.length} held back: ${blocked.join(", ")}` : "Every seat is on sale."}
      </p>
    </>
  );
}
