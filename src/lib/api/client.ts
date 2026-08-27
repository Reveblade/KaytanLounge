"use client";

import type { ApiErrorBody } from "../contract/api";

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
  signal?: AbortSignal;
}

/**
 * Browser-side calls go through the same-origin BFF at /api/v1, which holds the
 * session cookies and attaches the bearer token. Tokens never reach JavaScript.
 */
export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/v1/${path.replace(/^\//, "")}`, {
      method: opts.method ?? "GET",
      headers: { accept: "application/json", ...(opts.body !== undefined ? { "content-type": "application/json" } : {}) },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      cache: "no-store",
      signal: opts.signal,
      credentials: "same-origin",
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Network error");
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const body = text ? (safeParse(text) as unknown) : undefined;
  if (!res.ok) {
    const err = body as ApiErrorBody | undefined;
    throw new ApiError(res.status, err?.code ?? "HTTP_ERROR", err?.message ?? `Request failed (${res.status})`, err?.details);
  }
  return body as T;
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export function errorCode(error: unknown): string {
  return error instanceof ApiError ? error.code : "UNKNOWN";
}
