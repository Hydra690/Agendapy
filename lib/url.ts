// URL base de la app, resuelta desde el entorno. Fuente única usada por los emails
// transaccionales y por los links de gestión de reserva que viajan en las
// notificaciones (WhatsApp/email). Sin acoplar a next/server, así sirve en server,
// scripts y tests.
//
// Prioridad: NEXTAUTH_URL (prod explícita) → VERCEL_URL (deploy) → localhost (dev).
export function appBaseUrl(): string {
  return (
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  ).replace(/\/$/, "");
}
