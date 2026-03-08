// dotenv/config loads .env in dev; safely no-ops if file is absent (e.g. Vercel)
import "dotenv/config";

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
}

function optional(key: string, fallback = ""): string {
  return process.env[key] ?? fallback;
}

// All properties use lazy getters so nothing throws at module-load time.
// This prevents Vercel's serverless function from crashing during initialization.
export const ENV = {
  // Database
  get databaseUrl() {
    return required("DATABASE_URL");
  },

  // JWT
  get jwtSecret() {
    return required("JWT_SECRET");
  },

  // Google OAuth
  get googleClientId() {
    return optional("GOOGLE_CLIENT_ID");
  },
  get googleClientSecret() {
    return optional("GOOGLE_CLIENT_SECRET");
  },

  // Apple Sign-In
  get appleClientId() {
    return optional("APPLE_CLIENT_ID");
  },
  get appleTeamId() {
    return optional("APPLE_TEAM_ID");
  },
  get appleKeyId() {
    return optional("APPLE_KEY_ID");
  },
  get applePrivateKey() {
    return optional("APPLE_PRIVATE_KEY");
  },

  // AI - Gemini
  get geminiApiKey() {
    return optional("GEMINI_API_KEY");
  },

  // AI - Stable Diffusion (Stability AI)
  get stabilityApiKey() {
    return optional("STABILITY_API_KEY");
  },

  // Storage - GCS
  get gcsBucket() {
    return optional("GCS_BUCKET");
  },
  get gcsProjectId() {
    return optional("GCS_PROJECT_ID");
  },

  // App
  get appUrl() {
    return optional("APP_URL", "http://localhost:5173");
  },
  get ownerOpenId() {
    return optional("OWNER_OPEN_ID");
  },

  // Node
  get nodeEnv() {
    return optional("NODE_ENV", "development");
  },
  get isDev() {
    return this.nodeEnv === "development";
  },
};
