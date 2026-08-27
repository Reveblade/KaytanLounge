import type { Metadata } from "next";
import { SiteFooter } from "@/components/chrome/site-footer";
import { SiteHeader } from "@/components/chrome/site-header";
import { getDictionary } from "@/lib/i18n/server";
import { loadBootstrap, loadRouteCards } from "@/lib/public-data";
import { Item, Reveal, Stagger } from "@/components/motion/reveal";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return { title: t.footer.terms };
}

export default async function TermsPage() {
  const { t, locale } = await getDictionary();
  const [bootstrap, cards] = await Promise.all([loadBootstrap(), loadRouteCards()]);
  const tr = locale === "tr";
  const sections = tr
    ? [
        ["Rezervasyon", "Bir rezervasyon, seçilen koltuklar için ödemenin ekibimiz tarafından teyit edilmesiyle kesinleşir. Onay beklenirken koltuklar ayarlarda belirtilen süre boyunca tutulur; süre dolarsa rezervasyon kendiliğinden düşer."],
        ["İptal", "Onaylanmamış rezervasyonlar hesabınızdan iptal edilebilir. Onaylanmış biletler için tur sayfasındaki iptal politikası geçerlidir; ekibimizle iletişime geçin."],
        ["Kalkış", "Buluşma noktasına belirtilen saatten 15 dakika önce gelinmesi beklenir. Geç kalan yolcular için araç beklemeyebilir ve iade yapılmaz."],
        ["Değişiklikler", "Hava, trafik veya güvenlik nedeniyle duraklar değiştirilebilir veya sıra değişebilir. Rehber, günün akışından sorumludur."],
      ]
    : [
        ["Booking", "A booking becomes final when our team confirms payment for the chosen seats. While confirmation is pending, seats are held for the period shown at checkout; after that the booking lapses on its own."],
        ["Cancellation", "Unconfirmed bookings can be cancelled from your account. Confirmed tickets follow the cancellation policy shown on the departure; contact our team."],
        ["Departure", "Please be at the meeting point 15 minutes before the stated time. The vehicle may not wait for late passengers and no refund is given in that case."],
        ["Changes", "Stops may be replaced or reordered because of weather, traffic or safety. The guide is responsible for the flow of the day."],
      ];
  return (
    <>
      <SiteHeader variant="solid" />
      <main className="page-in ambient mx-auto max-w-[820px] px-5 pb-24 pt-32 sm:px-8">
        <Reveal above>
          <h1 className="display-lg">{t.footer.terms}</h1>
        </Reveal>
        <Stagger className="mt-10 space-y-4">
          {sections.map(([title, body]) => (
            <Item key={title} as="article" className="glass-soft rounded-panel p-6">
              <h2 className="display-sm">{title}</h2>
              <p className="mt-2 leading-relaxed text-ink-muted">{body}</p>
            </Item>
          ))}
        </Stagger>
      </main>
      <SiteFooter t={t} locale={locale} settings={bootstrap.settings} routes={cards} sponsors={bootstrap.sponsors} />
    </>
  );
}
