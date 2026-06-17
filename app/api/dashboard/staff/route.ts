import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logError } from "@/lib/logger";
import { requireBusiness, apiError } from "@/lib/api-auth";
import { canUseFeature } from "@/lib/plan";
import { StaffCreateSchema, formatZodErrors } from "@/lib/validations";

const STAFF_SELECT = {
  id: true,
  name: true,
  role: true,
  phone: true,
  isActive: true,
  createdAt: true,
  services: { select: { id: true, name: true } },
} as const;

export async function GET() {
  try {
    const ctx = await requireBusiness();
    if ("response" in ctx) return ctx.response;
    const { business } = ctx;

    const staff = await prisma.staff.findMany({
      where: { businessId: business.id },
      orderBy: { createdAt: "asc" },
      select: STAFF_SELECT,
    });

    return NextResponse.json({ staff });
  } catch (error) {
    logError("[dashboard/staff] GET", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireBusiness();
    if ("response" in ctx) return ctx.response;
    const { business } = ctx;

    // Multi-profesional es feature PRO. No rompe a quien ya tenga staff (el motor
    // sigue leyendo los profesionales existentes); solo frena agregar nuevos.
    if (!canUseFeature(business, "multiStaff")) {
      return apiError.planRequired(
        "multiStaff",
        "La gestión de profesionales está disponible en el plan PRO. Activá PRO para agregar tu equipo."
      );
    }

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
    }
    const parsed = StaffCreateSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", fields: formatZodErrors(parsed.error.issues) },
        { status: 400 }
      );
    }
    const { name, role, phone, serviceIds } = parsed.data;

    // Solo conectamos servicios que pertenecen a ESTE negocio (evita IDOR).
    const validServiceIds = await ownServiceIds(business.id, serviceIds);

    const staff = await prisma.staff.create({
      data: {
        businessId: business.id,
        name,
        role: role ?? null,
        phone: phone ?? null,
        services: { connect: validServiceIds.map(id => ({ id })) },
      },
      select: STAFF_SELECT,
    });

    return NextResponse.json({ staff }, { status: 201 });
  } catch (error) {
    logError("[dashboard/staff] POST", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

/** Filtra los serviceIds a los que realmente son del negocio. */
async function ownServiceIds(businessId: string, ids: string[] | undefined): Promise<string[]> {
  if (!ids || ids.length === 0) return [];
  const rows = await prisma.service.findMany({
    where: { businessId, id: { in: ids } },
    select: { id: true },
  });
  return rows.map(r => r.id);
}
