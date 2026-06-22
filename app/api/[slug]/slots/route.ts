import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SlotsQuerySchema, formatZodErrors } from "@/lib/validations";
import { logError } from "@/lib/logger";
import { parseDateUTC, addMinutes } from "@/lib/date";
import { todayInTz, filterSlotsByNotice } from "@/lib/timezone";
import { availableSlots, dayOfWeekUTC, unionSlots, staffCanDoAllServices, buildStaffSchedule } from "@/lib/booking";
import { ACTIVE_BOOKING_STATUSES } from "@/lib/constants";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(request.url);

    // Servicios del turno: ?serviceIds=a,b (multi) o ?serviceId=a (compat single).
    const rawIds = (searchParams.get("serviceIds") ?? searchParams.get("serviceId") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const serviceIds = [...new Set(rawIds)];

    const parsed = SlotsQuerySchema.safeParse({
      date: searchParams.get("date") ?? undefined,
      serviceIds,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Parámetros inválidos", fields: formatZodErrors(parsed.error.issues) },
        { status: 400 }
      );
    }
    const { date: dateParam } = parsed.data;

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

    // Todos los servicios deben existir, ser del negocio y estar activos.
    const services = await prisma.service.findMany({
      where: { id: { in: serviceIds }, businessId: business.id, isActive: true },
      select: { id: true, name: true, duration: true, bufferMinutes: true, price: true },
    });
    if (services.length !== serviceIds.length) {
      return NextResponse.json(
        { error: "Servicio no encontrado" },
        { status: 404 }
      );
    }
    // Duración y buffer TOTALES del turno (suma). Precio total: null si alguno es "a consultar".
    const totalDuration = services.reduce((acc, s) => acc + s.duration, 0);
    const totalBuffer = services.reduce((acc, s) => acc + s.bufferMinutes, 0);
    const totalPrice = services.every((s) => s.price != null)
      ? services.reduce((acc, s) => acc + (s.price ?? 0), 0)
      : null;

    // Día de la semana (UTC: la fecha es un día calendario).
    const dow = dayOfWeekUTC(date);
    const staffParam = searchParams.get("staffId") ?? undefined;

    // Profesionales activos. Si no hay, el negocio es un recurso único (igual que antes).
    const activeStaff = await prisma.staff.findMany({
      where: { businessId: business.id, isActive: true },
      select: { id: true, services: { select: { id: true } } },
    });

    let slots: string[];

    if (activeStaff.length === 0) {
      // ---- Recurso único (sin profesionales cargados): comportamiento original ----
      const blocks = await prisma.availability.findMany({
        where: { businessId: business.id, dayOfWeek: dow, isActive: true, staffId: null },
        select: { startTime: true, endTime: true },
      });
      if (blocks.length === 0) {
        return NextResponse.json({ available: false, reason: "El negocio no atiende ese día", slots: [] });
      }
      // El "fin ocupado" de cada reserva incluye su buffer efectivo (snapshot).
      const existing = await prisma.booking.findMany({
        where: { businessId: business.id, date, status: { in: [...ACTIVE_BOOKING_STATUSES] } },
        select: { startTime: true, endTime: true, bufferMinutes: true },
      });
      const occupied = existing.map(b => ({ startTime: b.startTime, endTime: addMinutes(b.endTime, b.bufferMinutes) }));
      slots = availableSlots(blocks, totalDuration, totalBuffer, occupied);
    } else {
      // ---- Multi-profesional: un slot se ofrece si ≥1 profesional que haga TODOS
      //      los servicios está libre ----
      let target = activeStaff.filter(s => staffCanDoAllServices(s.services.map(x => x.id), serviceIds));
      if (staffParam) target = target.filter(s => s.id === staffParam);
      if (target.length === 0) {
        return NextResponse.json({
          available: false,
          reason: staffParam ? "Ese profesional no atiende todos los servicios elegidos" : "Ningún profesional ofrece todos los servicios elegidos",
          slots: [],
        });
      }
      const ids = target.map(s => s.id);
      const [availRows, bookingRows] = await Promise.all([
        prisma.availability.findMany({
          where: { businessId: business.id, dayOfWeek: dow, isActive: true, staffId: { in: ids } },
          select: { staffId: true, startTime: true, endTime: true },
        }),
        prisma.booking.findMany({
          where: { businessId: business.id, date, status: { in: [...ACTIVE_BOOKING_STATUSES] }, staffId: { in: ids } },
          select: { staffId: true, startTime: true, endTime: true, bufferMinutes: true },
        }),
      ]);
      const { blocksByStaff, occByStaff } = buildStaffSchedule(
        availRows.map(r => ({ staffId: r.staffId!, startTime: r.startTime, endTime: r.endTime })),
        bookingRows.map(b => ({ staffId: b.staffId!, startTime: b.startTime, endTime: b.endTime, bufferMinutes: b.bufferMinutes }))
      );
      slots = unionSlots(ids.map(sid =>
        availableSlots(blocksByStaff.get(sid) ?? [], totalDuration, totalBuffer, occByStaff.get(sid) ?? [])
      ));
    }

    // Ocultar horarios que no cumplen la antelación mínima del negocio (con 0,
    // simplemente oculta los horarios ya pasados del día de hoy).
    slots = filterSlotsByNotice(dateParam, slots, business.minBookingNoticeMinutes, business.timezone);

    return NextResponse.json(
      {
        available: true,
        date: dateParam,
        business: { id: business.id, name: business.name, slug: business.slug },
        services: services.map(s => ({ id: s.id, name: s.name, duration: s.duration, price: s.price })),
        totalDuration,
        totalPrice,
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
