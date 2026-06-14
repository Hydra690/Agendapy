import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { logError } from "@/lib/logger";

const VALID_CATEGORIES = [
  "BARBERSHOP", "BEAUTY_SALON", "VETERINARY", "PSYCHOLOGY",
  "DENTISTRY", "MEDICINE", "FITNESS", "PHOTOGRAPHY",
  "TUTORING", "MASSAGE", "OTHER",
] as const;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
    }

    const { name, slug, category, whatsapp } = body as Record<string, unknown>;

    if (typeof name !== "string" || name.trim().length < 2) {
      return NextResponse.json(
        { error: "El nombre debe tener al menos 2 caracteres" },
        { status: 400 }
      );
    }
    if (typeof slug !== "string" || slug.trim().length < 2) {
      return NextResponse.json({ error: "Slug inválido" }, { status: 400 });
    }
    if (!VALID_CATEGORIES.includes(category as (typeof VALID_CATEGORIES)[number])) {
      return NextResponse.json({ error: "Categoría inválida" }, { status: 400 });
    }

    const finalSlug = slugify(slug);

    const existing = await prisma.business.findUnique({
      where: { slug: finalSlug },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Este nombre ya está registrado. Probá con una variación." },
        { status: 409 }
      );
    }

    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 30);

    const business = await prisma.business.create({
      data: {
        name: name.trim(),
        slug: finalSlug,
        category: category as (typeof VALID_CATEGORIES)[number],
        whatsapp: typeof whatsapp === "string" ? whatsapp.trim() || null : null,
        ownerId: session.user.id,
        trialEndsAt,
      },
    });

    return NextResponse.json({ business }, { status: 201 });
  } catch (error) {
    logError("[onboarding]", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
