import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { logError } from "@/lib/logger";
import { BusinessUpdateSchema, formatZodErrors } from "@/lib/validations";

const BUSINESS_SELECT = {
  id: true,
  name: true,
  slug: true,
  category: true,
  description: true,
  address: true,
  phone: true,
  whatsapp: true,
  logoUrl: true,
  coverUrl: true,
  instagram: true,
  facebook: true,
  isActive: true,
  plan: true,
  planExpiry: true,
  trialEndsAt: true,
  _count: {
    select: {
      services: { where: { isActive: true } },
      availability: { where: { isActive: true, staffId: null } },
      bookings: true,
    },
  },
} as const;

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const business = await prisma.business.findFirst({
      where: { ownerId: session.user.id },
      select: BUSINESS_SELECT,
    });

    if (!business) {
      return NextResponse.json({ error: "Sin negocio" }, { status: 404 });
    }

    return NextResponse.json({ business });
  } catch (error) {
    logError("[dashboard/business] GET", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
    }

    const parsed = BusinessUpdateSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", fields: formatZodErrors(parsed.error.issues) },
        { status: 400 }
      );
    }
    const data = parsed.data;

    const business = await prisma.business.findFirst({
      where: { ownerId: session.user.id },
      select: { id: true },
    });

    if (!business) {
      return NextResponse.json({ error: "Sin negocio" }, { status: 404 });
    }

    await prisma.business.update({
      where: { id: business.id },
      data: {
        name: data.name,
        description: data.description ?? null,
        address: data.address ?? null,
        phone: data.phone ?? null,
        whatsapp: data.whatsapp ?? null,
        logoUrl: data.logoUrl ?? null,
        coverUrl: data.coverUrl ?? null,
        instagram: data.instagram ?? null,
        facebook: data.facebook ?? null,
      },
    });

    const updated = await prisma.business.findFirst({
      where: { id: business.id },
      select: BUSINESS_SELECT,
    });

    return NextResponse.json({ business: updated });
  } catch (error) {
    logError("[dashboard/business] PATCH", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
