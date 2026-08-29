import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { apiGet } from "@/lib/api/server";
import type { AttractionDto, BusinessDto } from "@/lib/contract/api";
import { pickText } from "@/lib/i18n/pick";
import { getDictionary } from "@/lib/i18n/server";
import { loadBootstrap, loadRouteCards } from "@/lib/public-data";
import { SiteFooter } from "@/components/chrome/site-footer";
import { SiteHeader } from "@/components/chrome/site-header";
import { PlaceImage } from "@/components/media/place-image";
import { Item, Reveal, Stagger } from "@/components/motion/reveal";

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return { title: t.nav.places };
}

/** Until a partner has photography: two soft lights, the mark knocked out to white, or the initial at poster size. */
function PartnerPlate({ business, name }: { business: BusinessDto; name: string }) {
  return (
    <div className="absolute inset-0 bg-[#101218]">
      <div className="absolute inset-0" style={{ background: "radial-gradient(120% 90% at 18% 12%, rgba(255,160,122,0.28), transparent 60%), radial-gradient(90% 70% at 88% 8%, rgba(255,255,255,0.10), transparent 55%)" }} aria-hidden />
      {business.logo ? (
        <Image src={business.logo.url} alt={name} width={480} height={160} className="absolute left-8 top-8 h-12 w-auto object-contain brightness-0 invert opacity-90" unoptimized={business.logo.provider !== "EXTERNAL"} />
      ) : (
        <span className="absolute -left-2 top-[4%] select-none text-[clamp(8rem,18vw,14rem)] font-semibold leading-[0.8] tracking-[-0.06em] text-white/[0.07]" aria-hidden>
          {name.trim().charAt(0).toLocaleUpperCase("tr-TR")}
        </span>
      )}
    </div>
  );
}

export default async function PlacesPage() {
  const { t, locale } = await getDictionary();
  const [{ attractions, businesses }, bootstrap, cards] = await Promise.all([
    apiGet<{ attractions: AttractionDto[]; businesses: BusinessDto[] }>("public/places", { revalidate: 60 }).catch(() => ({ attractions: [], businesses: [] })),
    loadBootstrap(),
    loadRouteCards(),
  ]);
  const districts = [...new Set(attractions.map((a) => a.district))].sort();

  return (
    <>
      <SiteHeader variant="solid" />
      <main className="page-in ambient mx-auto max-w-[1440px] px-5 pb-24 pt-32 sm:px-8">
        <Reveal above>
          <h1 className="display-lg">{t.landing.placesTitle}</h1>
          <p className="lede mt-4">{t.landing.placesLede}</p>
        </Reveal>

        {businesses.length ? (
          <Stagger above className="mt-14 grid gap-4 sm:grid-cols-2">
            {businesses.map((b) => (
              <Item key={b.id}>
                <Link href={`/places/${b.slug}`} className="group relative block min-h-[320px] overflow-hidden rounded-panel bg-surface-2 transition-transform duration-500 ease-out-quint hover:-translate-y-1">
                  {b.media[0] ? (
                    <PlaceImage media={b.media[0]} alt={pickText(b.name, locale)} mode="inset" className="transition-transform duration-700 ease-out-quint group-hover:scale-[1.04]" sizes="(min-width: 640px) 50vw, 100vw" />
                  ) : (
                    <PartnerPlate business={b} name={pickText(b.name, locale)} />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[rgba(8,9,13,0.5)] to-transparent" aria-hidden />
                  <div className="glass-frost absolute inset-x-3 bottom-3 rounded-[20px] p-5 text-white">
                    <p className="label label-on-dark">{t.explore.partnerVenue} · {b.district}</p>
                    <p className="display-md mt-1">{pickText(b.name, locale)}</p>
                    <p className="mt-2 max-w-[48ch] text-sm text-white/75">{pickText(b.summary, locale)}</p>
                  </div>
                </Link>
              </Item>
            ))}
          </Stagger>
        ) : null}

        {districts.map((district) => (
          <section key={district} className="mt-16">
            <Reveal>
              <h2 className="display-md border-b border-line pb-4">{district}</h2>
            </Reveal>
            <Stagger className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4" gap={0.04}>
              {attractions
                .filter((a) => a.district === district)
                .map((a) => (
                  <Item key={a.id}>
                    <Link href={`/places/${a.slug}`} className="group block">
                      <span className="block overflow-hidden rounded-card">
                        <PlaceImage media={a.media[0]} alt={pickText(a.name, locale)} className="aspect-[4/3] w-full transition-transform duration-700 ease-out-quint group-hover:scale-[1.04]" sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw" thumb />
                      </span>
                      <p className="title mt-3 text-[1.02rem]">{pickText(a.name, locale)}</p>
                      <p className="mt-0.5 text-sm text-ink-faint">{t.explore.types[a.type]}</p>
                    </Link>
                  </Item>
                ))}
            </Stagger>
          </section>
        ))}
      </main>
      <SiteFooter t={t} locale={locale} settings={bootstrap.settings} routes={cards} sponsors={bootstrap.sponsors} />
    </>
  );
}
