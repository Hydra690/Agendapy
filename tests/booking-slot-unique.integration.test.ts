// Test de regresión de integración (opt-in, requiere DATABASE_URL_TEST).
//
// Verifica el fix de Tarea 1: con un índice único plano sin filtro de status,
// rebookear un slot con staffId asignado cuyo turno previo quedó CANCELLED chocaba
// P2002 → falso SLOT_TAKEN. Tras dropear ese índice (migración
// 20260622130000_drop_redundant_booking_unique), el rebook debe tener éxito porque
// la unicidad correcta la da el índice parcial WHERE status IN ('PENDING','CONFIRMED').
//
// CI no tiene Postgres: sin DATABASE_URL_TEST el suite entero se SALTA (no finge
// cobertura). Para correrlo de verdad:
//   1) Apuntá DATABASE_URL_TEST a una DB de test con las migraciones aplicadas
//      (npx prisma migrate deploy contra esa DB).
//   2) npx vitest run tests/booking-slot-unique.integration.test.ts
//
// El test crea sus propias entidades con identificadores aleatorios y limpia al
// final, así que es seguro re-correrlo.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { randomBytes } from "crypto";

const TEST_DB_URL = process.env.DATABASE_URL_TEST;
const run = TEST_DB_URL ? describe : describe.skip;

run("Booking slot unique — rebook tras cancelar (con staff)", () => {
  let prisma: PrismaClient;

  const rid = randomBytes(6).toString("hex");
  const ids = {
    userId: "",
    businessId: "",
    serviceId: "",
    staffId: "",
    clientId: "",
  };

  // Un mismo slot concreto: misma fecha + hora + profesional.
  const date = new Date(Date.UTC(2099, 0, 15)); // futuro lejano, sin colisión real
  const startTime = "10:00";
  const endTime = "10:30";

  beforeAll(async () => {
    const adapter = new PrismaPg({ connectionString: TEST_DB_URL! });
    prisma = new PrismaClient({ adapter });

    const user = await prisma.user.create({
      data: { email: `slot-unique-${rid}@test.local`, name: "Owner Test" },
    });
    ids.userId = user.id;

    const business = await prisma.business.create({
      data: {
        name: "Test Biz",
        slug: `test-biz-${rid}`,
        category: "BARBERSHOP",
        ownerId: user.id,
      },
    });
    ids.businessId = business.id;

    const service = await prisma.service.create({
      data: { businessId: business.id, name: "Corte", duration: 30 },
    });
    ids.serviceId = service.id;

    const staff = await prisma.staff.create({
      data: { businessId: business.id, name: "Barbero Test" },
    });
    ids.staffId = staff.id;

    const client = await prisma.client.create({
      data: { businessId: business.id, name: "Cliente Test", whatsapp: `0990${rid}` },
    });
    ids.clientId = client.id;
  });

  afterAll(async () => {
    if (!prisma) return;
    // Orden de borrado por FK (Booking referencia business/service/client con Restrict).
    await prisma.booking.deleteMany({ where: { businessId: ids.businessId } });
    await prisma.client.deleteMany({ where: { businessId: ids.businessId } });
    await prisma.service.deleteMany({ where: { businessId: ids.businessId } });
    await prisma.staff.deleteMany({ where: { businessId: ids.businessId } });
    await prisma.business.deleteMany({ where: { id: ids.businessId } });
    await prisma.user.deleteMany({ where: { id: ids.userId } });
    await prisma.$disconnect();
  });

  it("permite reservar el mismo slot/staff tras cancelar el turno previo", async () => {
    const base = {
      date,
      startTime,
      endTime,
      businessId: ids.businessId,
      serviceId: ids.serviceId,
      staffId: ids.staffId,
      clientId: ids.clientId,
    };

    // 1) Reserva original CONFIRMADA en el slot.
    const first = await prisma.booking.create({
      data: { ...base, status: "CONFIRMED", manageToken: randomBytes(12).toString("base64url") },
    });

    // 2) Se cancela.
    await prisma.booking.update({
      where: { id: first.id },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });

    // 3) Rebook del MISMO slot + MISMO staff. Antes del fix: P2002 (falso SLOT_TAKEN).
    //    Después del fix: éxito, porque el índice parcial excluye la CANCELLED.
    const second = await prisma.booking.create({
      data: { ...base, status: "PENDING", manageToken: randomBytes(12).toString("base64url") },
    });

    expect(second.id).toBeTruthy();
    expect(second.id).not.toBe(first.id);
  });

  it("sigue bloqueando dos reservas ACTIVAS en el mismo slot/staff (P2002)", async () => {
    // Garantía de que el fix NO debilitó la protección real de doble reserva.
    const base = {
      date,
      startTime: "11:00",
      endTime: "11:30",
      businessId: ids.businessId,
      serviceId: ids.serviceId,
      staffId: ids.staffId,
      clientId: ids.clientId,
    };

    await prisma.booking.create({
      data: { ...base, status: "CONFIRMED", manageToken: randomBytes(12).toString("base64url") },
    });

    await expect(
      prisma.booking.create({
        data: { ...base, status: "PENDING", manageToken: randomBytes(12).toString("base64url") },
      })
    ).rejects.toMatchObject({ code: "P2002" });
  });
});
