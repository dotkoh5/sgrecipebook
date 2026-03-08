export function getLoginUrl(provider: "google" | "apple" = "google"): string {
  return `/api/auth/login/${provider}`;
}
