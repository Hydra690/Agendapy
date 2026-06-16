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
 * Instante UTC (Date) que corresponde a una hora de pared ("HH:mm") de un día
 * calendario ("YYYY-MM-DD") en la zona horaria dada. Resuelve el offset de la tz
 * en ese instante con el método de dos pasos (sin librerías): formatea un "guess"
 * en la tz y mide cuánto se corrió respecto de UTC. Paraguay no usa DST desde
 * 2024, así que no hay ambigüedad de horario.
 */
export function zonedToUtc(ymd: string, hhmm: string, tz: string = DEFAULT_TZ): Date {
  const [Y, M, D] = ymd.split("-").map(Number);
  const [h, m] = hhmm.split(":").map(Number);
  const guess = Date.UTC(Y, M - 1, D, h, m);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(guess));
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asTz = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  const offset = asTz - guess; // cuánto adelanta la tz respecto de UTC
  return new Date(guess - offset);
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
