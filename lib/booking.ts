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

/**
 * Genera horarios de inicio en [startTime, endTime) avanzando `stepMinutes` por paso.
 * Un candidato se incluye solo si un bloque de `fitMinutes` entra antes de `endTime`
 * (por defecto fit = step). Separar paso y fit permite buffers: el paso es
 * duración+buffer (deja el colchón entre turnos) pero lo que debe entrar antes del
 * cierre es solo la duración del servicio (el buffer puede caer tras el cierre).
 */
export function generateSlots(
  startTime: string,
  endTime: string,
  stepMinutes: number,
  fitMinutes: number = stepMinutes
): string[] {
  if (stepMinutes <= 0 || fitMinutes <= 0) return [];
  const slots: string[] = [];
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);
  let current = startH * 60 + startM;
  const end = endH * 60 + endM;
  while (current + fitMinutes <= end) {
    const h = Math.floor(current / 60).toString().padStart(2, "0");
    const m = (current % 60).toString().padStart(2, "0");
    slots.push(`${h}:${m}`);
    current += stepMinutes;
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
  // Fin OCUPADO del slot: fin del turno + buffer del servicio reservado. El caller
  // ya suma el buffer; el motor solo compara rangos.
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
 * Slots libres a partir de UNO O VARIOS bloques de atención del día (soporta turno
 * partido / pausa de almuerzo). Para cada bloque genera candidatos cada
 * duración+buffer y descarta los que se pisan con una reserva existente.
 *
 * `existing[].endTime` debe venir ya extendido con el buffer del servicio reservado
 * (fin ocupado). El candidato ocupa [slot, slot+duración+buffer): así el buffer se
 * respeta de ambos lados (entre el turno previo y el nuevo, y tras el nuevo).
 */
export function availableSlots(
  blocks: Array<{ startTime: string; endTime: string }>,
  durationMinutes: number,
  bufferMinutes: number,
  existing: BookedRange[]
): string[] {
  if (durationMinutes <= 0) return [];
  const buffer = Math.max(0, bufferMinutes);
  const step = durationMinutes + buffer;
  const out: string[] = [];
  for (const block of blocks) {
    const candidates = generateSlots(block.startTime, block.endTime, step, durationMinutes);
    for (const slot of candidates) {
      const occupiedEnd = addMinutes(slot, durationMinutes + buffer);
      const conflicts = existing.some((b) => rangesOverlap(slot, occupiedEnd, b.startTime, b.endTime));
      if (!conflicts) out.push(slot);
    }
  }
  // Ordenar y deduplicar por si dos bloques generan el mismo horario.
  return [...new Set(out)].sort();
}

export type SlotCheck = "ok" | "out_of_hours" | "taken";

/**
 * Valida un `startTime` pedido contra los bloques de atención y las reservas
 * existentes de un RECURSO ÚNICO (negocio sin profesionales). Distingue:
 *  - "out_of_hours": el horario no es un slot que el sistema ofrecería ese día
 *    (negocio cerrado, fuera de horario, o fuera de la grilla duración+buffer).
 *  - "taken": es un slot válido pero está ocupado (solape buffer-aware).
 *  - "ok": reservable.
 *
 * Es la garantía de que el POST de reserva acepta solo lo mismo que la UI ofrece
 * vía /slots: sin esto, un POST directo podía crear reservas fuera de horario.
 * `occupied[].endTime` debe venir ya extendido con el buffer (fin ocupado).
 */
export function checkSingleResourceSlot(
  blocks: Array<{ startTime: string; endTime: string }>,
  durationMinutes: number,
  bufferMinutes: number,
  occupied: BookedRange[],
  startTime: string
): SlotCheck {
  const offered = availableSlots(blocks, durationMinutes, bufferMinutes, []);
  if (!offered.includes(startTime)) return "out_of_hours";
  const free = availableSlots(blocks, durationMinutes, bufferMinutes, occupied);
  if (!free.includes(startTime)) return "taken";
  return "ok";
}

/** Une (dedup + ordena) los slots libres de varios recursos/profesionales. Un slot
 *  se ofrece si AL MENOS UNO está libre en ese horario. */
export function unionSlots(slotLists: string[][]): string[] {
  const set = new Set<string>();
  for (const list of slotLists) for (const s of list) set.add(s);
  return [...set].sort();
}

/** ¿Este profesional puede hacer el servicio? Sin servicios asignados = hace todos. */
export function staffCanDoService(staffServiceIds: string[], serviceId: string): boolean {
  return staffServiceIds.length === 0 || staffServiceIds.includes(serviceId);
}

/**
 * Elige el PRIMER profesional (en el orden dado) que tiene `slotStart` libre, dado
 * sus bloques de disponibilidad y sus rangos ocupados (fin ya extendido con buffer).
 * Devuelve su id, o null si ninguno está libre. El orden de `candidateIds` define la
 * preferencia (p.ej. por antigüedad) para la asignación "cualquiera disponible".
 */
export function pickAvailableStaff(
  candidateIds: string[],
  blocksByStaff: Map<string, Array<{ startTime: string; endTime: string }>>,
  occupiedByStaff: Map<string, BookedRange[]>,
  slotStart: string,
  durationMinutes: number,
  bufferMinutes: number
): string | null {
  for (const id of candidateIds) {
    const free = availableSlots(
      blocksByStaff.get(id) ?? [], durationMinutes, bufferMinutes, occupiedByStaff.get(id) ?? []
    ).includes(slotStart);
    if (free) return id;
  }
  return null;
}
