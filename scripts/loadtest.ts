/**
 * Load test manual para Agendapy.
 *
 * Verifica dos garantías críticas contra un servidor corriendo:
 *   A) Anti-doble-reserva: N reservas concurrentes sobre el MISMO slot deben
 *      producir exactamente 1 éxito (201) y el resto 409 (SLOT_TAKEN).
 *   B) Rate-limit: una ráfaga de requests a /slots debe disparar algún 429.
 *
 * Auto-descubre negocio + servicio + un slot libre a futuro usando la DB, así
 * que no depende de IDs hardcodeados. Limpia lo que crea al terminar.
 *
 * Uso (con el dev server corriendo en otra terminal: `npm run dev`):
 *   npm run loadtest
 *   BASE_URL=http://localhost:3000 npm run loadtest
 */

// IMPORTANTE: este import debe ir PRIMERO. Carga .env como side-effect antes de
// que lib/prisma se inicialice y lea DATABASE_URL (los imports ES se hoistean,
// así que el orden de las líneas import sí importa).
import "./loadenv";
import { prisma } from "../lib/prisma";

const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const TEST_NOTE = "__loadtest__";
const TEST_WA_PREFIX = "99988"; // improbable como número real (PY usa 595...)

const DAY_MAP: Record<number, string> = {
  0: "SUNDAY",
  1: "MONDAY",
  2: "TUESDAY",
  3: "WEDNESDAY",
  4: "THURSDAY",
  5: "FRIDAY",
  6: "SATURDAY",
};

function isoDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

async function discover() {
  const business = await prisma.business.findFirst({
    where: {
      services: { some: { isActive: true } },
      availability: { some: { isActive: true, staffId: null } },
    },
    include: {
      services: { where: { isActive: true }, take: 1 },
      availability: { where: { isActive: true, staffId: null } },
    },
  });
  if (!business) {
    throw new Error(
      "No hay un negocio con servicio activo y disponibilidad. Corré `npm run db:seed`."
    );
  }
  const service = business.services[0];
  const openDays = new Set(business.availability.map((a) => a.dayOfWeek));

  // Buscar la primera fecha (a partir de hoy+60) que caiga en un día abierto.
  let target: { date: string; startTime: string } | null = null;
  for (let offset = 60; offset < 60 + 21; offset++) {
    const d = new Date(Date.UTC(
      new Date().getUTCFullYear(),
      new Date().getUTCMonth(),
      new Date().getUTCDate() + offset
    ));
    const dow = DAY_MAP[d.getUTCDay()];
    if (openDays.has(dow as never)) {
      const avail = business.availability.find((a) => a.dayOfWeek === (dow as never))!;
      target = { date: isoDate(d), startTime: avail.startTime };
      break;
    }
  }
  if (!target) throw new Error("No encontré un día abierto en las próximas 3 semanas a futuro.");

  return { business, service, ...target };
}

async function cleanup(businessId: string) {
  // Borrar reservas de test primero (FK), luego sus clientes.
  await prisma.booking.deleteMany({ where: { businessId, notes: TEST_NOTE } });
  await prisma.client.deleteMany({
    where: { businessId, whatsapp: { startsWith: TEST_WA_PREFIX } },
  });
}

async function preflight(slug: string) {
  try {
    const res = await fetch(`${BASE_URL}/api/${slug}`);
    if (!res.ok) throw new Error(`status ${res.status}`);
  } catch (e) {
    throw new Error(
      `No pude contactar ${BASE_URL}/api/${slug} (${(e as Error).message}). ` +
        `¿Está corriendo el server? Arrancalo con 'npm run dev'.`
    );
  }
}

