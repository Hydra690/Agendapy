import type { NextConfig } from "next";

// Headers de seguridad aplicados a todas las rutas.
const securityHeaders = [
  // Evita que el navegador adivine el MIME type (mitiga ataques de contenido).
  { key: "X-Content-Type-Options", value: "nosniff" },
  // No permite que el sitio se embeba en iframes de otros orígenes (clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
  // Limita qué información de referrer se envía a sitios externos.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Desactiva APIs sensibles del navegador que la app no usa.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Fuerza HTTPS durante 2 años (incluye subdominios).
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
