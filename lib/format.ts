// Formatters compartidos (cliente + server). Funciones PURAS, sin IO.
// Centraliza el formateo de precios y fechas que antes estaba duplicado byte-a-byte
// en ~8 archivos (page del dashboard, settings, services, clientes, turno, etc.).

/** "Gs. 1.234.567" o "A consultar" si el precio es null. */
export function formatGs(price: number | null): string {
  if (price === null) return "A consultar";
  return `Gs. ${new Intl.NumberFormat("es-PY").format(price)}`;
}

/** Solo el número con separador de miles paraguayo, sin prefijo: "1.234.567". */
export function formatNumberPy(n: number): string {
  return new Intl.NumberFormat("es-PY").format(n);
}

/** "YYYY-MM-DD" de HOY en hora LOCAL. Para el `min` de inputs date del cliente. */
export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Parsea "YYYY-MM-DD" a Date local a medianoche (solo para formateo de display). */
function ymdToLocalDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** "lunes, 5 de enero" (sin año). Agenda del día y mensajes de WhatsApp. */
export function formatDayMonth(ymd: string): string {
  return ymdToLocalDate(ymd).toLocaleDateString("es-PY", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** "lunes, 5 de enero de 2026" (con año). Confirmaciones y pantalla de gestión. */
export function formatDayMonthYear(ymd: string): string {
  return ymdToLocalDate(ymd).toLocaleDateString("es-PY", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
