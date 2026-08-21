import crypto from "crypto";
import { headers } from "next/headers";

// HMAC instead of a bare hash so a stored visitor hash can never be reversed
// back to a raw IP by brute-forcing the small IPv4 space — the secret makes
// that infeasible. Falls back to a fixed bucket when no secret is set (local
// dev without INTERACTION_HASH_SECRET), which only means every visitor
// collapses onto one bucket locally; production must set this.
export function hashIp(ip: string): string {
  const secret = process.env.INTERACTION_HASH_SECRET ?? "dev-only-insecure-secret";
  return crypto.createHmac("sha256", secret).update(ip).digest("hex");
}

function ipFromHeaders(getHeader: (name: string) => string | null): string {
  const forwardedFor = getHeader("x-forwarded-for");
  return (
    forwardedFor?.split(",")[0]?.trim() || getHeader("x-real-ip") || "unknown"
  );
}

// For Route Handlers, which receive the Request directly.
export function visitorHashFromRequest(request: Request): string {
  return hashIp(ipFromHeaders((name) => request.headers.get(name)));
}

// For Server Actions and Server Components, which read headers() instead.
export async function visitorHash(): Promise<string> {
  const headerList = await headers();
  return hashIp(ipFromHeaders((name) => headerList.get(name)));
}
