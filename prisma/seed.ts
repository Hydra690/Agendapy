import "dotenv/config";
import { PrismaClient, DayOfWeek } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Sembrando datos de prueba...");

  const owner = await prisma.user.upsert({
    where: { email: "demo@agendapy.com" },
    update: {},
    create: {
      email: "demo@agendapy.com",
      name: "Demo Owner",
    },
  });

  const business = await prisma.business.upsert({
    where: { slug: "barberia-demo" },
    update: {},
    create: {
      name: "Barbería Demo",
      slug: "barberia-demo",
      category: "BARBERSHOP",
      whatsapp: "595981000000",
      timezone: "America/Asuncion",
      ownerId: owner.id,
    },
  });

  // Idempotente: buscar por nombre+negocio antes de crear
  let service = await prisma.service.findFirst({
    where: { businessId: business.id, name: "Corte de cabello" },
  });
  if (!service) {
    service = await prisma.service.create({
      data: {
        name: "Corte de cabello",
        duration: 30,
        price: 50000,
        businessId: business.id,
      },
    });
  }

  // Borrar y recrear disponibilidad para evitar el problema de upsert con staffId null
  const days: DayOfWeek[] = [
    DayOfWeek.MONDAY,
    DayOfWeek.TUESDAY,
    DayOfWeek.WEDNESDAY,
    DayOfWeek.THURSDAY,
    DayOfWeek.FRIDAY,
    DayOfWeek.SATURDAY,
  ];

  await prisma.availability.deleteMany({
    where: { businessId: business.id, staffId: null },
  });

  await prisma.availability.createMany({
    data: days.map((day) => ({
      businessId: business.id,
      dayOfWeek: day,
      startTime: "08:00",
      endTime: "18:00",
    })),
  });

  console.log("✅ Datos creados:");
  console.log(`   Usuario: ${owner.email}`);
  console.log(`   Negocio: ${business.name} (slug: ${business.slug})`);
  console.log(`   Servicio: ${service.name} (id: ${service.id})`);
  console.log(`   Disponibilidad: Lunes a Sábado 08:00 - 18:00`);
  console.log("");
  console.log("👉 Guardá el service.id para testear el endpoint:");
  console.log(`   ${service.id}`);
}

main()
  .catch((e) => {
    console.error("❌ Error en el seed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
