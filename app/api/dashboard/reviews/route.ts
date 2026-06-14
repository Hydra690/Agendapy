import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { logError } from "@/lib/logger";

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

    const reviews = await prisma.review.findMany({
      where: { businessId: business.id },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ reviews });
  } catch (error) {
    logError("[dashboard/reviews] GET", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await request.json() as { id: string; action: "APPROVE" | "REJECT" };

    if (!body.id || !["APPROVE", "REJECT"].includes(body.action)) {
      return NextResponse.json(
        { error: "Se requiere id y action (APPROVE|REJECT)" },
        { status: 400 }
      );
    }

    const business = await prisma.business.findFirst({
      where: { ownerId: session.user.id },
      select: { id: true },
    });

    if (!business) {
      return NextResponse.json({ error: "Sin negocio" }, { status: 404 });
    }

    const existing = await prisma.review.findFirst({
      where: { id: body.id, businessId: business.id },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Reseña no encontrada" }, { status: 404 });
    }

    const updated = await prisma.review.update({
      where: { id: body.id },
      data: { status: body.action === "APPROVE" ? "APPROVED" : "REJECTED" },
    });

    return NextResponse.json({ review: updated });
  } catch (error) {
    logError("[dashboard/reviews] PATCH", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
