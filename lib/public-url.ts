// Base pública del sitio, para construir los links de reserva que se MUESTRAN y se
// COMPARTEN (dashboard, onboarding). Va en NEXT_PUBLIC_ para poder leerse en el
// cliente (Next la inyecta en build). Fallback al dominio de producción.
//
// IMPORTANTE: mantené NEXT_PUBLIC_BASE_URL alineada con NEXTAUTH_URL (que usa el
// server para los links de gestión /turno y los callbacks de OAuth). Idealmente
// ambas = https://agendapy.com.py. Antes este valor estaba hardcodeado "agendapy.com.py"
// en varios componentes, lo que desalineaba el link compartido del dominio real del deploy.

export const PUBLIC_BASE_URL = (
  process.env.NEXT_PUBLIC_BASE_URL || "https://agendapy.com.py"
).replace(/\/$/, "");

/** Host sin protocolo, para mostrar: "agendapy.com.py". */
export function publicHost(): string {
  return PUBLIC_BASE_URL.replace(/^https?:\/\//, "");
}

/** URL pública completa de un negocio: "https://agendapy.com.py/mi-negocio". */
export function bookingUrl(slug: string): string {
  return `${PUBLIC_BASE_URL}/${slug}`;
}
