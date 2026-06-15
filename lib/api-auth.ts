// Helpers para los route handlers autenticados del dashboard.
// Elimina el patrón repetido ~15 veces: auth() -> findFirst({ownerId}) -> 401/404.
//
// Uso típico:
//   const ctx = await requireBusiness();
//   if ("response" in ctx) return ctx.response;
//   const { business } = ctx;   // { id, plan, planExpiry, trialEndsAt, timezone }

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const apiError = {
  unauthenticated: () => NextResponse.json({ error: "No autenticado" }, { status: 401 }),
  noBusiness: () => NextResponse.json({ error: "Sin negocio" }, { status: 404 }),
  server: () => NextResponse.json({ error: "Error interno del servidor" }, { status: 500 }),
};

// Campos del negocio que casi todas las rutas necesitan (id + plan/trial + tz).
const DEFAULT_BUSINESS_SELECT = {
  id: true,
  plan: true,
  planExpiry: true,
  trialEndsAt: true,
  timezone: true,
} as const;

export interface SessionBusiness {
  id: string;
  plan: string;
  planExpiry: Date | null;
  trialEndsAt: Date | null;
  timezone: string;
}

type Guard<T> = { response: NextResponse } | T;

/** Exige sesión. Devuelve { userId } o { response } con el 401. */
export async function requireUserId(): Promise<Guard<{ userId: string }>> {
  const session = await auth();
  if (!session?.user?.id) return { response: apiError.unauthenticated() };
  return { userId: session.user.id };
}

/**
 * Exige sesión Y que el usuario tenga un negocio. Devuelve { business } (campos
 * por defecto) o { response } con el 401/404 correspondiente.
 */
export async function requireBusiness(): Promise<Guard<{ business: SessionBusiness; userId: string }>> {
  const u = await requireUserId();
  if ("response" in u) return u;

  const business = await prisma.business.findFirst({
    where: { ownerId: u.userId },
    select: DEFAULT_BUSINESS_SELECT,
  });
  if (!business) return { response: apiError.noBusiness() };

  return { business, userId: u.userId };
}
