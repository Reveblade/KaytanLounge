import Link from "next/link";
import type { AttractionDto } from "@/lib/contract/api";
import { pickText } from "@/lib/i18n/pick";
import type { Dictionary, UiLocale } from "@/lib/i18n/dictionaries";
import { PlaceImage } from "@/components/media/place-image";
import { Item, Reveal, Stagger } from "@/components/motion/reveal";

/** The city as a photo wall. Captions sit under the image, never on it. */
export function PlacesMosaic({ t, locale, places }: { t: Dictionary; locale: UiLocale; places: AttractionDto[] }) {
  return (
    <section className="border-t border-line py-24 sm:py-32">
      <div className="mx-auto max-w-[1440px] px-5 sm:px-8">
        <Reveal>
          <h2 className="display-lg">{t.landing.placesTitle}</h2>
          <p className="lede mt-4">{t.landing.placesLede}</p>
        </Reveal>
        <Stagger className="mt-12 columns-2 gap-4 md:columns-3 lg:columns-4" gap={0.04}>
          {places.map((place) => (
            <Item key={place.id} className="mb-6 break-inside-avoid">
              <Link href={`/places/${place.slug}`} className="group block">
                <span className="block overflow-hidden rounded-card">
                  <PlaceImage media={place.media[0]} alt={pickText(place.name, locale)} mode="flow" className="transition-transform duration-700 ease-out-quint group-hover:scale-[1.04]" sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw" thumb />
                </span>
                <p className="title mt-3 text-[1.02rem] text-ink">{pickText(place.name, locale)}</p>
                <p className="mt-0.5 text-sm text-ink-faint">{t.explore.types[place.type]} · {place.district}</p>
              </Link>
            </Item>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
