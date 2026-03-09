import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers";
import { createContext } from "./_core/context";
import { authRouter } from "./_core/auth";
import { ENV } from "./_core/env";

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Body parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true })); // Apple sends form_post

// Health check — no DB, no auth, just confirms the function boots
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    env: {
      hasDbUrl: !!process.env.DATABASE_URL,
      hasJwt: !!process.env.JWT_SECRET,
      hasStabilityKey: !!process.env.STABILITY_API_KEY,
      hasGcsBucket: !!process.env.GCS_BUCKET,
      hasGcsServiceKey: !!process.env.GCS_SERVICE_ACCOUNT_KEY,
      nodeEnv: process.env.NODE_ENV,
      vercel: !!process.env.VERCEL,
    },
  });
});

// Image generation test — diagnose Stability API + GCS on Vercel
app.get("/api/test-image", async (_req, res) => {
  try {
    const { generateImage } = await import("./_core/imageGeneration");
    const result = await generateImage({
      prompt: "Professional food photography of chicken rice, warm lighting",
    });
    res.json({ success: true, url: result.url?.substring(0, 120) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack?.split('\n').slice(0, 3) : [];
    res.status(500).json({ success: false, error: message, stack });
  }
});

// Auth routes (OAuth callbacks)
app.use("/api/auth", authRouter);

// tRPC middleware
app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

// In local production mode, serve the built frontend
if (!ENV.isDev && !process.env.VERCEL) {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const staticDir = path.resolve(__dirname, "public");
  app.use(express.static(staticDir));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticDir, "index.html"));
  });
}

// Only listen when running standalone (not on Vercel)
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`[Server] Running on http://localhost:${PORT} (${ENV.nodeEnv})`);
  });
}

// Export for Vercel serverless function
export default app;
export type { AppRouter } from "./routers";
