import type { Metadata } from "next";

// Página con token de un solo uso en la URL → no debe indexarse ni seguirse.
// La page es Client Component (useSearchParams) y no puede exportar metadata,
// así que el noindex vive en este layout server.
export const metadata: Metadata = {
  title: "Restablecer contraseña",
  robots: { index: false, follow: false },
};

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
