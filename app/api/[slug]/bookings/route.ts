import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { BookingSchema, formatZodErrors } from "@/lib/validations";
import { logError } from "@/lib/logger";
import { sendWhatsApp } from "@/lib/twilio";

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

function parseDateUTCStrict(dateStr: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const parts = dateStr.split("-").map(Number);
  const [year, month, day] = parts;
  if (!year || !month || !day) return null;
  return new Date(Date.UTC(year, month - 1, day));
}

const VALID_STATUSES = ["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED", "NO_SHOW"] as const;
type BookingStatusType = (typeof VALID_STATUSES)[number];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date");
    const statusParam = searchParams.get("status");

    if (!dateParam) {
      return NextResponse.json(
        { error: "Parámetro requerido: date (YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    const date = parseDateUTCStrict(dateParam);
    if (!date) {
      return NextResponse.json(
        { error: "Formato de fecha inválido. Usá YYYY-MM-DD" },
        { status: 400 }
      );
    }

    if (statusParam && !VALID_STATUSES.includes(statusParam as BookingStatusType)) {
      return NextResponse.json(
        { error: `status inválido. Valores permitidos: ${VALID_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    const business = await prisma.business.findUnique({ where: { slug } });
    if (!business) {
      return NextResponse.json(
        { error: "Negocio no encontrado" },
        { status: 404 }
      );
    }

    const bookings = await prisma.booking.findMany({
      where: {
        businessId: business.id,
        date,
        ...(statusParam ? { status: statusParam as BookingStatusType } : {}),
      },
      select: {
        id: true,
        startTime: true,
        endTime: true,
        status: true,
        notes: true,
        client: { select: { name: true, whatsapp: true } },
        service: { select: { name: true, duration: true, price: true } },
      },
      orderBy: { startTime: "asc" },
    });

    return NextResponse.json({
      date: dateParam,
      bookings,
      total: bookings.length,
    });
  } catch (error) {
    logError("[bookings:GET]", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

function parseDateUTC(dateStr: string): Date | null {
  const parts = dateStr.split("-").map(Number);
  if (parts.length !== 3) return null;
  const [year, month, day] = parts;
  if (!year || !month || !day) return null;
  return new Date(Date.UTC(year, month - 1, day));
}

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const endH = Math.floor(total / 60) % 24;
  const endM = total % 60;
  return `${endH.toString().padStart(2, "0")}:${endM.toString().padStart(2, "0")}`;
}


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

    const service = await prisma.service.findFirst({
      where: { id: serviceId, businessId: business.id, isActive: true },
    });
    if (!service) {
      return NextResponse.json(
        { error: "Servicio no encontrado" },
        { status: 404 }
      );
    }

    const activeBookings = await prisma.booking.count({
      where: {
        businessId: business.id,
        client: { whatsapp: clientWhatsapp as string },
        status: { in: ["PENDING", "CONFIRMED"] },
      },
    });
    if (activeBookings >= 2) {
      return NextResponse.json(
        { error: "Ya tenés 2 reservas activas en este negocio. Cancelá una antes de reservar nuevamente." },
        { status: 400 }
      );
    }

    const endTime = addMinutes(startTime, service.duration);

    // Transacción: verificar disponibilidad + crear cliente + crear booking
    const booking = await prisma.$transaction(async (tx: TxClient) => {
      // Verificar que el slot no esté tomado (race condition safe)
      const conflict = await tx.booking.findFirst({
        where: {
          businessId: business.id,
          date: bookingDate,
          startTime,
          status: { in: ["PENDING", "CONFIRMED"] },
        },
      });
      if (conflict) {
        throw new SlotTakenError();
      }

      // Crear o encontrar el cliente por whatsapp+negocio
      let client = await tx.client.findUnique({
        where: {
          businessId_whatsapp: {
            businessId: business.id,
            whatsapp: clientWhatsapp,
          },
        },
      });
      if (!client) {
        client = await tx.client.create({
          data: {
            name: clientName.trim(),
            whatsapp: clientWhatsapp,
            businessId: business.id,
          },
        });
      }

      return tx.booking.create({
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
    });

    // Notificar al dueño por WhatsApp (fire-and-forget)
    if (business.whatsapp) {
      const [y, m, d] = (booking.date as Date).toISOString().split("T")[0].split("-").map(Number);
      const fechaLegible = new Date(y, m - 1, d).toLocaleDateString("es-PY", {
        weekday: "long", day: "numeric", month: "long",
      });
      const ownerMsg =
        `🔔 *Nueva reserva en ${business.name}*\n\n` +
        `👤 ${booking.client.name}${booking.client.whatsapp ? ` · ${booking.client.whatsapp}` : ""}\n` +
        `🛠️ ${booking.service.name}\n` +
        `📅 ${fechaLegible} a las ${booking.startTime} hs`;
      sendWhatsApp(business.whatsapp, ownerMsg).catch((e) =>
        logError("[bookings] notif owner", e)
      );
    }

    return NextResponse.json({ booking }, { status: 201 });
  } catch (error) {
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
