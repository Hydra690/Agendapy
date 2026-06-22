import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SlotsQuerySchema, formatZodErrors } from "@/lib/validations";
import { logError } from "@/lib/logger";
import { parseDateUTC, addMinutes } from "@/lib/date";
import { todayInTz, filterSlotsByNotice } from "@/lib/timezone";
import { availableSlots, dayOfWeekUTC, unionSlots, staffCanDoService } from "@/lib/booking";

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
      // El "fin ocupado" incluye el buffer del servicio reservado.
      const existing = await prisma.booking.findMany({
        where: { businessId: business.id, date, status: { in: ["PENDING", "CONFIRMED"] } },
        select: { startTime: true, endTime: true, service: { select: { bufferMinutes: true } } },
      });
      const occupied = existing.map(b => ({ startTime: b.startTime, endTime: addMinutes(b.endTime, b.service.bufferMinutes) }));
      slots = availableSlots(blocks, service.duration, service.bufferMinutes, occupied);
    } else {
      // ---- Multi-profesional: un slot se ofrece si ≥1 profesional elegible está libre ----
      let target = activeStaff.filter(s => staffCanDoService(s.services.map(x => x.id), service.id));
      if (staffParam) target = target.filter(s => s.id === staffParam);
      if (target.length === 0) {
        return NextResponse.json({
          available: false,
          reason: staffParam ? "Ese profesional no atiende este servicio" : "Ningún profesional ofrece este servicio",
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
          where: { businessId: business.id, date, status: { in: ["PENDING", "CONFIRMED"] }, staffId: { in: ids } },
          select: { staffId: true, startTime: true, endTime: true, service: { select: { bufferMinutes: true } } },
        }),
      ]);
      const blocksByStaff = new Map<string, { startTime: string; endTime: string }[]>();
      for (const r of availRows) {
        const list = blocksByStaff.get(r.staffId!) ?? [];
        list.push({ startTime: r.startTime, endTime: r.endTime });
        blocksByStaff.set(r.staffId!, list);
      }
      const occByStaff = new Map<string, { startTime: string; endTime: string }[]>();
      for (const b of bookingRows) {
        const list = occByStaff.get(b.staffId!) ?? [];
        list.push({ startTime: b.startTime, endTime: addMinutes(b.endTime, b.service.bufferMinutes) });
        occByStaff.set(b.staffId!, list);
      }
      slots = unionSlots(ids.map(sid =>
        availableSlots(blocksByStaff.get(sid) ?? [], service.duration, service.bufferMinutes, occByStaff.get(sid) ?? [])
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
