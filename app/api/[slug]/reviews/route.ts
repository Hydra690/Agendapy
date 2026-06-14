import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logError } from "@/lib/logger";
import { z } from "zod";
import { formatZodErrors } from "@/lib/validations";

const ReviewSchema = z.object({
  reviewerName: z.string().min(2, "El nombre debe tener al menos 2 caracteres").max(100).trim(),
  text: z.string().min(10, "El testimonio debe tener al menos 10 caracteres").max(500).trim(),
  rating: z.number().int().min(1, "El rating mínimo es 1").max(5, "El rating máximo es 5"),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const business = await prisma.business.findUnique({
      where: { slug },
      select: { id: true, isActive: true },
    });

    if (!business || !business.isActive) {
      return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
    }

    const result = ReviewSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Datos inválidos", fields: formatZodErrors(result.error.issues) },
        { status: 400 }
      );
    }

    const { reviewerName, text, rating } = result.data;

    await prisma.review.create({
      data: { businessId: business.id, reviewerName, text, rating },
    });

    return NextResponse.json(
      { message: "¡Gracias! Tu testimonio será visible una vez que sea aprobado." },
      { status: 201 }
    );
  } catch (error) {
    logError("[reviews:POST]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
