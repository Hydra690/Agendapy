import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { logError } from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDateParam = searchParams.get("startDate");

    if (!startDateParam || !/^\d{4}-\d{2}-\d{2}$/.test(startDateParam)) {
      return NextResponse.json({ error: "startDate requerido (YYYY-MM-DD)" }, { status: 400 });
    }

    const business = await prisma.business.findFirst({
      where: { ownerId: session.user.id },
      select: { id: true },
    });

    if (!business) {
      return NextResponse.json({ error: "Sin negocio" }, { status: 404 });
    }

    const [y, m, d] = startDateParam.split("-").map(Number);
    const startDate = new Date(Date.UTC(y, m - 1, d));
    const endDate = new Date(Date.UTC(y, m - 1, d + 7));

    const bookings = await prisma.booking.findMany({
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
        service: { select: { name: true, duration: true, price: true } },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });

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
