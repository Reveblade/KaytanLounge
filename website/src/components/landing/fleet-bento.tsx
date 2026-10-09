import type { TourDetailDto } from "@/lib/contract/api";
import { languageName } from "@/lib/format";
import { pickText } from "@/lib/i18n/pick";
import type { Dictionary, UiLocale } from "@/lib/i18n/dictionaries";
import { PlaceImage } from "@/components/media/place-image";
import { SeatMapView } from "@/components/booking/seat-map";
import { Item, Reveal, Stagger } from "@/components/motion/reveal";

/**
 * Three cells, three promises: the vehicle, the guide, the seat you choose. The seat
 * plan is the real booking component rendered small, not a picture of one.
 */
export function FleetBento({ t, locale, tour }: { t: Dictionary; locale: UiLocale; tour: TourDetailDto }) {
  const guide = tour.guide;
  const vehicle = tour.vehicle;
  const demoSelected = vehicle.seatMap.cells.filter((c) => c.kind === "SEAT" && c.label).slice(2, 4).map((c) => c.label!);
  return (
    <section className="py-24 sm:py-32">
      <div className="mx-auto max-w-[1440px] px-5 sm:px-8">
        <Reveal>
          <h2 className="display-lg max-w-[16ch]">{t.landing.fleetTitle}</h2>
        </Reveal>
        <Stagger className="mt-12 grid gap-4 md:grid-cols-12 md:grid-rows-2" gap={0.1}>
          <Item className="relative min-h-[440px] overflow-hidden rounded-panel md:col-span-7 md:row-span-2">
            <PlaceImage media={vehicle.media[0]} alt={vehicle.name} mode="inset" sizes="(min-width: 768px) 55vw, 100vw" />
            <div className="absolute inset-0 bg-gradient-to-t from-[rgba(8,9,13,0.6)] via-transparent to-transparent" aria-hidden />
            <div className="glass-frost absolute inset-x-4 bottom-4 rounded-[22px] p-6 text-white">
              <p className="label label-on-dark">{t.explore.vehicle}</p>
              <p className="display-md mt-1">{vehicle.name}</p>
              <p className="mt-1 text-sm text-white/75">{vehicle.seatCount} {t.common.seats.toLowerCase()} · {t.landing.fleetVehicles}</p>
            </div>
          </Item>
          <Item className="relative min-h-[280px] overflow-hidden rounded-panel md:col-span-5">
            {guide.photo ? (
              <>
                <PlaceImage media={guide.photo} alt={guide.displayName} mode="inset" sizes="(min-width: 768px) 40vw, 100vw" />
                <div className="absolute inset-0 bg-gradient-to-t from-[rgba(8,9,13,0.6)] to-transparent" aria-hidden />
              </>
            ) : (
              <GuidePlate guide={guide} locale={locale} />
            )}
            <div className="glass-frost absolute inset-x-4 bottom-4 rounded-[20px] p-5 text-white">
              <p className="label label-on-dark">{t.explore.guide}</p>
              <p className="display-sm mt-1">{guide.displayName}</p>
              <p className="mt-2 text-sm text-white/80">{guide.languages.map((l) => languageName(l, locale)).join(", ")}{guide.yearsExperience ? ` · ${guide.yearsExperience} ${t.explore.experience}` : ""}</p>
            </div>
          </Item>
          <Item className="glass-card flex min-h-[280px] flex-col justify-between rounded-panel p-6 md:col-span-5">
            <div>
              <p className="label">{t.booking.step1}</p>
              <p className="display-sm mt-1">{t.landing.fleetSeats}</p>
            </div>
            <div className="mt-5 overflow-x-auto">
              <SeatMapView seatMap={vehicle.seatMap} selected={demoSelected} unavailable={tour.unavailableSeats} compact labels={{ driver: t.booking.driver, guide: t.booking.guideSeat }} />
            </div>
            <p className="mt-5 text-sm text-ink-muted">{pickText(vehicle.description, locale)}</p>
          </Item>
        </Stagger>
      </div>
    </section>
  );
}

function GuidePlate({ guide, locale }: { guide: TourDetailDto["guide"]; locale: UiLocale }) {
  const initials = guide.displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase("tr-TR") ?? "")
    .join("");
  return (
    <div className="absolute inset-0 bg-[#101218]">
      {/* Two soft lights keep the plate from reading as an empty box while photography is pending. */}
      <div className="absolute inset-0" style={{ background: "radial-gradient(120% 90% at 18% 12%, rgba(255,160,122,0.28), transparent 60%), radial-gradient(90% 70% at 88% 8%, rgba(255,255,255,0.10), transparent 55%)" }} />
      <span className="absolute -left-2 top-[6%] select-none font-semibold leading-[0.8] tracking-[-0.06em] text-white/[0.07] text-[clamp(9rem,22vw,17rem)]" aria-hidden>
        {initials}
      </span>
      {guide.bio ? (
        <p className="absolute inset-x-8 top-[46%] max-w-[30ch] text-[1.35rem] font-medium leading-[1.35] tracking-[-0.02em] text-white/85 sm:text-[1.6rem]">
          &ldquo;{pickText(guide.bio, locale)}&rdquo;
        </p>
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-t from-[rgba(8,9,13,0.72)] via-transparent to-transparent" />
    </div>
  );
}
