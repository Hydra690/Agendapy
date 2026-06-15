import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SlotsQuerySchema, formatZodErrors } from "@/lib/validations";
import { logError } from "@/lib/logger";
import { parseDateUTC } from "@/lib/date";
import { todayInTz } from "@/lib/timezone";
import { availableSlots, dayOfWeekUTC } from "@/lib/booking";

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

    const business = await prisma.business.findUnique({ where: { slug } });
    if (!business) {
      return NextResponse.json(
        { error: "Negocio no encontrado" },
        { status: 404 }
      );
    }

    // "Fecha pasada" según la tz del negocio, no la del servidor (UTC).
    if (dateParam < todayInTz(business.timezone)) {
      return NextResponse.json(
        { error: "No se pueden consultar fechas pasadas" },
        { status: 400 }
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

    // Día de la semana (UTC: la fecha es un día calendario)
    const availability = await prisma.availability.findFirst({
      where: {
        businessId: business.id,
        dayOfWeek: dayOfWeekUTC(date),
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

    // Reservas ocupadas para esa fecha (con su rango completo, no solo el inicio:
    // un servicio de otra duración puede pisar varios slots de este servicio).
    const existingBookings = await prisma.booking.findMany({
      where: {
        businessId: business.id,
        date,
        status: { in: ["PENDING", "CONFIRMED"] },
      },
      select: { startTime: true, endTime: true },
    });

    const slots = availableSlots(
      { startTime: availability.startTime, endTime: availability.endTime },
      service.duration,
      existingBookings
    );

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
        slots,
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
