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
    const yearParam = searchParams.get("year");
    const monthParam = searchParams.get("month");

    const year = parseInt(yearParam ?? "", 10);
    const month = parseInt(monthParam ?? "", 10);

    if (!year || !month || month < 1 || month > 12) {
      return NextResponse.json(
        { error: "Parámetros year y month requeridos" },
        { status: 400 }
      );
    }

    const business = await prisma.business.findFirst({
      where: { ownerId: session.user.id },
    });
    if (!business) {
      return NextResponse.json({ error: "Sin negocio" }, { status: 404 });
    }

    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));

    const bookings = await prisma.booking.findMany({
      where: {
        businessId: business.id,
        date: { gte: start, lt: end },
        status: { in: ["PENDING", "CONFIRMED"] },
      },
      select: { date: true },
      distinct: ["date"],
    });

    const dates = bookings.map((b: { date: Date }) => {
      const d = b.date;
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(d.getUTCDate()).padStart(2, "0");
      return `${y}-${m}-${dd}`;
    });

    return NextResponse.json({ year, month, dates });
  } catch (error) {
    logError("[dashboard/bookings/month]", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
