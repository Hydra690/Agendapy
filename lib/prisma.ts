import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// En serverless (Vercel) cada función concurrente abre su propio pool. Un `max`
// muy alto por instancia × muchas instancias puede agotar el límite de
// conexiones de Railway/Postgres; uno muy bajo serializa los requests y los hace
// esperar conexión. 10 es un punto medio para una sola DB. Con mucha concurrencia,
// poné un pooler delante (PgBouncer / Prisma Accelerate) y ajustá DATABASE_POOL_MAX.
const POOL_MAX = Number(process.env.DATABASE_POOL_MAX ?? "10");

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
    max: POOL_MAX,
  });
  return new PrismaClient({ adapter });
}

// Reutilizamos el cliente entre invocaciones "calientes" (mismo proceso),
// tanto en dev (evita fugas por hot-reload) como en producción (un pool por
// lambda en vez de uno nuevo por request).
export const prisma = globalForPrisma.prisma ?? createPrismaClient();
globalForPrisma.prisma = prisma;
