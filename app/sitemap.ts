import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { PUBLIC_BASE_URL, bookingUrl } from "@/lib/public-url";
import { logError } from "@/lib/logger";

// Sitemap dinámico (convención app/sitemap.ts). Incluye:
//   - Rutas públicas estáticas (landing + puertas de entrada).
//   - Una entrada por cada negocio ACTIVO (su página pública /[slug]).
// NO incluye rutas privadas (dashboard, api, onboarding) ni con token
// (turno/[token], reset-password, verify-email): esas se bloquean en robots.ts
// y/o llevan noindex.
//
// Usa Prisma (Request-time API) → Next lo trata como ruta dinámica y lo regenera,
// así los negocios nuevos aparecen sin rebuild. Si la DB falla, degradamos a las
// rutas estáticas en vez de romper el sitemap entero (honestidad de señal).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: PUBLIC_BASE_URL, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${PUBLIC_BASE_URL}/register`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${PUBLIC_BASE_URL}/login`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
  ];

  let businessRoutes: MetadataRoute.Sitemap = [];
  try {
    const businesses = await prisma.business.findMany({
      where: { isActive: true },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    });
    businessRoutes = businesses.map((b) => ({
      url: bookingUrl(b.slug),
      lastModified: b.updatedAt,
      changeFrequency: "daily",
      priority: 0.7,
    }));
  } catch (error) {
    logError("[sitemap] no se pudieron listar negocios", error);
  }

  return [...staticRoutes, ...businessRoutes];
}
