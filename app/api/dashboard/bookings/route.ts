import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logError } from "@/lib/logger";
import { requireBusiness } from "@/lib/api-auth";

function parseDateUTC(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const [, y, mo, d] = m.map(Number);
  return new Date(Date.UTC(y, mo - 1, d));
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireBusiness();
    if ("response" in ctx) return ctx.response;
    const { business } = ctx;

    const dateParam = new URL(request.url).searchParams.get("date");
    if (!dateParam) {
      return NextResponse.json(
        { error: "Parámetro date requerido (YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    const date = parseDateUTC(dateParam);
    if (!date) {
      return NextResponse.json(
        { error: "Formato de fecha inválido. Usá YYYY-MM-DD" },
        { status: 400 }
      );
    }

    const bookings = await prisma.booking.findMany({
      where: { businessId: business.id, date },
      select: {
        id: true,
        startTime: true,
        endTime: true,
        status: true,
        notes: true,
        client: { select: { name: true, whatsapp: true } },
        service: { select: { id: true, name: true, duration: true, price: true } },
      },
      orderBy: { startTime: "asc" },
    });

    return NextResponse.json({ date: dateParam, bookings, total: bookings.length });
  } catch (error) {
    logError("[dashboard/bookings]", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
