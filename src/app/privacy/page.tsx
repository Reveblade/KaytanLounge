import type { Metadata } from "next";
import { SiteFooter } from "@/components/chrome/site-footer";
import { SiteHeader } from "@/components/chrome/site-header";
import { getDictionary } from "@/lib/i18n/server";
import { loadBootstrap, loadRouteCards } from "@/lib/public-data";
import { Item, Reveal, Stagger } from "@/components/motion/reveal";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return { title: t.footer.privacy };
}

export default async function PrivacyPage() {
  const { t, locale } = await getDictionary();
  const [bootstrap, cards] = await Promise.all([loadBootstrap(), loadRouteCards()]);
  const tr = locale === "tr";
  const sections = tr
    ? [
        ["Kimlik", "Giriş işlemi Kuwho tarafından sağlanır. Telefon numaranız veya e-postanız yalnızca tek kullanımlık kod göndermek ve hesabınızı tanımak için kullanılır."],
        ["Rezervasyon verileri", "Yolcu adları, iletişim bilgileri ve koltuk seçimleri bileti düzenlemek, rehberin sizi tanıması ve ödeme teyidi için saklanır."],
        ["Çerezler", "Oturumunuzu, dil ve tema tercihinizi hatırlamak için çerez kullanılır. Reklam amaçlı takip yapılmaz."],
        ["Haklarınız", "Hesabınızdaki verileri görebilir, adınızı düzenleyebilir ve tüm cihazlardan çıkış yapabilirsiniz. Silme talepleri için iletişim kanallarını kullanın."],
      ]
    : [
        ["Identity", "Sign-in is provided by Kuwho. Your phone number or email is used only to send one-time codes and to recognise your account."],
        ["Booking data", "Passenger names, contact details and seat choices are stored to issue the ticket, let the guide recognise you and confirm payment."],
        ["Cookies", "Cookies remember your session, language and theme. There is no advertising tracking."],
        ["Your rights", "You can see the data on your account, edit your name and sign out of every device. Use the contact channels for deletion requests."],
      ];
  return (
    <>
      <SiteHeader variant="solid" />
      <main className="page-in ambient mx-auto max-w-[820px] px-5 pb-24 pt-32 sm:px-8">
        <Reveal above>
          <h1 className="display-lg">{t.footer.privacy}</h1>
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
