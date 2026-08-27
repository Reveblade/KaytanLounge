import Link from "next/link";
import { getDictionary } from "@/lib/i18n/server";
import { Reveal } from "@/components/motion/reveal";

export default async function NotFound() {
  const { locale } = await getDictionary();
  return (
    <main className="page-in ambient grid min-h-[100dvh] place-items-center px-6">
      <Reveal above>
        <div className="glass max-w-md rounded-panel p-10 text-center">
          <p className="display-xl">404</p>
          <p className="mt-4 text-ink-muted">{locale === "tr" ? "Bu sayfa haritada yok." : "This page is not on the map."}</p>
          <Link href="/" className="btn btn-primary mt-8">
            {locale === "tr" ? "Ana sayfa" : "Home"}
          </Link>
        </div>
      </Reveal>
    </main>
  );
}
