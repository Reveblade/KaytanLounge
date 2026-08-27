import type { NextConfig } from "next";
import type { RemotePattern } from "next/dist/shared/lib/image-config";

/**
 * Media can be served from three places: the API itself (local uploads), Cloudinary,
 * or an external source such as Wikimedia. The API's own origin is read from the
 * environment because a `remotePattern` without a `port` never matches a ported URL,
 * which silently turns every image into a 400.
 */
function apiPattern(): RemotePattern[] {
  const raw = process.env.NEXT_PUBLIC_API_PUBLIC_ORIGIN ?? process.env.BIY_API_URL ?? "http://127.0.0.1:3300/api/v1";
  try {
    const url = new URL(raw);
    const protocol = url.protocol.replace(":", "") as "http" | "https";
    const port = url.port || undefined;
    // Both spellings of loopback so a browser on either host still matches.
    const hosts = url.hostname === "127.0.0.1" || url.hostname === "localhost" ? ["127.0.0.1", "localhost"] : [url.hostname];
    return hosts.map((hostname) => ({ protocol, hostname, ...(port ? { port } : {}) }));
  } catch {
    return [];
  }
}

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: { root: process.cwd() },
  images: {
    remotePatterns: [
      ...apiPattern(),
      { protocol: "https", hostname: "upload.wikimedia.org" },
      { protocol: "https", hostname: "commons.wikimedia.org" },
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
    formats: ["image/webp"],
  },
};

export default nextConfig;
