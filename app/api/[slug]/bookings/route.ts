import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BookingSchema, formatZodErrors } from "@/lib/validations";
import { logError } from "@/lib/logger";
import { notifyWhatsApp } from "@/lib/notify";
import { parseDateUTC, addMinutes, dateToISODate } from "@/lib/date";
import { todayInTz, meetsBookingNotice } from "@/lib/timezone";
import { checkSingleResourceSlot, staffCanDoService, dayOfWeekUTC, pickAvailableStaff, buildStaffSchedule } from "@/lib/booking";
import { ACTIVE_BOOKING_STATUSES } from "@/lib/constants";
import { ownerNewBookingMessage } from "@/lib/messages";
import { formatDayMonth } from "@/lib/format";

// NOTA: el listado de reservas por fecha es información sensible (PII de clientes)
// y vive solo en el dashboard autenticado: GET /api/dashboard/bookings.
// Este endpoint público expone únicamente la creación de reservas (POST).

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Cuerpo de la solicitud inválido" },
        { status: 400 }
      );
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Cuerpo de la solicitud inválido" },
        { status: 400 }
      );
    }

    const parsed = BookingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", fields: formatZodErrors(parsed.error.issues) },
        { status: 400 }
      );
    }

    const { serviceId, staffId, date: dateParam, startTime, clientName, clientWhatsapp, notes } = parsed.data;

    const bookingDate = parseDateUTC(dateParam);
    if (!bookingDate) {
      return NextResponse.json(
        { error: "Formato de fecha inválido. Usá YYYY-MM-DD" },
        { status: 400 }
      );
    }

    // Buscar el negocio (fuera de la transacción, lectura idempotente)
    const business = await prisma.business.findUnique({ where: { slug } });
    if (!business) {
      return NextResponse.json(
        { error: "Negocio no encontrado" },
        { status: 404 }
      );
    }

    // No permitir reservar en una fecha pasada (según la tz del negocio, no la del
    // servidor). El endpoint de slots ya lo valida, pero el POST era directo.
    if (dateParam < todayInTz(business.timezone)) {
      return NextResponse.json(
        { error: "No se pueden reservar fechas pasadas" },
        { status: 400 }
      );
    }

    // Antelación mínima: rechaza horarios ya pasados de hoy y los que no respetan el
    // colchón configurado por el negocio. Misma regla que aplica /slots al ocultar.
    if (!meetsBookingNotice(dateParam, startTime, business.minBookingNoticeMinutes, business.timezone)) {
      throw new BookingTooSoonError(business.minBookingNoticeMinutes);
    }

    // Fecha bloqueada por el negocio (feriado, vacaciones). El endpoint de slots
    // ya la oculta de la UI; acá la cortamos también para el POST directo.
    const blocked = await prisma.blockedDate.findUnique({
      where: { businessId_date: { businessId: business.id, date: bookingDate } },
    });
    if (blocked) {
      return NextResponse.json(
        { error: blocked.reason ?? "Esa fecha no está disponible para reservar" },
        { status: 400 }
      );
    }

    const service = await prisma.service.findFirst({
      where: { id: serviceId, businessId: business.id, isActive: true },
    });
    if (!service) {
      return NextResponse.json(
        { error: "Servicio no encontrado" },
        { status: 404 }
      );
    }

    const endTime = addMinutes(startTime, service.duration);

    // Límite de 2 reservas activas por cliente.
    const activeBookings = await prisma.booking.count({
      where: {
        businessId: business.id,
        client: { whatsapp: clientWhatsapp },
        status: { in: [...ACTIVE_BOOKING_STATUSES] },
      },
    });
    if (activeBookings >= 2) {
      throw new BookingLimitError();
    }

    // Upsert del cliente por whatsapp+negocio (idempotente; carrera cubierta por
    // el unique businessId_whatsapp → reintento de lectura). Va FUERA de la
    // transacción de slot: no es parte de la invariante de disponibilidad.
    const client = await upsertClient(business.id, clientWhatsapp, clientName.trim());

    // Asignación de profesional + chequeo de disponibilidad + creación, ATÓMICO.
    // El índice único parcial (Booking_active_slot_unique, COALESCE) garantiza la
    // unicidad del MISMO inicio, pero NO atrapa solapes con inicios distintos
    // (ej. 10:00 y 10:30 de 60min). Para eso, el chequeo (que lee las reservas del
    // día) y el create corren en una transacción SERIALIZABLE: si dos reservas
    // solapadas concurrentes pasan el pre-chequeo, Postgres aborta una (P2034) y la
    // reintentamos; en el reintento ya ve la otra reserva y la rechaza como "taken".
    const booking = await withSerializableRetry(() =>
      prisma.$transaction(
        async (tx) => {
          const activeStaff = await tx.staff.findMany({
            where: { businessId: business.id, isActive: true },
            select: { id: true, services: { select: { id: true } } },
            orderBy: { createdAt: "asc" },
          });

          let assignedStaffId: string | null = null;

          if (activeStaff.length === 0) {
            // ---- Recurso único (sin profesionales): disponibilidad + solape ----
            // No alcanza con chequear solape: el slot debe caer dentro de un bloque
            // de atención del día y sobre la grilla duración+buffer (lo mismo que
            // ofrece /slots). Si no, un POST directo crearía reservas fuera de horario.
            const dow = dayOfWeekUTC(bookingDate);
            const [blocks, sameDayActive] = await Promise.all([
              tx.availability.findMany({
                where: { businessId: business.id, dayOfWeek: dow, isActive: true, staffId: null },
                select: { startTime: true, endTime: true },
              }),
              tx.booking.findMany({
                where: { businessId: business.id, date: bookingDate, status: { in: [...ACTIVE_BOOKING_STATUSES] } },
                select: { startTime: true, endTime: true, service: { select: { bufferMinutes: true } } },
              }),
            ]);
            const occupied = sameDayActive.map(b => ({
              startTime: b.startTime,
              endTime: addMinutes(b.endTime, b.service.bufferMinutes),
            }));
            const check = checkSingleResourceSlot(blocks, service.duration, service.bufferMinutes, occupied, startTime);
            if (check === "out_of_hours") throw new SlotUnavailableError();
            if (check === "taken") throw new SlotTakenError();
          } else {
            // ---- Multi-profesional: asignar un profesional elegible y LIBRE ----
            let candidates = activeStaff.filter(s => staffCanDoService(s.services.map(x => x.id), service.id));
            if (staffId) {
              candidates = candidates.filter(s => s.id === staffId);
              if (candidates.length === 0) throw new StaffServiceMismatchError();
            }
            if (candidates.length === 0) throw new NoStaffForServiceError();

            const ids = candidates.map(s => s.id);
            const dow = dayOfWeekUTC(bookingDate);
            const [availRows, bookingRows] = await Promise.all([
              tx.availability.findMany({
                where: { businessId: business.id, dayOfWeek: dow, isActive: true, staffId: { in: ids } },
                select: { staffId: true, startTime: true, endTime: true },
              }),
              tx.booking.findMany({
                where: { businessId: business.id, date: bookingDate, status: { in: [...ACTIVE_BOOKING_STATUSES] }, staffId: { in: ids } },
                select: { staffId: true, startTime: true, endTime: true, service: { select: { bufferMinutes: true } } },
              }),
            ]);
            const { blocksByStaff, occByStaff } = buildStaffSchedule(
              availRows.map(r => ({ staffId: r.staffId!, startTime: r.startTime, endTime: r.endTime })),
              bookingRows.map(b => ({ staffId: b.staffId!, startTime: b.startTime, endTime: b.endTime, bufferMinutes: b.service.bufferMinutes }))
            );
            // Primer profesional (orden estable por antigüedad) con el slot libre.
            assignedStaffId = pickAvailableStaff(
              candidates.map(s => s.id), blocksByStaff, occByStaff, startTime, service.duration, service.bufferMinutes
            );
            if (!assignedStaffId) throw new SlotTakenError();
          }

          try {
            return await tx.booking.create({
              data: {
                date: bookingDate,
                startTime,
                endTime,
                status: "PENDING",
                notes: typeof notes === "string" ? notes.trim() || null : null,
                manageToken: randomBytes(24).toString("base64url"),
                businessId: business.id,
                serviceId: service.id,
                staffId: assignedStaffId,
                clientId: client.id,
              },
              include: {
                service: { select: { id: true, name: true, duration: true, price: true } },
                client: { select: { id: true, name: true, whatsapp: true } },
              },
            });
          } catch (e) {
            // Violación del índice único parcial → otro request ganó el slot.
            if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
              throw new SlotTakenError();
            }
            throw e;
          }
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      )
    );

    // Notificar al dueño por WhatsApp (fire-and-forget, con registro persistido)
    if (business.whatsapp) {
      const fechaLegible = formatDayMonth(dateToISODate(booking.date as Date));
      const ownerMsg = ownerNewBookingMessage({
        businessName: business.name,
        clientName: booking.client.name,
        clientWhatsapp: booking.client.whatsapp,
        serviceName: booking.service.name,
        fechaLegible,
        startTime: booking.startTime,
      });
      const templateSid = process.env.TWILIO_TEMPLATE_NEW_BOOKING_SID;
      void notifyWhatsApp({
        bookingId: booking.id,
        to: business.whatsapp,
        body: ownerMsg,
        type: "NEW_BOOKING_OWNER",
        options: templateSid
          ? {
              contentSid: templateSid,
              contentVariables: {
                "1": business.name,
                "2": booking.client.name,
                "3": booking.service.name,
                "4": `${fechaLegible} ${booking.startTime}`,
              },
            }
          : undefined,
      });
    }

    return NextResponse.json({ booking }, { status: 201 });
  } catch (error) {
    if (error instanceof BookingLimitError) {
      return NextResponse.json(
        { error: "Ya tenés 2 reservas activas en este negocio. Cancelá una antes de reservar nuevamente." },
        { status: 400 }
      );
    }
    if (error instanceof SlotTakenError) {
      return NextResponse.json(
        { error: "SLOT_TAKEN", message: "Este horario ya fue reservado. Por favor elegí otro." },
        { status: 409 }
      );
    }
    if (error instanceof SlotUnavailableError) {
      return NextResponse.json(
        { error: "SLOT_UNAVAILABLE", message: "Ese horario no está disponible para reservar." },
        { status: 400 }
      );
    }
    if (error instanceof BookingTooSoonError) {
      return NextResponse.json(
        { error: "BOOKING_TOO_SOON", message: error.userMessage },
        { status: 400 }
      );
    }
    if (error instanceof StaffServiceMismatchError) {
      return NextResponse.json({ error: "Ese profesional no atiende este servicio" }, { status: 400 });
    }
    if (error instanceof NoStaffForServiceError) {
      return NextResponse.json({ error: "Ningún profesional ofrece este servicio" }, { status: 400 });
    }
    logError("[bookings]", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

class SlotTakenError extends Error {
  constructor() {
    super("slot_taken");
  }
}

class SlotUnavailableError extends Error {
  constructor() {
    super("slot_unavailable");
  }
}

class BookingLimitError extends Error {
  constructor() {
    super("booking_limit");
  }
}

// El horario pedido no respeta la antelación mínima del negocio (o ya pasó).
class BookingTooSoonError extends Error {
  readonly userMessage: string;
  constructor(noticeMinutes: number) {
    super("booking_too_soon");
    this.userMessage =
      noticeMinutes > 0
        ? "Ese horario ya no está disponible: el negocio requiere reservar con más anticipación."
        : "Ese horario ya pasó. Elegí un horario futuro.";
  }
}

// Se pidió un profesional que no hace este servicio.
class StaffServiceMismatchError extends Error {
  constructor() {
    super("staff_service_mismatch");
  }
}

// Ningún profesional del negocio ofrece este servicio.
class NoStaffForServiceError extends Error {
  constructor() {
    super("no_staff_for_service");
  }
}

/**
 * Ejecuta `fn` reintentando ante fallos de serialización (Prisma P2034), que el
 * nivel SERIALIZABLE lanza cuando dos transacciones concurrentes entran en
 * conflicto. Los errores de dominio (SlotTaken, etc.) NO son P2034 y se propagan
 * sin reintento. Pocos intentos: la contención real de AgendaPy es bajísima.
 */
async function withSerializableRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
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

// Encuentra el cliente por (negocio, whatsapp) o lo crea. Si dos requests del
// mismo cliente corren a la vez, el unique businessId_whatsapp hace fallar el
// create con P2002 y reintentamos la lectura (el cliente ya existe).
async function upsertClient(businessId: string, whatsapp: string, name: string) {
  const existing = await prisma.client.findUnique({
    where: { businessId_whatsapp: { businessId, whatsapp } },
  });
  if (existing) return existing;
  try {
    return await prisma.client.create({ data: { name, whatsapp, businessId } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const c = await prisma.client.findUnique({
        where: { businessId_whatsapp: { businessId, whatsapp } },
      });
      if (c) return c;
    }
    throw e;
  }
}
