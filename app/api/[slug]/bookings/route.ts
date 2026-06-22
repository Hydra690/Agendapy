import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BookingSchema, formatZodErrors } from "@/lib/validations";
import { logError } from "@/lib/logger";
import { notifyWhatsApp, notifyEmail } from "@/lib/notify";
import { sendBookingConfirmationEmail } from "@/lib/email";
import { parseDateUTC, addMinutes, dateToISODate } from "@/lib/date";
import { ACTIVE_BOOKING_STATUSES } from "@/lib/constants";
import { ownerNewBookingMessage, clientConfirmationMessage } from "@/lib/messages";
import { formatDayMonth } from "@/lib/format";
import { appBaseUrl } from "@/lib/url";
import {
  assertBookingTiming,
  assignAndReserveSlot,
  withSerializableRetry,
  SlotTakenError,
  SlotUnavailableError,
  BookingTooSoonError,
  PastDateError,
  BlockedDateError,
  StaffServiceMismatchError,
  NoStaffForServiceError,
} from "@/lib/booking-engine";

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

    const { serviceId, staffId, date: dateParam, startTime, clientName, clientWhatsapp, clientEmail, notes } = parsed.data;

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

    // Reglas de tiempo (fecha pasada, antelación mínima, fecha bloqueada). Lanzan
    // PastDateError / BookingTooSoonError / BlockedDateError → mapeadas en el catch.
    await assertBookingTiming(business, dateParam, bookingDate, startTime);

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
    const client = await upsertClient(business.id, clientWhatsapp, clientName.trim(), clientEmail);

    // Asignación de profesional + chequeo de disponibilidad + creación, ATÓMICO
    // (mismo motor que usa el reschedule). El índice único parcial garantiza la
    // unicidad del MISMO inicio; los solapes de distinto inicio los cubre la
    // transacción SERIALIZABLE con reintento ante P2034.
    const booking = await withSerializableRetry(() =>
      prisma.$transaction(
        async (tx) => {
          const assignedStaffId = await assignAndReserveSlot(tx, {
            businessId: business.id,
            service: { id: service.id, duration: service.duration, bufferMinutes: service.bufferMinutes },
            bookingDate,
            startTime,
            requestedStaffId: staffId,
          });

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
                client: { select: { id: true, name: true, whatsapp: true, email: true } },
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

    // ── Notificaciones (no bloqueantes; cada intento se persiste en BookingNotification) ──
    // fechaLegible y el link de gestión se comparten entre los avisos.
    const fechaLegible = formatDayMonth(dateToISODate(booking.date as Date));
    const manageUrl = booking.manageToken
      ? `${appBaseUrl()}/turno/${booking.manageToken}`
      : null;

    // Aviso al dueño (si configuró su WhatsApp).
    if (business.whatsapp) {
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

    // Confirmación al cliente por WhatsApp (el WhatsApp del cliente es obligatorio al
    // reservar). Sin Twilio, notifyWhatsApp registra el intento como fallido, no éxito.
    if (booking.client.whatsapp) {
      const clientMsg = clientConfirmationMessage({
        clientName: booking.client.name,
        businessName: business.name,
        serviceName: booking.service.name,
        fechaLegible,
        startTime: booking.startTime,
        manageUrl,
      });
      const confirmationSid = process.env.TWILIO_TEMPLATE_CONFIRMATION_SID;
      void notifyWhatsApp({
        bookingId: booking.id,
        to: booking.client.whatsapp,
        body: clientMsg,
        type: "CONFIRMATION",
        options: confirmationSid
          ? {
              contentSid: confirmationSid,
              contentVariables: {
                "1": booking.client.name,
                "2": business.name,
                "3": booking.service.name,
                "4": `${fechaLegible} ${booking.startTime}`,
              },
            }
          : undefined,
      });
    }

    // Confirmación al cliente por email (solo si dejó email). Sin RESEND_API_KEY,
    // notifyEmail registra el intento como no-enviado (modo dev), nunca como éxito.
    if (booking.client.email) {
      const clientEmailAddr = booking.client.email;
      void notifyEmail({
        bookingId: booking.id,
        type: "CONFIRMATION",
        send: () =>
          sendBookingConfirmationEmail(clientEmailAddr, {
            clientName: booking.client.name,
            businessName: business.name,
            serviceName: booking.service.name,
            fechaLegible,
            startTime: booking.startTime,
            manageUrl,
          }),
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
    if (error instanceof PastDateError) {
      return NextResponse.json(
        { error: "No se pueden reservar fechas pasadas" },
        { status: 400 }
      );
    }
    if (error instanceof BlockedDateError) {
      return NextResponse.json(
        { error: error.reason ?? "Esa fecha no está disponible para reservar" },
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

class BookingLimitError extends Error {
  constructor() {
    super("booking_limit");
  }
}

// Encuentra el cliente por (negocio, whatsapp) o lo crea. Si dos requests del
// mismo cliente corren a la vez, el unique businessId_whatsapp hace fallar el
// create con P2002 y reintentamos la lectura (el cliente ya existe).
async function upsertClient(businessId: string, whatsapp: string, name: string, email?: string) {
  const existing = await prisma.client.findUnique({
    where: { businessId_whatsapp: { businessId, whatsapp } },
  });
  if (existing) {
    // Si el cliente ya existía sin email y ahora lo dejó, lo completamos (no pisamos
    // un email previo: el dueño puede haberlo curado a mano).
    if (email && !existing.email) {
      return prisma.client.update({ where: { id: existing.id }, data: { email } });
    }
    return existing;
  }
  try {
    return await prisma.client.create({ data: { name, whatsapp, email: email ?? null, businessId } });
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
