import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BookingSchema, formatZodErrors } from "@/lib/validations";
import { logError } from "@/lib/logger";
import { notifyWhatsApp } from "@/lib/notify";
import { parseDateUTC, addMinutes, dateToISODate } from "@/lib/date";
import { todayInTz } from "@/lib/timezone";

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

    const { serviceId, date: dateParam, startTime, clientName, clientWhatsapp, notes } = parsed.data;

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
        status: { in: ["PENDING", "CONFIRMED"] },
      },
    });
    if (activeBookings >= 2) {
      throw new BookingLimitError();
    }

    // Pre-chequeo de solapamiento de rangos [startTime, endTime) para dar un
    // mensaje claro y evitar el caso común. La garantía ATÓMICA contra dos
    // reservas del mismo slot la da el índice único parcial de la DB
    // ("Booking_active_slot_unique", ver migración) → P2002 al insertar.
    // Como "HH:mm" tiene ancho fijo, la comparación lexicográfica equivale a la
    // temporal: dos rangos se pisan si existente.start < nuevo.end Y existente.end > nuevo.start.
    const conflict = await prisma.booking.findFirst({
      where: {
        businessId: business.id,
        date: bookingDate,
        status: { in: ["PENDING", "CONFIRMED"] },
        startTime: { lt: endTime },
        endTime: { gt: startTime },
      },
      select: { id: true },
    });
    if (conflict) {
      throw new SlotTakenError();
    }

    // Upsert del cliente por whatsapp+negocio (idempotente; carrera cubierta por
    // el unique businessId_whatsapp → reintento de lectura).
    const client = await upsertClient(business.id, clientWhatsapp, clientName.trim());

    let booking;
    try {
      booking = await prisma.booking.create({
        data: {
          date: bookingDate,
          startTime,
          endTime,
          status: "PENDING",
          notes: typeof notes === "string" ? notes.trim() || null : null,
          businessId: business.id,
          serviceId: service.id,
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

    // Notificar al dueño por WhatsApp (fire-and-forget, con registro persistido)
    if (business.whatsapp) {
      const [y, m, d] = dateToISODate(booking.date as Date).split("-").map(Number);
      const fechaLegible = new Date(y, m - 1, d).toLocaleDateString("es-PY", {
        weekday: "long", day: "numeric", month: "long",
      });
      const ownerMsg =
        `🔔 *Nueva reserva en ${business.name}*\n\n` +
        `👤 ${booking.client.name}${booking.client.whatsapp ? ` · ${booking.client.whatsapp}` : ""}\n` +
        `🛠️ ${booking.service.name}\n` +
        `📅 ${fechaLegible} a las ${booking.startTime} hs`;
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

class BookingLimitError extends Error {
  constructor() {
    super("booking_limit");
  }
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
