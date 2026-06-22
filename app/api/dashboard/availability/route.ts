import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DayOfWeek } from "@prisma/client";
import { logError } from "@/lib/logger";
import { AvailabilityPutSchema, formatZodErrors } from "@/lib/validations";
import { requireBusiness } from "@/lib/api-auth";
import { DAYS_OF_WEEK } from "@/lib/constants";

const DAY_ORDER: DayOfWeek[] = [...DAYS_OF_WEEK];

interface Interval { startTime: string; endTime: string; }

/** Valida que el staffId (si viene) pertenezca al negocio. Devuelve el staffId a
 *  usar (o null para el horario del negocio), o `false` si el staff no es válido. */
async function resolveStaffId(businessId: string, staffId: string | undefined): Promise<string | null | false> {
  if (!staffId) return null;
  const staff = await prisma.staff.findFirst({ where: { id: staffId, businessId }, select: { id: true } });
  return staff ? staff.id : false;
}

export async function GET(request: Request) {
  try {
    const ctx = await requireBusiness();
    if ("response" in ctx) return ctx.response;
    const { business } = ctx;

    const staffParam = new URL(request.url).searchParams.get("staffId") ?? undefined;
    const staffId = await resolveStaffId(business.id, staffParam);
    if (staffId === false) {
      return NextResponse.json({ error: "Profesional no encontrado" }, { status: 404 });
    }

    // Cada día puede tener varios intervalos. Un día está "activo" si tiene ≥1.
    const rows = await prisma.availability.findMany({
      where: { businessId: business.id, staffId, isActive: true },
      select: { dayOfWeek: true, startTime: true, endTime: true },
      orderBy: { startTime: "asc" },
    });

    const byDay = new Map<string, Interval[]>();
    for (const r of rows) {
      const list = byDay.get(r.dayOfWeek) ?? [];
      list.push({ startTime: r.startTime, endTime: r.endTime });
      byDay.set(r.dayOfWeek, list);
    }

    const availability = DAY_ORDER.map(day => {
      const intervals = byDay.get(day) ?? [];
      return { dayOfWeek: day, isActive: intervals.length > 0, intervals };
    });

    return NextResponse.json({ availability });
  } catch (error) {
    logError("[dashboard/availability] GET", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

interface DayInput {
  dayOfWeek: DayOfWeek;
  isActive: boolean;
  intervals: Interval[];
}

export async function PUT(req: Request) {
  try {
    const ctx = await requireBusiness();
    if ("response" in ctx) return ctx.response;
    const { business } = ctx;

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
    }
    const parsed = AvailabilityPutSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", fields: formatZodErrors(parsed.error.issues) },
        { status: 400 }
      );
    }
    const schedule = parsed.data.schedule as DayInput[];

    const staffId = await resolveStaffId(business.id, parsed.data.staffId);
    if (staffId === false) {
      return NextResponse.json({ error: "Profesional no encontrado" }, { status: 404 });
    }

    // Reemplazo total del horario (del negocio o del profesional, según staffId):
    // borramos sus intervalos y recreamos uno por intervalo de cada día activo.
    // En una transacción para no dejar el horario a medias.
    await prisma.$transaction([
      prisma.availability.deleteMany({ where: { businessId: business.id, staffId } }),
      ...schedule.flatMap(d =>
        d.isActive
          ? d.intervals.map(iv =>
              prisma.availability.create({
                data: {
                  businessId: business.id,
                  staffId,
                  dayOfWeek: d.dayOfWeek,
                  startTime: iv.startTime,
                  endTime: iv.endTime,
                  isActive: true,
                },
              })
            )
          : []
      ),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    logError("[dashboard/availability] PUT", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
