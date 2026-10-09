import { NextResponse, type NextRequest } from "next/server";
import type { CustomerDto } from "@/lib/contract/api";
import { ACCESS_COOKIE, ACCESS_MAX_AGE, REFRESH_COOKIE, REFRESH_MAX_AGE, cookieOptions } from "@/lib/session/cookies";

const API_URL = process.env.BIY_API_URL?.replace(/\/$/, "") || "http://127.0.0.1:3300/api/v1";

/** Who is signed in, resolved from the httpOnly cookies. `{ customer: null }` when nobody. */
export async function GET(request: NextRequest) {
  const access = request.cookies.get(ACCESS_COOKIE)?.value;
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!access && !refresh) return NextResponse.json({ customer: null });

  let customer = access ? await me(access) : null;
  let rotated: { accessToken: string; refreshToken: string } | null = null;
  if (!customer && refresh) {
    rotated = await refreshPair(refresh);
    if (rotated) customer = await me(rotated.accessToken);
  }

  const response = NextResponse.json({ customer });
  if (rotated) {
    response.cookies.set(ACCESS_COOKIE, rotated.accessToken, cookieOptions(ACCESS_MAX_AGE));
    response.cookies.set(REFRESH_COOKIE, rotated.refreshToken, cookieOptions(REFRESH_MAX_AGE));
  } else if (!customer) {
    response.cookies.set(ACCESS_COOKIE, "", cookieOptions(0));
    response.cookies.set(REFRESH_COOKIE, "", cookieOptions(0));
  }
  return response;
}

async function me(token: string): Promise<CustomerDto | null> {
  try {
    const res = await fetch(`${API_URL}/customers/me`, { headers: { authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as CustomerDto;
  } catch {
    return null;
  }
}

async function refreshPair(refreshToken: string) {
  try {
    const res = await fetch(`${API_URL}/auth/customer/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { accessToken?: string; refreshToken?: string };
    return json.accessToken && json.refreshToken ? { accessToken: json.accessToken, refreshToken: json.refreshToken } : null;
  } catch {
    return null;
  }
}
