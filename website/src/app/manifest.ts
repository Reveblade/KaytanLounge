import type { MetadataRoute } from "next";

/**
 * What a phone reads when the site is kept on a home screen: the logotype's B on
 * graphite, the name in full under it, and the same ground the pages are painted on so
 * the splash does not flash white before the map arrives.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Başka İstanbul Yok",
    short_name: "Başka İstanbul",
    description: "One route a day through Istanbul, with a guide who knows the city.",
    lang: "tr",
    start_url: "/",
    display: "standalone",
    background_color: "#0e0e11",
    theme_color: "#0e0e11",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
      // Android crops icons to its own shape: this one keeps the letter inside the safe circle.
      { src: "/brand/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
