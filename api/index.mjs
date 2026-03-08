// Vercel serverless function — imports the pre-built server bundle
// The server is bundled by esbuild during build:vercel into dist/server.mjs
import app from "../dist/server.mjs";

export default app;
