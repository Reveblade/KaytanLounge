import Image from "next/image";
import Link from "next/link";
import { InstagramLogo, FacebookLogo, YoutubeLogo, TiktokLogo, Phone, WhatsappLogo, EnvelopeSimple } from "@phosphor-icons/react/dist/ssr";
import type { BusinessDto, RouteCardDto, SettingsDto } from "@/lib/contract/api";
import type { Dictionary, UiLocale } from "@/lib/i18n/dictionaries";
import { pickText } from "@/lib/i18n/pick";
import { Reveal } from "@/components/motion/reveal";

interface Props {
  t: Dictionary;
  locale: UiLocale;
  settings: SettingsDto;
  routes: RouteCardDto[];
  sponsors: BusinessDto[];
}

/**
 * The footer is the second hero: the wordmark at poster size, then four quiet columns.
 * Partner marks sit on their own row so the sponsor is seen, not squeezed.
 */
export function SiteFooter({ t, locale, settings, routes, sponsors }: Props) {
  const c = settings.contact;
  const socials = [
    c.instagram ? { href: `https://instagram.com/${c.instagram.replace(/^@/, "")}`, label: "Instagram", Icon: InstagramLogo } : null,
    c.facebook ? { href: c.facebook.startsWith("http") ? c.facebook : `https://facebook.com/${c.facebook}`, label: "Facebook", Icon: FacebookLogo } : null,
    c.youtube ? { href: c.youtube.startsWith("http") ? c.youtube : `https://youtube.com/${c.youtube}`, label: "YouTube", Icon: YoutubeLogo } : null,
    c.tiktok ? { href: `https://tiktok.com/@${c.tiktok.replace(/^@/, "")}`, label: "TikTok", Icon: TiktokLogo } : null,
  ].filter((s): s is NonNullable<typeof s> => Boolean(s));

  return (
    <footer className="ambient relative mt-32 border-t border-line">
      <div className="mx-auto max-w-[1440px] px-5 pb-10 pt-20 sm:px-8">
        <Reveal>
          <p className="text-[clamp(2.4rem,8.5vw,8rem)] font-semibold leading-[0.95] tracking-[-0.045em] text-ink">Başka İstanbul Yok</p>
          <p className="lede mt-6">{t.footer.tagline}</p>
        </Reveal>

        <div className="mt-16 grid grid-cols-2 gap-10 md:grid-cols-4">
          <div>
            <p className="label mb-4">{t.footer.routes}</p>
            <ul className="space-y-2.5">
              {routes.slice(0, 7).map((r) => (
                <li key={r.id}>
                  <Link href={`/explore?route=${r.slug}`} className="text-[0.95rem] text-ink-muted transition-colors hover:text-ink">
                    {pickText(r.name, locale)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="label mb-4">{t.footer.places}</p>
            <ul className="space-y-2.5 text-[0.95rem]">
              <li><Link href="/places" className="text-ink-muted transition-colors hover:text-ink">{t.nav.places}</Link></li>
              <li><Link href="/explore" className="text-ink-muted transition-colors hover:text-ink">{t.nav.explore}</Link></li>
              <li><Link href="/account" className="text-ink-muted transition-colors hover:text-ink">{t.nav.account}</Link></li>
            </ul>
          </div>
          <div>
            <p className="label mb-4">{t.footer.company}</p>
            <ul className="space-y-2.5 text-[0.95rem]">
              <li><Link href="/about" className="text-ink-muted transition-colors hover:text-ink">{t.footer.about}</Link></li>
              <li><a href="/tv" className="text-ink-muted transition-colors hover:text-ink">{t.footer.tv}</a></li>
              <li><Link href="/terms" className="text-ink-muted transition-colors hover:text-ink">{t.footer.terms}</Link></li>
              <li><Link href="/privacy" className="text-ink-muted transition-colors hover:text-ink">{t.footer.privacy}</Link></li>
            </ul>
          </div>
          <div>
            <p className="label mb-4">{t.footer.contact}</p>
            <ul className="space-y-2.5 text-[0.95rem]">
              {c.phone ? (
                <li>
                  <a href={`tel:${c.phone}`} className="inline-flex items-center gap-2 text-ink-muted transition-colors hover:text-ink"><Phone size={16} weight="regular" />{c.phone}</a>
                </li>
              ) : null}
              {c.whatsapp ? (
                <li>
                  <a href={`https://wa.me/${c.whatsapp.replace(/\D/g, "")}`} className="inline-flex items-center gap-2 text-ink-muted transition-colors hover:text-ink"><WhatsappLogo size={16} weight="regular" />WhatsApp</a>
                </li>
              ) : null}
              {c.email ? (
                <li>
                  <a href={`mailto:${c.email}`} className="inline-flex items-center gap-2 text-ink-muted transition-colors hover:text-ink"><EnvelopeSimple size={16} weight="regular" />{c.email}</a>
                </li>
              ) : null}
              {c.address ? <li className="text-ink-faint">{c.address}</li> : null}
            </ul>
            {socials.length ? (
              <div className="mt-5 flex gap-2">
                {socials.map(({ href, label, Icon }) => (
                  <a key={label} href={href} target="_blank" rel="noreferrer" aria-label={label} className="glass-soft grid h-10 w-10 place-items-center rounded-pill text-ink-muted transition-colors hover:border-ink hover:text-ink">
                    <Icon size={18} weight="regular" />
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {sponsors.length ? (
          <div className="mt-16 border-t border-line pt-8">
            <p className="label mb-6">{t.footer.partners}</p>
            <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
              {sponsors.map((b) => (
                <Link key={b.id} href={`/places/${b.slug}`} className="opacity-85 transition-opacity hover:opacity-100" aria-label={pickText(b.name, locale)}>
                  {b.logo ? (
                    <Image src={b.logo.url} alt={pickText(b.name, locale)} width={240} height={80} className="h-10 w-auto object-contain dark:brightness-0 dark:invert" unoptimized={b.logo.provider !== "EXTERNAL"} />
                  ) : (
                    <span className="display-sm text-ink">{pickText(b.name, locale)}</span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-12 grid grid-cols-1 items-center gap-3 border-t border-line pt-6 text-center text-sm text-ink-faint sm:grid-cols-3 sm:text-left">
          <span>© {new Date().getFullYear()} {settings.brand.name}. {t.footer.rights}</span>
          <a
            href="https://kuwho.com"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-self-center gap-1.5 text-xs tracking-wide transition-colors hover:text-ink"
          >
            <span
              aria-hidden="true"
              className="h-3.5 w-3.5 shrink-0 bg-current [mask:url(/brand/kuwho.svg)_center_/_contain_no-repeat] [-webkit-mask:url(/brand/kuwho.svg)_center_/_contain_no-repeat]"
            />
            Kuwho
          </a>
          <span className="text-xs sm:justify-self-end sm:text-right">
            Istanbul · Map data ©{" "}
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="transition-colors hover:text-ink">OpenStreetMap</a> contributors ·{" "}
            <a href="https://openfreemap.org" target="_blank" rel="noreferrer" className="transition-colors hover:text-ink">OpenFreeMap</a>
          </span>
        </div>
      </div>
    </footer>
  );
}
