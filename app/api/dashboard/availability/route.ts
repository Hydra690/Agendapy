import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { DayOfWeek } from "@prisma/client";
import { logError } from "@/lib/logger";

const DAY_ORDER: DayOfWeek[] = [
  "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY",
];

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const business = await prisma.business.findFirst({
      where: { ownerId: session.user.id },
      select: { id: true },
    });

    if (!business) {
      return NextResponse.json({ error: "Sin negocio" }, { status: 404 });
    }

    const rows = await prisma.availability.findMany({
      where: { businessId: business.id, staffId: null },
      select: { dayOfWeek: true, startTime: true, endTime: true, isActive: true },
    });

    const sorted = DAY_ORDER.map(day => rows.find(r => r.dayOfWeek === day) ?? null);

    return NextResponse.json({ availability: sorted });
  } catch (error) {
    logError("[dashboard/availability] GET", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

interface DayInput {
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

export async function PUT(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const business = await prisma.business.findFirst({
      where: { ownerId: session.user.id },
      select: { id: true },
    });

    if (!business) {
      return NextResponse.json({ error: "Sin negocio" }, { status: 404 });
    }

    const { schedule } = await req.json() as { schedule: DayInput[] };

    // Fetch existing records so we can update vs create without relying on
    // upsert (which doesn't support nullable fields in composite unique keys)
    const existing = await prisma.availability.findMany({
      where: { businessId: business.id, staffId: null },
      select: { id: true, dayOfWeek: true },
    });
    const existingMap = new Map(existing.map(r => [r.dayOfWeek as string, r.id]));

    await prisma.$transaction(
      schedule.map(s => {
        const id = existingMap.get(s.dayOfWeek);
        if (id) {
          return prisma.availability.update({
            where: { id },
            data: { startTime: s.startTime, endTime: s.endTime, isActive: s.isActive },
          });
        }
        return prisma.availability.create({
          data: {
            businessId: business.id,
            staffId: null,
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime,
            isActive: s.isActive,
          },
        });
      })
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    logError("[dashboard/availability] PUT", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