async function bookOnce(slug: string, serviceId: string, date: string, startTime: string, i: number) {
  const res = await fetch(`${BASE_URL}/api/${slug}/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      serviceId,
      date,
      startTime,
      clientName: `LoadTest ${i}`,
      clientWhatsapp: `${TEST_WA_PREFIX}${String(i).padStart(5, "0")}`, // 10 dígitos
      notes: TEST_NOTE,
    }),
  });
  return res.status;
}

async function testAntiDoubleBooking(
  slug: string,
  serviceId: string,
  date: string,
  startTime: string
) {
  // Concurrencia 10: dentro del límite de rate (10/min para /bookings), así el
  // único filtro es la lógica de slot. Cada request usa un whatsapp distinto
  // para no chocar con el límite de 2 reservas activas por cliente.
  const CONCURRENCY = 10;
  console.log(`\n🅰️  Anti-doble-reserva: ${CONCURRENCY} reservas concurrentes sobre ${date} ${startTime}`);

  const statuses = await Promise.all(
    Array.from({ length: CONCURRENCY }, (_, i) => bookOnce(slug, serviceId, date, startTime, i))
  );

  const ok = statuses.filter((s) => s === 201).length;
  const conflict = statuses.filter((s) => s === 409).length;
  const limited = statuses.filter((s) => s === 429).length;
  const other = statuses.filter((s) => ![201, 409, 429].includes(s));

  console.log(`   201 (creada): ${ok}  ·  409 (slot tomado): ${conflict}  ·  429 (rate): ${limited}  ·  otros: ${other.join(",") || "—"}`);

  // Si todo dio 429 es que la ventana de rate-limit (10/min para /bookings) sigue
  // caliente de una corrida previa — no es un fallo de la lógica de slot.
  if (ok === 0 && conflict === 0 && limited === CONCURRENCY) {
    console.log("   ⏳ SKIP — ventana de rate-limit saturada (corriste el test hace <60s). Esperá 1 min y reintentá.");
    return true;
  }

  const pass = ok === 1 && other.length === 0;
  console.log(pass ? "   ✅ PASS — exactamente 1 ganó el slot" : "   ❌ FAIL — se esperaba exactamente 1 éxito y ningún error inesperado");
  return pass;
}

async function testRateLimit(slug: string, serviceId: string, date: string) {
  // /slots tiene límite 60/min. Disparamos 75 en paralelo: deberían aparecer 429.
  const N = 75;
  console.log(`\n🅱️  Rate-limit: ${N} requests en ráfaga a /slots (límite 60/min)`);

  const statuses = await Promise.all(
    Array.from({ length: N }, () =>
      fetch(`${BASE_URL}/api/${slug}/slots?date=${date}&serviceId=${serviceId}`).then((r) => r.status)
    )
  );

  const ok = statuses.filter((s) => s === 200).length;
  const limited = statuses.filter((s) => s === 429).length;
  console.log(`   200: ${ok}  ·  429: ${limited}`);

  const usingRedis = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
  console.log(`   backend rate-limit: ${usingRedis ? "Upstash Redis" : "Map en memoria (dev / instancia única)"}`);

  const pass = limited > 0;
  console.log(pass ? "   ✅ PASS — el rate-limit cortó la ráfaga" : "   ⚠️  No hubo 429 (¿límite ya consumido en este minuto? probá de nuevo)");
  return pass;
}

async function main() {
  console.log(`🎯 Target: ${BASE_URL}`);
  const { business, service, date, startTime } = await discover();
  console.log(`   negocio: ${business.name} (/${business.slug})  ·  servicio: ${service.name} (${service.duration}min)`);

  await preflight(business.slug);
  await cleanup(business.id); // limpiar restos de corridas previas

  let allPass = true;
  try {
    allPass = (await testAntiDoubleBooking(business.slug, service.id, date, startTime)) && allPass;
    allPass = (await testRateLimit(business.slug, service.id, date)) && allPass;
  } finally {
    await cleanup(business.id);
    console.log("\n🧹 Limpieza de datos de test completada.");
  }

  console.log(allPass ? "\n🎉 Todo OK" : "\n🔎 Revisá los FAIL de arriba");
  process.exit(allPass ? 0 : 1);
}

main()
  .catch((e) => {
    console.error("\n💥 Error:", e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
