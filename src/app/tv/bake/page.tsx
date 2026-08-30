import type { Metadata } from "next";
import { loadBootstrap, loadRoute, loadRouteCards } from "@/lib/public-data";
import { pickText } from "@/lib/i18n/pick";
import { BakeMap } from "./bake-map";

export const metadata: Metadata = {
  title: "Bake",
  robots: { index: false, follow: false },
};

/**
 * Bare hero camera for `scripts/bake-city-loop.mjs`. Not linked from the product.
 */
export default async function BakePage({ searchParams }: { searchParams: Promise<{ theme?: string }> }) {
  const theme = (await searchParams).theme === "light" ? "light" : "dark";
  const [bootstrap, cards] = await Promise.all([loadBootstrap(), loadRouteCards()]);
  const featuredSlug = bootstrap.featuredRoutes[0]?.slug ?? cards[0]?.slug;
  const featured = featuredSlug ? await loadRoute(featuredSlug) : null;
  const nodes = (featured?.nodes ?? []).map((n) => ({
    id: `${n.kind}:${n.refId}`,
    order: n.order,
    kind: n.kind,
    location: n.place.location,
    label: pickText(n.place.name, "tr"),
  }));

  return (
    <div data-theme={theme} className={`fixed inset-0 ${theme === "light" ? "bg-[#f5f5f7]" : "bg-[#0e0e11]"}`}>
      <BakeMap theme={theme} path={featured?.path} nodes={nodes} />
    </div>
  );
}
