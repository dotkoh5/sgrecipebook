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
