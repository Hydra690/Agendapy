import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { logError } from "@/lib/logger";

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

    const body = await req.json() as {
      name?: string;
      description?: string;
      address?: string;
      phone?: string;
      whatsapp?: string;
      logoUrl?: string;
      coverUrl?: string;
      instagram?: string;
      facebook?: string;
    };

    if (!body.name?.trim()) {
      return NextResponse.json({ error: "El nombre es requerido." }, { status: 400 });
    }

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
        name: body.name.trim(),
        description: body.description?.trim() || null,
        address: body.address?.trim() || null,
        phone: body.phone?.trim() || null,
        whatsapp: body.whatsapp?.trim() || null,
        logoUrl: body.logoUrl?.trim() || null,
        coverUrl: body.coverUrl?.trim() || null,
        instagram: body.instagram?.trim() || null,
        facebook: body.facebook?.trim() || null,
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
