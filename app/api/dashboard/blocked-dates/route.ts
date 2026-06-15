import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logError } from "@/lib/logger";
import { parseDateUTC } from "@/lib/date";
import { requireBusiness } from "@/lib/api-auth";

export async function GET() {
  try {
    const ctx = await requireBusiness();
    if ("response" in ctx) return ctx.response;
    const { business } = ctx;
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
    const ctx = await requireBusiness();
    if ("response" in ctx) return ctx.response;
    const { business } = ctx;

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
    const ctx = await requireBusiness();
    if ("response" in ctx) return ctx.response;
    const { business } = ctx;

    const { id } = await req.json() as { id: string };
    if (!id) return NextResponse.json({ error: "ID requerido." }, { status: 400 });
    await prisma.blockedDate.deleteMany({ where: { id, businessId: business.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    logError("[blocked-dates] DELETE", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
