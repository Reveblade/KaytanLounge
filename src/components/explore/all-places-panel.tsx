"use client";

import { useMemo, useState } from "react";
import { clsx } from "clsx";
import { MagnifyingGlass } from "@phosphor-icons/react";
import type { AttractionDto, BusinessDto } from "@/lib/contract/api";
import { useI18n } from "@/lib/i18n/context";
import { PlaceImage } from "@/components/media/place-image";

export interface OverviewPlace {
  id: string;
  kind: "ATTRACTION" | "BUSINESS";
  place: AttractionDto | BusinessDto;
}

interface Props {
  places: OverviewPlace[];
  activeId: string | null;
  onSelect: (id: string) => void;
  /** Searching wants the list, not the blurb: the phone's drawer opens up for it. */
  onSearchFocus?: () => void;
}

/**
 * The whole catalogue with no route chosen: every stop we have written, searchable
 * and grouped by district so the list reads like the city rather than a database.
 */
export function AllPlacesPanel({ places, activeId, onSelect, onSearchFocus }: Props) {
  const { t, pick } = useI18n();
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("tr");
    const matched = needle
      ? places.filter((p) => {
          const place = p.place;
          const type = p.kind === "BUSINESS" ? (place as BusinessDto).category : (place as AttractionDto).type;
          return [pick(place.name), place.district, place.slug, t.explore.types[type]]
            .join(" ")
            .toLocaleLowerCase("tr")
            .includes(needle);
        })
      : places;
    const byDistrict = new Map<string, OverviewPlace[]>();
    for (const item of matched) {
      const key = item.place.district || "İstanbul";
      byDistrict.set(key, [...(byDistrict.get(key) ?? []), item]);
    }
    return [...byDistrict.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], "tr"));
  }, [places, query, pick, t]);

  const total = groups.reduce((sum, [, list]) => sum + list.length, 0);

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pb-4 pt-4 lg:pt-5">
        {/* The picker directly above already names this view; on a phone, saying it twice
            costs the drawer a third of its height. */}
        <div className="hidden lg:block">
          <p className="label">{t.explore.allPlaces}</p>
          <h2 className="display-md mt-1">{t.explore.allPlacesTitle}</h2>
          <p className="mt-2 text-sm text-ink-muted">{t.explore.allPlacesLede}</p>
        </div>
        <div className="relative lg:mt-4">
          <MagnifyingGlass size={16} weight="bold" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            className="field !pl-10"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={onSearchFocus}
            placeholder={t.explore.searchPlaces}
            aria-label={t.explore.searchPlaces}
          />
        </div>
        <p className="mt-2 text-xs text-ink-faint tnum">{total} {t.nav.places.toLocaleLowerCase("tr")}</p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-8">
        {groups.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-muted">{t.explore.noPlacesFound}</p>
        ) : (
          groups.map(([district, list]) => (
            <section key={district} className="mb-6">
              <p className="sticky top-0 z-10 -mx-1 bg-[var(--glass-strong)] px-1 py-1.5 text-[0.78rem] font-semibold text-ink-faint backdrop-blur">
                {district}
              </p>
              <ul className="mt-1 space-y-1">
                {list.map((item) => {
                  const active = item.id === activeId;
                  const type = item.kind === "BUSINESS" ? (item.place as BusinessDto).category : (item.place as AttractionDto).type;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => onSelect(item.id)}
                        className={clsx("flex w-full items-center gap-3 rounded-card p-2 text-left transition-colors hover:bg-ink/5", active && "bg-ink/5")}
                      >
                        <PlaceImage media={item.place.media[0]} alt="" className="h-12 w-16 shrink-0 rounded-[10px]" sizes="64px" thumb />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{pick(item.place.name)}</span>
                          <span className="block truncate text-xs text-ink-faint">
                            {t.explore.types[type]}
                            {item.kind === "BUSINESS" ? ` · ${t.explore.partnerVenue}` : ""}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
