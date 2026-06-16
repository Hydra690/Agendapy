import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isRateLimited } from "@/lib/ratelimit";

const { auth } = NextAuth(authConfig);

// ─── Rate limiting ────────────────────────────────────────────────────────────
// Límites por tipo de ruta (requests por minuto). El backend (Upstash Redis o
// Map en memoria) se resuelve en lib/ratelimit.ts según las env vars presentes.
const LIMITS: Record<string, number> = {
  bookings: 10,
  slots: 60,
  auth: 10, // login (callback/credentials) y register: freno anti fuerza bruta
  default: 30,
};

const WINDOW_MS = 60_000;

// Solo los endpoints de auth SENSIBLES (POST de login y registro). El resto de
// /api/auth/* (session, csrf, providers) se consulta seguido y NO se limita para
// no romper el flujo normal de NextAuth.
const SENSITIVE_AUTH_ROUTES = new Set([
  "/api/auth/callback/credentials",
  "/api/auth/register",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/auth/verify-email",
  "/api/auth/resend-verification",
]);

function isSensitiveAuthRoute(pathname: string): boolean {
  return SENSITIVE_AUTH_ROUTES.has(pathname);
}

function getRouteType(pathname: string): string {
  if (isSensitiveAuthRoute(pathname)) return "auth";
  if (/\/bookings(\/|$)/.test(pathname)) return "bookings";
  if (/\/slots(\/|$)/.test(pathname)) return "slots";
  return "default";
}

function getIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  );
}

function isPublicApiRoute(pathname: string): boolean {
  if (!pathname.startsWith("/api/")) return false;
  const afterApi = pathname.slice("/api/".length);
  return (
    !afterApi.startsWith("dashboard") &&
    !afterApi.startsWith("auth") &&
    !afterApi.startsWith("onboarding") &&
    !afterApi.startsWith("cron")
  );
}

function shouldRateLimit(pathname: string): boolean {
  return isPublicApiRoute(pathname) || isSensitiveAuthRoute(pathname);
}

async function applyRateLimit(request: NextRequest): Promise<NextResponse | null> {
  const { pathname } = request.nextUrl;
  const routeType = getRouteType(pathname);
  const limit = LIMITS[routeType] ?? LIMITS.default;
  const ip = getIp(request);
  const key = `rl:${ip}:${routeType}`;

  if (await isRateLimited(key, limit, WINDOW_MS)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  return null;
}
// ─────────────────────────────────────────────────────────────────────────────

export const proxy = auth(async function handler(request: NextRequest) {
  if (shouldRateLimit(request.nextUrl.pathname)) {
    const limited = await applyRateLimit(request);
    if (limited) return limited;
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/dashboard/:path*", "/onboarding/:path*", "/api/:path*"],
};
