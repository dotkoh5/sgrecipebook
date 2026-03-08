import { Router, Request, Response } from "express";
import { SignJWT } from "jose";
import { ENV } from "./env";
import { getSessionCookieOptions } from "./cookies";
import * as db from "../db";

const authRouter = Router();

// ==================== GOOGLE OAUTH ====================

authRouter.get("/login/google", (_req: Request, res: Response) => {
  const params = new URLSearchParams({
    client_id: ENV.googleClientId,
    redirect_uri: `${ENV.appUrl}/api/auth/callback/google`,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "consent",
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

authRouter.get("/callback/google", async (req: Request, res: Response) => {
  try {
    const code = req.query.code as string;
    if (!code) {
      res.status(400).send("Missing authorization code");
      return;
    }

    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: ENV.googleClientId,
        client_secret: ENV.googleClientSecret,
        redirect_uri: `${ENV.appUrl}/api/auth/callback/google`,
        grant_type: "authorization_code",
      }),
    });

    const tokens = await tokenRes.json();
    if (!tokens.access_token) {
      console.error("[Auth] Google token exchange failed:", tokens);
      res.status(401).send("Authentication failed");
      return;
    }

    // Get user info
    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const userInfo = await userInfoRes.json();

    // Upsert user
    const openId = `google:${userInfo.sub}`;
    await db.upsertUser({
      openId,
      name: userInfo.name,
      email: userInfo.email,
      loginMethod: "google",
      avatarUrl: userInfo.picture,
      lastSignedIn: new Date(),
    });

    // Get user from DB
    const user = await db.getUserByOpenId(openId);
    if (!user) {
      res.status(500).send("Failed to create user");
      return;
    }

    // Create JWT session
    const secret = new TextEncoder().encode(ENV.jwtSecret);
    const token = await new SignJWT({
      sub: openId,
      userId: user.id,
      role: user.role,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("365d")
      .sign(secret);

    // Set session cookie
    const cookieOptions = getSessionCookieOptions(req);
    res.cookie("app_session_id", token, cookieOptions);

    // Redirect to home or onboarding
    const redirectTo = user.hasCompletedOnboarding ? "/" : "/submit";
    res.redirect(redirectTo);
  } catch (error) {
    console.error("[Auth] Google callback error:", error);
    res.status(500).send("Authentication failed");
  }
});

// ==================== APPLE SIGN-IN ====================

authRouter.get("/login/apple", (_req: Request, res: Response) => {
  if (!ENV.appleClientId) {
    res.status(501).send("Apple Sign-In not configured");
    return;
  }

  const params = new URLSearchParams({
    client_id: ENV.appleClientId,
    redirect_uri: `${ENV.appUrl}/api/auth/callback/apple`,
    response_type: "code id_token",
    scope: "name email",
    response_mode: "form_post",
  });
  res.redirect(`https://appleid.apple.com/auth/authorize?${params}`);
});

authRouter.post("/callback/apple", async (req: Request, res: Response) => {
  try {
    const { code, id_token, user: userDataStr } = req.body;
    if (!code && !id_token) {
      res.status(400).send("Missing authorization data");
      return;
    }

    // Decode the id_token to get user info (Apple sends a JWT)
    let sub = "";
    let email = "";
    let name = "";

    if (id_token) {
      // Decode JWT payload (we trust Apple's token here)
      const payload = JSON.parse(
        Buffer.from(id_token.split(".")[1], "base64").toString()
      );
      sub = payload.sub;
      email = payload.email || "";
    }

    // Apple sends user info only on first sign-in
    if (userDataStr) {
      try {
        const userData = typeof userDataStr === "string" ? JSON.parse(userDataStr) : userDataStr;
        if (userData.name) {
          name = [userData.name.firstName, userData.name.lastName]
            .filter(Boolean)
            .join(" ");
        }
      } catch {
        // Ignore parse errors
      }
    }

    // Upsert user
    const openId = `apple:${sub}`;
    await db.upsertUser({
      openId,
      name: name || undefined,
      email: email || undefined,
      loginMethod: "apple",
      lastSignedIn: new Date(),
    });

    const user = await db.getUserByOpenId(openId);
    if (!user) {
      res.status(500).send("Failed to create user");
      return;
    }

    // Create JWT session
    const secret = new TextEncoder().encode(ENV.jwtSecret);
    const token = await new SignJWT({
      sub: openId,
      userId: user.id,
      role: user.role,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("365d")
      .sign(secret);

    const cookieOptions = getSessionCookieOptions(req);
    res.cookie("app_session_id", token, cookieOptions);

    const redirectTo = user.hasCompletedOnboarding ? "/" : "/submit";
    res.redirect(redirectTo);
  } catch (error) {
    console.error("[Auth] Apple callback error:", error);
    res.status(500).send("Authentication failed");
  }
});

// ==================== LOGOUT ====================

authRouter.post("/logout", (req: Request, res: Response) => {
  const cookieOptions = getSessionCookieOptions(req);
  res.clearCookie("app_session_id", { ...cookieOptions, maxAge: -1 });
  res.json({ success: true });
});

export { authRouter };
