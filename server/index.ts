import express from "express";
import path from "path";
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

// In production, serve the built frontend
if (!ENV.isDev) {
  const staticDir = path.resolve(import.meta.dirname, "public");
  app.use(express.static(staticDir));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticDir, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`[Server] Running on http://localhost:${PORT} (${ENV.nodeEnv})`);
});

export type { AppRouter } from "./routers";
