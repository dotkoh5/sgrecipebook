import "dotenv/config";

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
}

function optional(key: string, fallback = ""): string {
  return process.env[key] ?? fallback;
}

export const ENV = {
  // Database
  databaseUrl: required("DATABASE_URL"),

  // JWT
  jwtSecret: required("JWT_SECRET"),

  // Google OAuth
  googleClientId: optional("GOOGLE_CLIENT_ID"),
  googleClientSecret: optional("GOOGLE_CLIENT_SECRET"),

  // Apple Sign-In
  appleClientId: optional("APPLE_CLIENT_ID"),
  appleTeamId: optional("APPLE_TEAM_ID"),
  appleKeyId: optional("APPLE_KEY_ID"),
  applePrivateKey: optional("APPLE_PRIVATE_KEY"),

  // AI - Gemini
  geminiApiKey: optional("GEMINI_API_KEY"),

  // Storage - GCS
  gcsBucket: optional("GCS_BUCKET"),
  gcsProjectId: optional("GCS_PROJECT_ID"),

  // App
  appUrl: optional("APP_URL", "http://localhost:5173"),
  ownerOpenId: optional("OWNER_OPEN_ID"),

  // Node
  nodeEnv: optional("NODE_ENV", "development"),
  get isDev() {
    return this.nodeEnv === "development";
  },
} as const;
