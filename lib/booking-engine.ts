// Motor de reserva con efectos (DB): chequeo de disponibilidad + asignación de
// profesional + protección de concurrencia. A diferencia de lib/booking.ts (puro),
// esto toca Prisma. Lo comparten el POST de reserva y el reschedule, para que ambos
// usen EXACTAMENTE la misma garantía de slot e idéntico manejo de P2002/P2034.

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { addMinutes } from "@/lib/date";
import { todayInTz, meetsBookingNotice } from "@/lib/timezone";
import {
  checkSingleResourceSlot,
  staffCanDoService,
  dayOfWeekUTC,
  pickAvailableStaff,
  buildStaffSchedule,
} from "@/lib/booking";
import { ACTIVE_BOOKING_STATUSES } from "@/lib/constants";

// ─── Errores de dominio (compartidos por reserva y reschedule) ───────────────────

/** El slot está ocupado (solape buffer-aware o índice único parcial). 409. */
export class SlotTakenError extends Error {
  constructor() {
    super("slot_taken");
  }
}

/** El horario no es un slot que el sistema ofrecería (negocio cerrado / fuera de grilla). 400. */
export class SlotUnavailableError extends Error {
  constructor() {
    super("slot_unavailable");
  }
}

/** El horario no respeta la antelación mínima del negocio (o ya pasó). 400. */
export class BookingTooSoonError extends Error {
  readonly userMessage: string;
  constructor(noticeMinutes: number) {
    super("booking_too_soon");
    this.userMessage =
      noticeMinutes > 0
        ? "Ese horario ya no está disponible: el negocio requiere reservar con más anticipación."
        : "Ese horario ya pasó. Elegí un horario futuro.";
  }
}

/** La fecha es anterior a hoy (en la tz del negocio). 400. */
export class PastDateError extends Error {
  constructor() {
    super("past_date");
  }
}

/** La fecha está bloqueada por el negocio (feriado/vacaciones). 400. */
export class BlockedDateError extends Error {
  readonly reason: string | null;
  constructor(reason: string | null) {
    super("blocked_date");
    this.reason = reason;
  }
}

/** Se pidió un profesional que no hace este servicio. 400. */
export class StaffServiceMismatchError extends Error {
  constructor() {
    super("staff_service_mismatch");
  }
}

/** Ningún profesional del negocio ofrece este servicio. 400. */
export class NoStaffForServiceError extends Error {
  constructor() {
    super("no_staff_for_service");
  }
}

// ─── Validación de tiempo (pre-transacción, lecturas idempotentes) ───────────────

interface TimingBusiness {
  id: string;
  timezone: string;
  minBookingNoticeMinutes: number;
}

/**
 * Reglas de tiempo comunes a reservar y reprogramar: no fechas pasadas, antelación
 * mínima del negocio, y fecha no bloqueada. Lanza el error tipado correspondiente.
 */
export async function assertBookingTiming(
  business: TimingBusiness,
  dateParam: string,
  bookingDate: Date,
  startTime: string
): Promise<void> {
  if (dateParam < todayInTz(business.timezone)) {
    throw new PastDateError();
  }
  if (!meetsBookingNotice(dateParam, startTime, business.minBookingNoticeMinutes, business.timezone)) {
    throw new BookingTooSoonError(business.minBookingNoticeMinutes);
  }
  const blocked = await prisma.blockedDate.findUnique({
    where: { businessId_date: { businessId: business.id, date: bookingDate } },
  });
  if (blocked) {
    throw new BlockedDateError(blocked.reason);
  }
}

// ─── Asignación de slot dentro de una transacción ────────────────────────────────

interface ReserveSlotParams {
  businessId: string;
  service: { id: string; duration: number; bufferMinutes: number };
  bookingDate: Date;
  startTime: string;
  /** Profesional pedido explícitamente; si falta, se asigna el primero libre. */
  requestedStaffId?: string;
  /** Reserva a ignorar en el chequeo de ocupación (reschedule: la propia reserva). */
  excludeBookingId?: string;
}

/**
 * Verifica disponibilidad del slot y asigna profesional, DENTRO de la transacción
 * `tx`. Devuelve el staffId asignado (o null si el negocio es recurso único). Lanza
 * SlotTaken/SlotUnavailable/StaffServiceMismatch/NoStaffForService según el caso.
 *
 * El caller hace el create/update real con el staffId devuelto, en la MISMA tx, y
 * envuelve todo en withSerializableRetry: si dos reservas solapadas concurrentes
 * pasan el pre-chequeo, Postgres aborta una (P2034) y se reintenta.
 */
