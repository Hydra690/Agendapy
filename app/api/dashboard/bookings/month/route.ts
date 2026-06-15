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
