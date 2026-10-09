import type { Metadata } from "next";
import { SiteFooter } from "@/components/chrome/site-footer";
import { SiteHeader } from "@/components/chrome/site-header";
import { getDictionary } from "@/lib/i18n/server";
import { loadBootstrap, loadRouteCards } from "@/lib/public-data";
import { Reveal } from "@/components/motion/reveal";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return { title: t.footer.about };
}

export default async function AboutPage() {
  const { t, locale } = await getDictionary();
  const [bootstrap, cards] = await Promise.all([loadBootstrap(), loadRouteCards()]);
  const tr = locale === "tr";
  return (
    <>
      <SiteHeader variant="solid" />
      <main className="page-in ambient mx-auto max-w-[820px] px-5 pb-24 pt-32 sm:px-8">
        <Reveal above>
        <h1 className="display-lg">{t.footer.about}</h1>
        </Reveal>
        <Reveal above className="glass-soft mt-8 space-y-5 rounded-panel p-6 text-[1.05rem] leading-[1.7] text-ink-muted sm:p-8">
          {tr ? (
            <>
              <p>Başka İstanbul Yok, şehri bir günde ve doğru sırayla gezdiren rotalar tasarlar. Her rota birbirine yakın duraklardan kurulur; araç küçük, rehber lisanslı, koltuk seçilmiş olur.</p>
              <p>Projenin ana destekçisi Boğaz kıyısındaki Kaytan Lounge. Günler çoğunlukla orada çayla başlar; bazı rotalar Green Corner gibi iş ortağı mekânlarda sona erer.</p>
              <p>Biletler bu sitede alınır; ödemeler bu aşamada ekibimiz tarafından teyit edilir. Sorularınız için alt bilgideki iletişim kanallarını kullanabilirsiniz.</p>
            </>
          ) : (
            <>
              <p>Başka İstanbul Yok designs routes that cover the city in a day, in the right order. Every route is built from stops that sit close to one another, with a small vehicle, a licensed guide and a seat you choose.</p>
              <p>The project is backed by Kaytan Lounge on the Bosphorus. Days usually begin there with tea; some routes end at partner venues such as Green Corner.</p>
              <p>Tickets are bought on this site. In this phase our team confirms each payment by hand. The contact channels in the footer answer questions.</p>
            </>
          )}
        </Reveal>
      </main>
      <SiteFooter t={t} locale={locale} settings={bootstrap.settings} routes={cards} sponsors={bootstrap.sponsors} />
    </>
  );
}
