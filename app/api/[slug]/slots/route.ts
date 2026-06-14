import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SlotsQuerySchema, formatZodErrors } from "@/lib/validations";
import { logError } from "@/lib/logger";

function generateSlots(
  startTime: string,
  endTime: string,
  durationMinutes: number
): string[] {
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

const DAY_MAP: Record<string, number> = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
};

// Parsea "YYYY-MM-DD" a un Date UTC sin ambigüedad de timezone
function parseDateUTC(dateStr: string): Date | null {
  const parts = dateStr.split("-").map(Number);
  if (parts.length !== 3) return null;
  const [year, month, day] = parts;
  if (!year || !month || !day) return null;
  return new Date(Date.UTC(year, month - 1, day));
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(request.url);
    const parsed = SlotsQuerySchema.safeParse({
      date: searchParams.get("date") ?? undefined,
      serviceId: searchParams.get("serviceId") ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Parámetros inválidos", fields: formatZodErrors(parsed.error.issues) },
        { status: 400 }
      );
    }
    const { date: dateParam, serviceId } = parsed.data;

    // Parseo UTC explícito — evita desfasaje por timezone del servidor
    const date = parseDateUTC(dateParam);
    if (!date) {
      return NextResponse.json(
        { error: "Formato de fecha inválido. Usá YYYY-MM-DD" },
        { status: 400 }
      );
    }

    const todayUTC = new Date().toISOString().split("T")[0];
    if (dateParam < todayUTC) {
      return NextResponse.json(
        { error: "No se pueden consultar fechas pasadas" },
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

    // Verificar si la fecha está bloqueada
    const blocked = await prisma.blockedDate.findUnique({
      where: { businessId_date: { businessId: business.id, date } },
    });
    if (blocked) {
      return NextResponse.json({
        available: false,
        reason: blocked.reason ?? "Fecha no disponible",
        slots: [],
      });
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

    // Día de la semana usando UTC para evitar desfasaje
    const dowIndex = date.getUTCDay();
    const dayOfWeek = Object.keys(DAY_MAP).find(
      (key) => DAY_MAP[key] === dowIndex
    );

    const availability = await prisma.availability.findFirst({
      where: {
        businessId: business.id,
        dayOfWeek: dayOfWeek as never,
        isActive: true,
        staffId: null,
      },
    });
    if (!availability) {
      return NextResponse.json({
        available: false,
        reason: "El negocio no atiende ese día",
        slots: [],
      });
    }

    const allSlots = generateSlots(
      availability.startTime,
      availability.endTime,
      service.duration
    );

    // Reservas ocupadas para esa fecha
    const existingBookings = await prisma.booking.findMany({
      where: {
        businessId: business.id,
        date,
        status: { in: ["PENDING", "CONFIRMED"] },
      },
      select: { startTime: true },
    });

    const occupiedSlots = new Set(
      existingBookings.map((b: { startTime: string }) => b.startTime)
    );
    const availableSlots = allSlots.filter((slot) => !occupiedSlots.has(slot));

    return NextResponse.json(
      {
        available: true,
        date: dateParam,
        business: { id: business.id, name: business.name, slug: business.slug },
        service: {
          id: service.id,
          name: service.name,
          duration: service.duration,
          price: service.price,
        },
        slots: availableSlots,
      },
      { headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=30" } }
    );
  } catch (error) {
    logError("[slots]", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
