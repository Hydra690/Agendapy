// Lógica de dominio de reservas — funciones PURAS, sin DB ni red.
// Centraliza las reglas de slots/solapamiento que antes vivían dentro de los
// route handlers (y por eso solo se podían testear por HTTP). Acá son testeables.

import type { DayOfWeek } from "@prisma/client";
import { addMinutes } from "@/lib/date";

export const DAY_BY_INDEX: Record<number, DayOfWeek> = {
  0: "SUNDAY",
  1: "MONDAY",
  2: "TUESDAY",
  3: "WEDNESDAY",
  4: "THURSDAY",
  5: "FRIDAY",
  6: "SATURDAY",
};

/** Día de la semana (enum Prisma) de un Date, leído en UTC (la fecha es un día calendario). */
export function dayOfWeekUTC(date: Date): DayOfWeek {
  return DAY_BY_INDEX[date.getUTCDay()];
}

/** Genera los horarios de inicio posibles entre [startTime, endTime) en pasos de `duration`. */
export function generateSlots(startTime: string, endTime: string, durationMinutes: number): string[] {
  if (durationMinutes <= 0) return [];
  const slots: string[] = [];
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);
  let current = startH * 60 + startM;
  const end = endH * 60 + endM;
  while (current + durationMinutes <= end) {
    const h = Math.floor(current / 60).toString().padStart(2, "0");
    const m = (current % 60).toString().padStart(2, "0");
    slots.push(`${h}:${m}`);
    current += durationMinutes;
  }
  return slots;
}

/**
 * ¿Se solapan los rangos [aStart,aEnd) y [bStart,bEnd)? Como "HH:mm" tiene ancho
 * fijo, la comparación lexicográfica equivale a la temporal.
 */
export function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && aEnd > bStart;
}

export interface BookedRange {
  startTime: string;
  endTime: string;
}

/** Instante límite hasta el que se puede cancelar: `windowHours` antes del turno. */
export function cancellationDeadline(appointment: Date, windowHours: number): Date {
  return new Date(appointment.getTime() - windowHours * 3_600_000);
}

/**
 * ¿Se puede cancelar AHORA? True si todavía falta al menos `windowHours` para el
 * turno (i.e. estamos antes del deadline). windowHours = 0 permite cancelar hasta
 * el mismo instante del turno.
 */
export function canCancelNow(appointment: Date, windowHours: number, now: Date = new Date()): boolean {
  return now.getTime() <= cancellationDeadline(appointment, windowHours).getTime();
}

/**
 * Slots libres: de todos los posibles, descarta los que se pisan con alguna
 * reserva existente (considerando la duración real de cada una, no solo el inicio).
 */
export function availableSlots(
  open: { startTime: string; endTime: string },
  durationMinutes: number,
  existing: BookedRange[]
): string[] {
  const all = generateSlots(open.startTime, open.endTime, durationMinutes);
  return all.filter((slot) => {
    const slotEnd = addMinutes(slot, durationMinutes);
    return !existing.some((b) => rangesOverlap(slot, slotEnd, b.startTime, b.endTime));
  });
}
