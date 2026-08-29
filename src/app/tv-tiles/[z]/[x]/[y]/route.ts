import { NextResponse } from "next/server";

/**
 * Same-origin dark basemap tiles for the lounge reel. Smart TVs load our host;
 * they often drop a third-party tile CDN, and they never get as far as MapLibre.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ z: string; x: string; y: string }> }) {
  const { z, x, y } = await ctx.params;
  const zi = Number(z);
  const xi = Number(x);
  const yi = Number(y);
  if (!Number.isInteger(zi) || !Number.isInteger(xi) || !Number.isInteger(yi) || zi < 0 || zi > 15) {
    return new NextResponse(null, { status: 400 });
  }
  const extent = 2 ** zi;
  if (xi < 0 || yi < 0 || xi >= extent || yi >= extent) {
    return new NextResponse(null, { status: 400 });
  }
  const upstream = await fetch(`https://basemaps.cartocdn.com/dark_all/${zi}/${xi}/${yi}.png`, {
    headers: { accept: "image/png" },
    next: { revalidate: 86_400 },
  });
  if (!upstream.ok || !upstream.body) return new NextResponse(null, { status: upstream.status || 502 });
  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "content-type": "image/png",
      "cache-control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
