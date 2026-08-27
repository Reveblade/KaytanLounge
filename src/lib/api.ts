"use client";

import type { ApiErrorBody } from "./contract/api";

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

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  /** Raw multipart body; content-type is left to the browser. */
  form?: FormData;
  signal?: AbortSignal;
}

/** Browser calls go through the BFF at /api/v1; cookies carry the session. */
export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/v1/${path.replace(/^\//, "")}`, {
      method: opts.method ?? "GET",
      headers: {
        accept: "application/json",
        ...(opts.body !== undefined && !opts.form ? { "content-type": "application/json" } : {}),
      },
      body: opts.form ?? (opts.body === undefined ? undefined : JSON.stringify(opts.body)),
      cache: "no-store",
      signal: opts.signal,
      credentials: "same-origin",
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Network error");
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    body = undefined;
  }
  if (!res.ok) {
    const err = body as ApiErrorBody | undefined;
    if (res.status === 401 && typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      window.location.href = `/login?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    }
    throw new ApiError(res.status, err?.code ?? "HTTP_ERROR", err?.message ?? `Request failed (${res.status})`, err?.details);
  }
  return body as T;
}

export function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const s = search.toString();
  return s ? `?${s}` : "";
}
