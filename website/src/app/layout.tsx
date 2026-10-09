import type { Metadata, Viewport } from "next";
import { Geist, Sacramento, Yellowtail } from "next/font/google";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n/context";
import { getLocale, getTheme } from "@/lib/i18n/server";
import { SessionProvider } from "@/lib/session/context";
import { currentCustomer } from "@/lib/session/server";
import { MusicPlayer } from "@/components/music/music-player";
import { PageCurtain } from "@/components/chrome/page-curtain";
import { ThemeProvider } from "@/components/chrome/prefs-toggles";

/** One family for everything: 600 tight for display, 400/500 for the interface. */
const geist = Geist({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-geist",
  display: "swap",
});

/** The logotype alone is written by hand: a brush script that already leans, and
 *  that carries the ş and the dotted İ the name needs. One weight is all it ships. */
const yellowtail = Yellowtail({
  subsets: ["latin", "latin-ext"],
  weight: ["400"],
  variable: "--font-script-face",
  display: "swap",
});

/** The loading screen's "istanbul": a thin monoline signature, not the logotype. */
const sacramento = Sacramento({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-hand-face",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Başka İstanbul Yok", template: "%s · Başka İstanbul Yok" },
  description: "One route a day through Istanbul. Attractions in the right order, a guide who knows the city, a chosen seat.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "http://localhost:3302"),
  openGraph: { siteName: "Başka İstanbul Yok", type: "website" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0e0e11" },
    { media: "(prefers-color-scheme: light)", color: "#f5f5f7" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [locale, theme, customer] = await Promise.all([getLocale(), getTheme(), currentCustomer()]);
  return (
    <html lang={locale} data-theme={theme} className={`${geist.variable} ${yellowtail.variable} ${sacramento.variable}`} suppressHydrationWarning>
      <body>
        <I18nProvider locale={locale}>
          <ThemeProvider initial={theme}>
            <SessionProvider initial={customer}>
              {children}
              <PageCurtain />
              {/* Outside the page tree on purpose: the layout never remounts, so a piece
                  keeps playing across every navigation. */}
              <MusicPlayer />
            </SessionProvider>
          </ThemeProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
