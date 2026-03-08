import type { Request, Response } from "express";
import { jwtVerify } from "jose";
import cookie from "cookie";
import { COOKIE_NAME } from "../../shared/const";
import { ENV } from "./env";
import * as db from "../db";

export type User = NonNullable<Awaited<ReturnType<typeof db.getUserByOpenId>>>;

export interface Context {
  req: Request;
  res: Response;
  user: User | null;
}

export async function createContext({
  req,
  res,
}: {
  req: Request;
  res: Response;
}): Promise<Context> {
  let user: User | null = null;

  try {
    const cookies = cookie.parse(req.headers.cookie ?? "");
    const token = cookies[COOKIE_NAME];
    if (token) {
      const secret = new TextEncoder().encode(ENV.jwtSecret);
      const { payload } = await jwtVerify(token, secret);
      const openId = payload.sub;
      if (openId) {
        const found = await db.getUserByOpenId(openId);
        if (found) user = found;
      }
    }
  } catch {
    // Invalid or expired token — user stays null
  }

  return { req, res, user };
}
