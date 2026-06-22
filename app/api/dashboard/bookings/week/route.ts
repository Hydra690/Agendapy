import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logError } from "@/lib/logger";
import { requireBusiness } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireBusiness();
    if ("response" in ctx) return ctx.response;
    const { business } = ctx;

    const { searchParams } = new URL(request.url);
    const startDateParam = searchParams.get("startDate");

    if (!startDateParam || !/^\d{4}-\d{2}-\d{2}$/.test(startDateParam)) {
      return NextResponse.json({ error: "startDate requerido (YYYY-MM-DD)" }, { status: 400 });
    }

    const [y, m, d] = startDateParam.split("-").map(Number);
    const startDate = new Date(Date.UTC(y, m - 1, d));
    const endDate = new Date(Date.UTC(y, m - 1, d + 7));

    const rows = await prisma.booking.findMany({
      where: {
        businessId: business.id,
        date: { gte: startDate, lt: endDate },
      },
      select: {
        id: true,
        date: true,
        startTime: true,
        endTime: true,
        status: true,
        notes: true,
        client: { select: { name: true, whatsapp: true } },
        services: { select: { service: { select: { id: true, name: true, price: true } } } },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });

    const bookings = rows.map(({ services, ...rest }) => ({
      ...rest,
      services: services.map((bs) => bs.service),
    }));

    // Agrupar por fecha
    const days: Record<string, typeof bookings> = {};
    for (let i = 0; i < 7; i++) {
      const date = new Date(Date.UTC(y, m - 1, d + i));
      const dateStr = date.toISOString().split("T")[0];
      days[dateStr] = [];
    }
    for (const booking of bookings) {
      const dateStr = (booking.date as Date).toISOString().split("T")[0];
      if (days[dateStr]) days[dateStr].push(booking);
    }

    return NextResponse.json({ days });
  } catch (error) {
    logError("[bookings/week]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