export async function assignAndReserveSlot(
  tx: Prisma.TransactionClient,
  params: ReserveSlotParams
): Promise<string | null> {
  const { businessId, service, bookingDate, startTime, requestedStaffId, excludeBookingId } = params;
  const excludeFilter = excludeBookingId ? { id: { not: excludeBookingId } } : {};

  const activeStaff = await tx.staff.findMany({
    where: { businessId, isActive: true },
    select: { id: true, services: { select: { id: true } } },
    orderBy: { createdAt: "asc" },
  });

  if (activeStaff.length === 0) {
    // ---- Recurso único (sin profesionales): disponibilidad + solape ----
    // No alcanza con chequear solape: el slot debe caer dentro de un bloque de
    // atención del día y sobre la grilla duración+buffer (lo mismo que ofrece /slots).
    const dow = dayOfWeekUTC(bookingDate);
    const [blocks, sameDayActive] = await Promise.all([
      tx.availability.findMany({
        where: { businessId, dayOfWeek: dow, isActive: true, staffId: null },
        select: { startTime: true, endTime: true },
      }),
      tx.booking.findMany({
        where: { businessId, date: bookingDate, status: { in: [...ACTIVE_BOOKING_STATUSES] }, ...excludeFilter },
        select: { startTime: true, endTime: true, service: { select: { bufferMinutes: true } } },
      }),
    ]);
    const occupied = sameDayActive.map((b) => ({
      startTime: b.startTime,
      endTime: addMinutes(b.endTime, b.service.bufferMinutes),
    }));
    const check = checkSingleResourceSlot(blocks, service.duration, service.bufferMinutes, occupied, startTime);
    if (check === "out_of_hours") throw new SlotUnavailableError();
    if (check === "taken") throw new SlotTakenError();
    return null;
  }

  // ---- Multi-profesional: asignar un profesional elegible y LIBRE ----
  let candidates = activeStaff.filter((s) => staffCanDoService(s.services.map((x) => x.id), service.id));
  if (requestedStaffId) {
    candidates = candidates.filter((s) => s.id === requestedStaffId);
    if (candidates.length === 0) throw new StaffServiceMismatchError();
  }
  if (candidates.length === 0) throw new NoStaffForServiceError();

  const ids = candidates.map((s) => s.id);
  const dow = dayOfWeekUTC(bookingDate);
  const [availRows, bookingRows] = await Promise.all([
    tx.availability.findMany({
      where: { businessId, dayOfWeek: dow, isActive: true, staffId: { in: ids } },
      select: { staffId: true, startTime: true, endTime: true },
    }),
    tx.booking.findMany({
      where: { businessId, date: bookingDate, status: { in: [...ACTIVE_BOOKING_STATUSES] }, staffId: { in: ids }, ...excludeFilter },
      select: { staffId: true, startTime: true, endTime: true, service: { select: { bufferMinutes: true } } },
    }),
  ]);
  const { blocksByStaff, occByStaff } = buildStaffSchedule(
    availRows.map((r) => ({ staffId: r.staffId!, startTime: r.startTime, endTime: r.endTime })),
    bookingRows.map((b) => ({ staffId: b.staffId!, startTime: b.startTime, endTime: b.endTime, bufferMinutes: b.service.bufferMinutes }))
  );
  // Primer profesional (orden estable por antigüedad) con el slot libre.
  const assignedStaffId = pickAvailableStaff(
    candidates.map((s) => s.id), blocksByStaff, occByStaff, startTime, service.duration, service.bufferMinutes
  );
  if (!assignedStaffId) throw new SlotTakenError();
  return assignedStaffId;
}

/**
 * Ejecuta `fn` reintentando ante fallos de serialización (Prisma P2034), que el
 * nivel SERIALIZABLE lanza cuando dos transacciones concurrentes entran en conflicto.
 * Los errores de dominio (SlotTaken, etc.) NO son P2034 y se propagan sin reintento.
 */
export async function withSerializableRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (
        attempt < maxAttempts &&
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2034"
      ) {
        lastError = e;
        continue;
      }
      throw e;
    }
  }
  throw lastError;
}
