import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MyBookingsQuerySchema, formatZodErrors } from "@/lib/validations";
import { logError } from "@/lib/logger";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(request.url);
    const parsed = MyBookingsQuerySchema.safeParse({
      whatsapp: searchParams.get("whatsapp") ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Parámetros inválidos", fields: formatZodErrors(parsed.error.issues) },
        { status: 400 }
      );
    }
    const { whatsapp } = parsed.data;

    const business = await prisma.business.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!business) {
      return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 });
    }

    const bookings = await prisma.booking.findMany({
      where: {
        businessId: business.id,
        client: { whatsapp },
        status: { in: ["PENDING", "CONFIRMED"] },
      },
      select: {
        id: true,
        date: true,
        startTime: true,
        endTime: true,
        status: true,
        service: { select: { name: true, price: true } },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });

    return NextResponse.json({ bookings });
  } catch (error) {
    logError("[my-bookings]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
