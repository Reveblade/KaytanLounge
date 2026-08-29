import { NextResponse } from "next/server";

/**
 * Same-origin OpenStreetMap tiles for the lounge reel. Carto's "dark_all"
 * raster now watermarks every tile with "API KEY REQUIRED"; OSM does not.
 * Cached here so the set talks to us, not to tile.openstreetmap.org.
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
  const upstream = await fetch(`https://tile.openstreetmap.org/${zi}/${xi}/${yi}.png`, {
    headers: {
      accept: "image/png",
      "user-agent": "BaskaIstanbulYok/1.0 (https://baskaistanbulyok.com; lounge display)",
    },
    next: { revalidate: 86_400 },
  });
  if (!upstream.ok || !upstream.body) return new NextResponse(null, { status: upstream.status || 502 });
  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "image/png",
      "cache-control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
