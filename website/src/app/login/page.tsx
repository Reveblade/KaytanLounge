import type { Metadata } from "next";
import { Suspense } from "react";
import { SiteHeader } from "@/components/chrome/site-header";
import { LoginFlow } from "@/components/auth/login-flow";
import { getDictionary } from "@/lib/i18n/server";
import { loadBootstrap } from "@/lib/public-data";
import { PlaceImage } from "@/components/media/place-image";
import { pickText } from "@/lib/i18n/pick";
import { Reveal } from "@/components/motion/reveal";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return { title: t.login.title };
}

/** One glass card over the city. The photograph is the reason the card looks like glass. */
export default async function LoginPage() {
  const { locale } = await getDictionary();
  const bootstrap = await loadBootstrap();
  const backdrop = bootstrap.highlights.find((h) => h.media.length)?.media[0] ?? bootstrap.sponsors[0]?.media[0];
  const backdropName = bootstrap.highlights.find((h) => h.media.length)?.name;

  return (
    <>
      <SiteHeader variant="solid" />
      <main className="page-in relative min-h-[100dvh] overflow-hidden">
        <div className="absolute inset-0">
          <PlaceImage media={backdrop} alt={backdropName ? pickText(backdropName, locale) : ""} mode="inset" sizes="100vw" priority className="scale-[1.04]" />
          <div className="absolute inset-0 bg-[var(--scrim)]" aria-hidden />
          <div className="absolute inset-0 bg-gradient-to-t from-bg via-transparent to-bg/40" aria-hidden />
        </div>
        <div className="relative flex min-h-[100dvh] items-center justify-center px-4 pb-16 pt-28">
          <Reveal above className="w-full max-w-[460px]">
            <div className="glass rounded-panel p-7 sm:p-9">
              <Suspense>
                <LoginFlow />
              </Suspense>
            </div>
          </Reveal>
        </div>
      </main>
    </>
  );
}
