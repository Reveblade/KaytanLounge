import Link from "next/link";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import type { BusinessDto, RouteCardDto } from "@/lib/contract/api";
import { pickText } from "@/lib/i18n/pick";
import type { Dictionary, UiLocale } from "@/lib/i18n/dictionaries";
import { PlaceImage } from "@/components/media/place-image";
import { Reveal } from "@/components/motion/reveal";

/**
 * The title partner gets the widest canvas on the page: a full-bleed photograph and
 * the route that starts at its door.
 */
export function SponsorBlock({ t, locale, title, route }: { t: Dictionary; locale: UiLocale; title: BusinessDto; route?: RouteCardDto }) {
  const cover = title.media[0];
  return (
    <section className="relative">
      <div className="mx-auto max-w-[1440px] px-0 sm:px-8">
        <div className="relative min-h-[78vh] overflow-hidden bg-[#0b0d12] sm:rounded-panel">
          {cover ? (
            <>
              <PlaceImage media={cover} alt={pickText(title.name, locale)} mode="inset" sizes="100vw" />
              <div className="absolute inset-0 bg-gradient-to-r from-[rgba(8,9,13,0.85)] via-[rgba(8,9,13,0.45)] to-[rgba(8,9,13,0.15)]" aria-hidden />
            </>
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(120%_100%_at_15%_20%,rgba(255,160,122,0.22),transparent_60%)]" aria-hidden />
          )}
          <div className="relative flex min-h-[78vh] items-end px-5 py-14 sm:px-12 sm:py-20">
            <Reveal className="max-w-[640px] text-white">
              <h2 className="display-lg">{t.landing.sponsorTitle}</h2>
              <p className="mt-5 max-w-[46ch] text-lg leading-relaxed text-white/80">{t.landing.sponsorBody}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                {route ? (
                  <Link href={`/explore?route=${route.slug}`} className="btn bg-white text-[#0a0b0f] hover:bg-white/90">
                    {pickText(route.name, locale)}
                  </Link>
                ) : null}
                <Link href={`/places/${title.slug}`} className="btn glass-frost text-white hover:border-white/70 hover:bg-white/15">
                  {pickText(title.name, locale)} <ArrowUpRight size={18} weight="bold" />
                </Link>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
