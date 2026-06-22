// Utilidades de fecha/hora compartidas.
// Las fechas de reserva se manejan a medianoche UTC para evitar desfasajes
// por la timezone del servidor (Vercel corre en UTC).

/** Parsea "YYYY-MM-DD" a Date en medianoche UTC. Devuelve null si el formato es inválido. */
export function parseDateUTC(dateStr: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const [year, month, day] = dateStr.split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  // Rechaza fechas imposibles que JS normaliza (ej. 2026-02-31)
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

/**
 * Suma minutos a un "HH:mm" y devuelve "HH:mm". El resultado ENVUELVE a 24h por
 * diseño (`23:45 + 30 = "00:15"`), porque se usa para mostrar horarios de fin.
 * CONTRATO: los callers NO deben asumir que el resultado es mayor que `time`
 * cuando cruza medianoche (un fin "00:15" es < "23:45" como string). En la práctica
 * los slots que ofrece el motor siempre entran completos antes del cierre (≤ 24:00),
 * así que un fin de turno real nunca se envuelve; el wrap solo aplica al display de
 * configuraciones límite. Si algún día se necesita comparar rangos que crucen
 * medianoche, usar minutos absolutos (no este "HH:mm"). Pinneado por test en date.test.ts.
 */
export function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const endH = Math.floor(total / 60) % 24;
  const endM = total % 60;
  return `${endH.toString().padStart(2, "0")}:${endM.toString().padStart(2, "0")}`;
}

/** Convierte un Date (columna @db.Date) a "YYYY-MM-DD" en UTC. */
export function dateToISODate(date: Date): string {
  return date.toISOString().split("T")[0];
}

/**
 * Minutos entre dos "HH:mm" (end − start). Asume que no cruzan medianoche (los turnos
 * reales nunca se envuelven; ver contrato de addMinutes). Útil para recuperar la
 * duración total de un turno ya creado a partir de su startTime/endTime.
 */
export function diffMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return eh * 60 + em - (sh * 60 + sm);
}
