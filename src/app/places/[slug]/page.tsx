import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { apiGetOrNull } from "@/lib/api/server";
import type { PublicPlaceDto } from "@/lib/contract/api";
import { formatDuration } from "@/lib/format";
import { pickText } from "@/lib/i18n/pick";
import { getDictionary } from "@/lib/i18n/server";
import { loadBootstrap, loadRouteCards } from "@/lib/public-data";
import { SiteFooter } from "@/components/chrome/site-footer";
import { SiteHeader } from "@/components/chrome/site-header";
import { PlaceImage } from "@/components/media/place-image";
import { PlaceDetail } from "@/components/places/place-detail";
import { StaticMap } from "@/components/map/static-map";
import { Item, Reveal, Stagger } from "@/components/motion/reveal";

export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const { locale } = await getDictionary();
  const data = await apiGetOrNull<PublicPlaceDto>(`public/places/${encodeURIComponent(slug)}`, { revalidate: 60 }).catch(() => null);
  if (!data) return {};
  return {
    title: pickText(data.place.name, locale),
    description: pickText(data.place.summary, locale),
    openGraph: { images: data.place.media[0] ? [{ url: data.place.media[0].url }] : [] },
  };
}

export default async function PlacePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { t, locale } = await getDictionary();
  const data = await apiGetOrNull<PublicPlaceDto>(`public/places/${encodeURIComponent(slug)}`, { revalidate: 60 }).catch(() => null);
  if (!data) notFound();
  const [bootstrap, cards] = await Promise.all([loadBootstrap(), loadRouteCards()]);

  return (
    <>
      <SiteHeader variant="solid" />
      <main className="page-in ambient pt-[92px]">
        <PlaceDetail kind={data.kind} place={data.place} />
        <Reveal className="mx-auto max-w-[820px] px-5 sm:px-8">
          <StaticMap location={data.place.location} label={pickText(data.place.name, locale)} place={data.place} kind={data.kind} href={`/explore?view=all&stop=${data.place.slug}`} className="aspect-[21/9] w-full overflow-hidden rounded-panel border border-line" />
        </Reveal>
        {data.routes.length ? (
          <section className="mx-auto max-w-[820px] px-5 pt-14 sm:px-8">
            <Reveal>
              <h2 className="display-md">{locale === "tr" ? "Bu duraktan geçen rotalar" : "Routes that stop here"}</h2>
            </Reveal>
            <Stagger className="mt-6 grid gap-3 sm:grid-cols-2">
              {data.routes.map((r) => (
                <Item key={r.id}>
                  <Link href={`/explore?route=${r.slug}&stop=${data.place.slug}`} className="glass-card group flex items-center gap-4 rounded-card p-3">
                    <PlaceImage media={r.cover} alt="" className="h-20 w-24 shrink-0 rounded-[14px]" sizes="96px" thumb />
                    <div className="min-w-0 flex-1">
                      <p className="title truncate text-[1.05rem]">{pickText(r.name, locale)}</p>
                      <p className="mt-1 text-sm text-ink-muted tnum">{r.nodeCount} {t.explore.stops} · {formatDuration(r.durationMinutes, locale)}</p>
                    </div>
                    <ArrowRight size={18} weight="bold" className="mr-1 shrink-0 text-ink-faint transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-ink" />
                  </Link>
                </Item>
              ))}
            </Stagger>
          </section>
        ) : null}
      </main>
      <SiteFooter t={t} locale={locale} settings={bootstrap.settings} routes={cards} sponsors={bootstrap.sponsors} />
    </>
  );
}
