// Vercel serverless function — wraps the Express app with error diagnostics
let app: any;
let initError: Error | null = null;
let initialized = false;

async function initialize() {
  if (initialized) return;
  initialized = true;
  try {
    const mod = await import("../server/index");
    app = mod.default;
  } catch (err: any) {
    initError = err;
    console.error("[Vercel Init Error]", err);
  }
}

export default async function handler(req: any, res: any) {
  await initialize();

  if (initError) {
    return res.status(500).json({
      error: "Function initialization failed",
      message: initError.message,
      stack: process.env.NODE_ENV !== "production" ? initError.stack : undefined,
    });
  }

  return app(req, res);
}
