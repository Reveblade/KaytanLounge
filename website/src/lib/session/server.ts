import "server-only";
import { cookies } from "next/headers";
import type { CustomerDto } from "../contract/api";
import { ACCESS_COOKIE } from "./cookies";

const API_URL = process.env.BIY_API_URL?.replace(/\/$/, "") || "http://127.0.0.1:3300/api/v1";

/**
 * Best-effort signed-in customer for server components. Only the access cookie is
 * consulted here; an expired one yields `null` and the client provider repairs it
 * through /api/session, which can rotate cookies (route handlers can, RSCs cannot).
 */
export async function currentCustomer(): Promise<CustomerDto | null> {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return null;
  try {
    const res = await fetch(`${API_URL}/customers/me`, { headers: { authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as CustomerDto;
  } catch {
    return null;
  }
}
