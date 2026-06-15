// Manejo de fechas sensible a la zona horaria del negocio.
//
// Las reservas guardan `date` como @db.Date a medianoche UTC, que representa un
// DÍA CALENDARIO (no un instante). El problema: "hoy" y "mañana" dependen de la
// zona horaria del negocio, no del servidor (Vercel corre en UTC). Cerca de la
// medianoche, usar UTC corre el día. Estos helpers calculan el día calendario
// correcto en la tz dada.

export const DEFAULT_TZ = process.env.APP_TIMEZONE || "America/Asuncion";

/** Día calendario ("YYYY-MM-DD") de un instante en la zona horaria dada. */
export function ymdInTz(date: Date, tz: string = DEFAULT_TZ): string {
  // en-CA formatea como YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** "Hoy" como "YYYY-MM-DD" en la tz del negocio. */
export function todayInTz(tz: string = DEFAULT_TZ): string {
  return ymdInTz(new Date(), tz);
}

/** Suma `n` días a un "YYYY-MM-DD" y devuelve "YYYY-MM-DD" (aritmética en UTC, sin DST). */
export function addDaysYmd(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().split("T")[0];
}

/** Date a medianoche UTC para un "YYYY-MM-DD" (cómo se guarda @db.Date). */
export function ymdToUtcDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/**
 * Rango [start, end) en Date UTC-midnight que cubre el día calendario "mañana"
 * en la tz dada. Pensado para el cron de recordatorios: busca reservas cuyo
 * `date` (día calendario) sea el de mañana en la tz del negocio.
 */
export function tomorrowRange(tz: string = DEFAULT_TZ, now: Date = new Date()): {
  ymd: string;
  start: Date;
  end: Date;
} {
  const tomorrowYmd = addDaysYmd(ymdInTz(now, tz), 1);
  const start = ymdToUtcDate(tomorrowYmd);
  const end = ymdToUtcDate(addDaysYmd(tomorrowYmd, 1));
  return { ymd: tomorrowYmd, start, end };
}
