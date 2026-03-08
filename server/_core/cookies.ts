import type { Request } from "express";
import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const";

export function getSessionCookieOptions(_req?: Request) {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax" as const,
    maxAge: ONE_YEAR_MS,
    path: "/",
  };
}

export { COOKIE_NAME };
