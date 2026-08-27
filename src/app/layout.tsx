import type { Metadata } from "next";
import { Geist, Yellowtail } from "next/font/google";
import { cookies } from "next/headers";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import { Providers } from "@/components/providers";

const geist = Geist({ subsets: ["latin", "latin-ext"], weight: ["400", "500", "600", "700"], variable: "--font-geist", display: "swap" });

/** The logotype only, shared with the website: the one hand-written thing in the admin. */
const yellowtail = Yellowtail({ subsets: ["latin", "latin-ext"], weight: ["400"], variable: "--font-script-face", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Admin · Başka İstanbul Yok", template: "%s · BİY Admin" },
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = (await cookies()).get("biy_admin_theme")?.value === "dark" ? "dark" : "light";
  return (
    <html lang="en" data-theme={theme} className={`${geist.variable} ${yellowtail.variable}`} suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
