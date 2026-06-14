import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { logError } from "@/lib/logger";

function parseDateUTC(dateStr: string): Date | null {
  const parts = dateStr.split("-").map(Number);
  if (parts.length !== 3) return null;
  const [year, month, day] = parts;
  if (!year || !month || !day) return null;
  return new Date(Date.UTC(year, month - 1, day));
}

async function getBusiness(userId: string) {
  return prisma.business.findFirst({ where: { ownerId: userId }, select: { id: true } });
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    const business = await getBusiness(session.user.id);
    if (!business) return NextResponse.json({ error: "Sin negocio" }, { status: 404 });
    const blockedDates = await prisma.blockedDate.findMany({
      where: { businessId: business.id },
      orderBy: { date: "asc" },
      select: { id: true, date: true, reason: true },
    });
    return NextResponse.json({ blockedDates });
  } catch (error) {
    logError("[blocked-dates] GET", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    const business = await getBusiness(session.user.id);
    if (!business) return NextResponse.json({ error: "Sin negocio" }, { status: 404 });

    const { date, reason } = await req.json() as { date: string; reason?: string };
    if (!date) return NextResponse.json({ error: "La fecha es requerida." }, { status: 400 });
    const dateObj = parseDateUTC(date);
    if (!dateObj) return NextResponse.json({ error: "Formato de fecha inválido." }, { status: 400 });

    const blocked = await prisma.blockedDate.create({
      data: { businessId: business.id, date: dateObj, reason: reason?.trim() || null },
      select: { id: true, date: true, reason: true },
    });
    return NextResponse.json({ blockedDate: blocked }, { status: 201 });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "Esa fecha ya está bloqueada." }, { status: 409 });
    }
    logError("[blocked-dates] POST", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    const business = await getBusiness(session.user.id);
    if (!business) return NextResponse.json({ error: "Sin negocio" }, { status: 404 });

    const { id } = await req.json() as { id: string };
    if (!id) return NextResponse.json({ error: "ID requerido." }, { status: 400 });
    await prisma.blockedDate.deleteMany({ where: { id, businessId: business.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    logError("[blocked-dates] DELETE", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
