import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logError } from "@/lib/logger";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const business = await prisma.business.findUnique({
      where: { slug },
      include: {
        services: {
          where: { isActive: true },
          select: { id: true, name: true, description: true, duration: true, price: true },
          orderBy: { name: "asc" },
        },
        availability: {
          where: { isActive: true, staffId: null },
          select: { dayOfWeek: true, startTime: true, endTime: true },
          orderBy: { dayOfWeek: "asc" },
        },
        staff: {
          where: { isActive: true },
          select: { id: true, name: true, role: true, services: { select: { id: true } } },
          orderBy: { createdAt: "asc" },
        },
        reviews: {
          where: { status: "APPROVED" },
          select: { id: true, reviewerName: true, text: true, rating: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!business || !business.isActive) {
      return NextResponse.json(
        { error: "Negocio no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      name: business.name,
      slug: business.slug,
      category: business.category,
      description: business.description,
      address: business.address,
      phone: business.phone,
      whatsapp: business.whatsapp,
      logoUrl: business.logoUrl,
      coverUrl: business.coverUrl,
      instagram: business.instagram,
      facebook: business.facebook,
      services: business.services,
      availability: business.availability,
      staff: business.staff.map((s) => ({
        id: s.id,
        name: s.name,
        role: s.role,
        serviceIds: s.services.map((x) => x.id),
      })),
      reviews: business.reviews,
    });
  } catch (error) {
    logError("[business]", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
