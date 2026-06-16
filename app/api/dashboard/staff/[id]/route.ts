import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logError } from "@/lib/logger";
import { requireBusiness } from "@/lib/api-auth";
import { StaffUpdateSchema, formatZodErrors } from "@/lib/validations";

const STAFF_SELECT = {
  id: true,
  name: true,
  role: true,
  phone: true,
  isActive: true,
  createdAt: true,
  services: { select: { id: true, name: true } },
} as const;

async function ownServiceIds(businessId: string, ids: string[] | undefined): Promise<string[]> {
  if (!ids || ids.length === 0) return [];
  const rows = await prisma.service.findMany({
    where: { businessId, id: { in: ids } },
    select: { id: true },
  });
  return rows.map(r => r.id);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireBusiness();
    if ("response" in ctx) return ctx.response;
    const { business } = ctx;

    const { id } = await params;

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
    }
    const parsed = StaffUpdateSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", fields: formatZodErrors(parsed.error.issues) },
        { status: 400 }
      );
    }
    const body = parsed.data;

    const existing = await prisma.staff.findFirst({
      where: { id, businessId: business.id },
      select: { id: true },
    });
    if (!existing) return NextResponse.json({ error: "Profesional no encontrado" }, { status: 404 });

    const staff = await prisma.staff.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.role !== undefined && { role: body.role ?? null }),
        ...(body.phone !== undefined && { phone: body.phone ?? null }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
        // `set` reemplaza el conjunto de servicios del profesional.
        ...(body.serviceIds !== undefined && {
          services: { set: (await ownServiceIds(business.id, body.serviceIds)).map(sid => ({ id: sid })) },
        }),
      },
      select: STAFF_SELECT,
    });

    return NextResponse.json({ staff });
  } catch (error) {
    logError("[dashboard/staff/:id] PATCH", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireBusiness();
    if ("response" in ctx) return ctx.response;
    const { business } = ctx;

    const { id } = await params;

    const existing = await prisma.staff.findFirst({
      where: { id, businessId: business.id },
      select: { id: true },
    });
    if (!existing) return NextResponse.json({ error: "Profesional no encontrado" }, { status: 404 });

    // Soft-delete: desactivar (las reservas históricas mantienen la referencia).
    await prisma.staff.update({ where: { id }, data: { isActive: false } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    logError("[dashboard/staff/:id] DELETE", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
