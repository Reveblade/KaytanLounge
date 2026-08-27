import "server-only";
import { cookies } from "next/headers";
import type { ApiErrorBody } from "../contract/api";
import { ACCESS_COOKIE } from "../session/cookies";

const API_URL = process.env.BIY_API_URL?.replace(/\/$/, "") || "http://127.0.0.1:3300/api/v1";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

interface Options {
  /** Attach the customer's access token from the session cookie. */
  auth?: boolean;
  revalidate?: number | false;
  tags?: string[];
}

/** Server-side fetch straight to the API (no proxy hop). Used by RSC pages. */
export async function apiGet<T>(path: string, opts: Options = {}): Promise<T> {
  const headers: Record<string, string> = { accept: "application/json" };
  if (opts.auth) {
    const token = (await cookies()).get(ACCESS_COOKIE)?.value;
    if (token) headers.authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${API_URL}/${path.replace(/^\//, "")}`, {
    headers,
    next: opts.revalidate === undefined ? { revalidate: 30, tags: opts.tags } : opts.revalidate === false ? undefined : { revalidate: opts.revalidate, tags: opts.tags },
    cache: opts.revalidate === false ? "no-store" : undefined,
  });
  const text = await res.text();
  const body = text ? (JSON.parse(text) as unknown) : undefined;
  if (!res.ok) {
    const err = body as ApiErrorBody | undefined;
    throw new ApiError(res.status, err?.code ?? "HTTP_ERROR", err?.message ?? `API responded ${res.status}`, err?.details);
  }
  return body as T;
}

/** Same as `apiGet` but resolves to `null` on a 404 instead of throwing. */
export async function apiGetOrNull<T>(path: string, opts: Options = {}): Promise<T | null> {
  try {
    return await apiGet<T>(path, opts);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export function apiOrigin(): string {
  return API_URL;
}
