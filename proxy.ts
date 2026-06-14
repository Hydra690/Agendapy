import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const { auth } = NextAuth(authConfig);

// ─── Rate limiting ────────────────────────────────────────────────────────────
// Límites por tipo de ruta (requests por minuto)
const LIMITS: Record<string, number> = {
  bookings: 10,
  slots: 60,
  default: 30,
};

const WINDOW_MS = 60_000;

// Map persiste entre requests porque Proxy corre en Node.js runtime (Next.js 16+).
// En un deploy multi-instancia este rate limit sería por instancia, no global.
const store = new Map<string, { count: number; reset: number }>();

function getRouteType(pathname: string): string {
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

function applyRateLimit(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl;
  const routeType = getRouteType(pathname);
  const limit = LIMITS[routeType] ?? LIMITS.default;
  const ip = getIp(request);
  const key = `${ip}:${routeType}`;
  const now = Date.now();

  let entry = store.get(key);
  if (!entry || now > entry.reset) {
    store.set(key, { count: 1, reset: now + WINDOW_MS });
    return null;
  }

  entry.count++;
  if (entry.count > limit) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  return null;
}
// ─────────────────────────────────────────────────────────────────────────────

export const proxy = auth(function handler(request: NextRequest) {
  if (isPublicApiRoute(request.nextUrl.pathname)) {
    const limited = applyRateLimit(request);
    if (limited) return limited;
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/dashboard/:path*", "/onboarding/:path*", "/api/:path*"],
};
