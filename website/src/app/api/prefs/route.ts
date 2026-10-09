import { NextResponse, type NextRequest } from "next/server";
import { isUiLocale } from "@/lib/i18n/dictionaries";

/** Stores locale / theme preferences as plain cookies the server layout reads. */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { locale?: string; theme?: string };
  const response = NextResponse.json({ ok: true });
  const year = 60 * 60 * 24 * 365;
  if (isUiLocale(body.locale)) {
    response.cookies.set("biy_locale", body.locale, { path: "/", maxAge: year, sameSite: "lax" });
  }
  if (body.theme === "dark" || body.theme === "light") {
    response.cookies.set("biy_theme", body.theme, { path: "/", maxAge: year, sameSite: "lax" });
  }
  return response;
}
