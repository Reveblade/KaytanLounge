import "server-only";
import { cookies } from "next/headers";
import type { AdminDto, Permission } from "../contract/api";
import { ACCESS_COOKIE, ACCESS_MAX_AGE, REFRESH_COOKIE } from "./cookies";

const API_URL = process.env.BIY_API_URL?.replace(/\/$/, "") || "http://127.0.0.1:3300/api/v1";

export interface AdminSession {
  admin: AdminDto;
  permissions: Permission[];
}

/**
 * Resolves the signed-in admin for server components. Tries the access cookie, then a
 * refresh; a successful refresh is written back through the route handler contract
 * (RSCs cannot set cookies, so the fresh pair is returned for the caller to persist).
 */
export async function currentAdmin(): Promise<AdminSession | null> {
  const jar = await cookies();
  const access = jar.get(ACCESS_COOKIE)?.value;
  const refresh = jar.get(REFRESH_COOKIE)?.value;
  if (access) {
    const me = await fetchMe(access);
    if (me) return me;
  }
  if (refresh) {
    const pair = await refreshPair(refresh);
    if (pair) {
      const me = await fetchMe(pair.accessToken);
      if (me) return me;
    }
  }
  return null;
}

async function fetchMe(token: string): Promise<AdminSession | null> {
  try {
    const res = await fetch(`${API_URL}/admin/auth/me`, { headers: { authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as AdminSession;
  } catch {
    return null;
  }
}

async function refreshPair(refreshToken: string) {
  try {
    const res = await fetch(`${API_URL}/admin/auth/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as { accessToken: string; refreshToken: string };
  } catch {
    return null;
  }
}

export { ACCESS_MAX_AGE };
