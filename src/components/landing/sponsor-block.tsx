import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import type { BusinessDto, RouteCardDto } from "@/lib/contract/api";
import { pickText } from "@/lib/i18n/pick";
import type { Dictionary, UiLocale } from "@/lib/i18n/dictionaries";
import { PlaceImage } from "@/components/media/place-image";
import { Reveal } from "@/components/motion/reveal";

/**
 * The title partner gets the widest canvas on the page: a full-bleed photograph, its
 * own logotype on a glass plate, and the route that starts at its door. The second
 * partner closes the sentence on the right.
 */
export function SponsorBlock({ t, locale, title, partner, route }: { t: Dictionary; locale: UiLocale; title: BusinessDto; partner?: BusinessDto; route?: RouteCardDto }) {
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
              {title.logo ? (
                /* The hero plate is always dark, so the mark is knocked out to white whatever the theme. */
                <Image src={title.logo.url} alt={pickText(title.name, locale)} width={420} height={140} className="h-11 w-auto object-contain brightness-0 invert sm:h-14" unoptimized={title.logo.provider !== "EXTERNAL"} />
              ) : (
                <p className="display-md">{pickText(title.name, locale)}</p>
              )}
              <h2 className="display-lg mt-8">{t.landing.sponsorTitle}</h2>
              <p className="mt-5 max-w-[46ch] text-lg leading-relaxed text-white/80">{t.landing.sponsorBody}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                {route ? (
                  <Link href={`/explore?route=${route.slug}`} className="btn bg-white text-[#0a0b0f] hover:bg-white/90">
                    {pickText(route.name, locale)}
                  </Link>
                ) : null}
                <Link href={`/places/${title.slug}`} className="btn border border-white/30 bg-white/10 text-white backdrop-blur-md hover:border-white/70 hover:bg-white/15">
                  {pickText(title.name, locale)} <ArrowUpRight size={18} weight="bold" />
                </Link>
              </div>
            </Reveal>
          </div>
        </div>
      </div>

      {partner ? (
        <div className="mx-auto max-w-[1440px] px-5 sm:px-8">
          <Reveal>
            <Link href={`/places/${partner.slug}`} className="glass-card group mt-6 grid items-center gap-6 rounded-panel p-5 sm:grid-cols-[1fr_auto_200px] sm:gap-10 sm:p-6">
              <div>
                <p className="display-md">{t.landing.partnerTitle}</p>
                <p className="mt-2 max-w-[60ch] text-ink-muted">{pickText(partner.summary, locale)}</p>
              </div>
              <span className="hidden text-ink-faint transition-colors group-hover:text-ink sm:block">
                <ArrowUpRight size={28} weight="regular" />
              </span>
              {partner.media[0] ? (
                <PlaceImage media={partner.media[0]} alt={pickText(partner.name, locale)} className="aspect-[4/3] w-full rounded-card sm:w-[200px]" sizes="200px" thumb />
              ) : partner.logo ? (
                <span className="flex aspect-[4/3] w-full items-center justify-center sm:w-[200px]">
                  <Image src={partner.logo.url} alt={pickText(partner.name, locale)} width={240} height={240} className="h-full w-auto object-contain dark:brightness-0 dark:invert" unoptimized={partner.logo.provider !== "EXTERNAL"} />
                </span>
              ) : null}
            </Link>
          </Reveal>
        </div>
      ) : null}
    </section>
  );
}
