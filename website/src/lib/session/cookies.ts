export const ACCESS_COOKIE = "biy_at";
export const REFRESH_COOKIE = "biy_rt";

export const ACCESS_MAX_AGE = 60 * 60 * 24; // the JWT expires sooner; the proxy refreshes on 401
export const REFRESH_MAX_AGE = 60 * 60 * 24 * 30;

export function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

/** Paths whose successful response carries a fresh token pair. */
export const SESSION_ISSUING_PATHS = [
  "auth/customer/otp/verify",
  "auth/customer/email/otp/verify",
  "auth/customer/email/otp/adopt",
  "auth/customer/google",
  "auth/customer/meta",
  "auth/customer/link/confirm",
  "auth/customer/exchange",
  "auth/customer/refresh",
];

export const SESSION_CLEARING_PATHS = ["auth/customer/logout", "auth/customer/logout/all"];
