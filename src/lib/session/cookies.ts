export const ACCESS_COOKIE = "biy_admin_at";
export const REFRESH_COOKIE = "biy_admin_rt";
export const ACCESS_MAX_AGE = 60 * 60 * 12;
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

export const SESSION_ISSUING_PATHS = ["admin/auth/login", "admin/auth/refresh"];
export const SESSION_CLEARING_PATHS = ["admin/auth/logout"];
