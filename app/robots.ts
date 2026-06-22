import type { MetadataRoute } from "next";
import { PUBLIC_BASE_URL } from "@/lib/public-url";

// robots.txt dinámico (convención app/robots.ts). Permite el sitio público y
// bloquea las áreas privadas / con datos personales:
//   - /dashboard  → panel del dueño (requiere sesión)
//   - /api        → endpoints, no son páginas
//   - /onboarding → requiere auth (redirige a /login)
//   - /turno      → gestión de reserva por token (datos personales del cliente)
// Las páginas con token de auth (reset-password, verify-email) llevan noindex en
// su propio layout, NO se bloquean acá a propósito: así el crawler puede leer el
// noindex si alguna vez llega por un link, en vez de quedar bloqueado a ciegas.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/api", "/onboarding", "/turno"],
    },
    sitemap: `${PUBLIC_BASE_URL}/sitemap.xml`,
    host: PUBLIC_BASE_URL,
  };
}
