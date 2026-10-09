import { NextResponse, type NextRequest } from "next/server";
import {
  ACCESS_COOKIE,
  ACCESS_MAX_AGE,
  REFRESH_COOKIE,
  REFRESH_MAX_AGE,
  SESSION_CLEARING_PATHS,
  SESSION_ISSUING_PATHS,
  cookieOptions,
} from "@/lib/session/cookies";

const API_URL = process.env.BIY_API_URL?.replace(/\/$/, "") || "http://127.0.0.1:3300/api/v1";
const HOP = new Set(["content-type", "accept", "accept-language"]);

interface TokenPair {
  accessToken?: string;
  refreshToken?: string;
}

/** Same BFF as the website, with admin cookies: tokens stay server-side, one silent refresh on 401. */
async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const joined = path.join("/");
  const target = `${API_URL}/${path.map(encodeURIComponent).join("/")}${request.nextUrl.search}`;
  const body = ["GET", "HEAD"].includes(request.method) ? undefined : await request.arrayBuffer();

  let access = request.cookies.get(ACCESS_COOKIE)?.value;
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
  let rotated: TokenPair | undefined;

  let upstream = await forward(request, target, body, access);
  if (upstream.status === 401 && refresh && !SESSION_ISSUING_PATHS.includes(joined)) {
    const fresh = await refreshSession(refresh);
    if (fresh) {
      rotated = fresh;
      access = fresh.accessToken;
      upstream = await forward(request, target, body, access);
    }
  }

  const text = await upstream.text();
  let payload: unknown = text ? safeParse(text) : undefined;
  if (upstream.ok && SESSION_ISSUING_PATHS.includes(joined) && isTokenPair(payload)) {
    rotated = { accessToken: payload.accessToken, refreshToken: payload.refreshToken };
    const { accessToken: _a, refreshToken: _r, ...rest } = payload;
    payload = rest;
  }

  const response =
    upstream.status === 204 || payload === undefined
      ? new NextResponse(text || null, { status: upstream.status, headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" } })
      : NextResponse.json(payload, { status: upstream.status });

  if (rotated?.accessToken && rotated.refreshToken) {
    response.cookies.set(ACCESS_COOKIE, rotated.accessToken, cookieOptions(ACCESS_MAX_AGE));
    response.cookies.set(REFRESH_COOKIE, rotated.refreshToken, cookieOptions(REFRESH_MAX_AGE));
  }
  if (SESSION_CLEARING_PATHS.includes(joined) || (upstream.status === 401 && !rotated)) {
    response.cookies.set(ACCESS_COOKIE, "", cookieOptions(0));
    response.cookies.set(REFRESH_COOKIE, "", cookieOptions(0));
  }
  return response;
}

async function forward(request: NextRequest, target: string, body: ArrayBuffer | undefined, access?: string): Promise<Response> {
  const headers = new Headers();
  for (const [key, value] of request.headers) {
    if (HOP.has(key.toLowerCase())) headers.set(key, value);
  }
  if (access) headers.set("authorization", `Bearer ${access}`);
  try {
    return await fetch(target, { method: request.method, headers, body, cache: "no-store", redirect: "manual" });
  } catch {
    return new Response(JSON.stringify({ code: "NETWORK_ERROR", message: "API unreachable", statusCode: 503 }), {
      status: 503,
      headers: { "content-type": "application/json" },
    });
  }
}

async function refreshSession(refreshToken: string): Promise<TokenPair | null> {
  try {
    const res = await fetch(`${API_URL}/admin/auth/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as TokenPair;
    return json.accessToken && json.refreshToken ? json : null;
  } catch {
    return null;
  }
}

function isTokenPair(value: unknown): value is TokenPair & Record<string, unknown> {
  return typeof value === "object" && value !== null && typeof (value as TokenPair).accessToken === "string" && typeof (value as TokenPair).refreshToken === "string";
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const PUT = proxy;
export const DELETE = proxy;
