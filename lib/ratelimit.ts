// Rate limiter con backend durable opcional.
//
// En Vercel serverless cada invocación puede ser una instancia distinta, así que
// un Map en memoria NO comparte estado entre requests y el límite es inefectivo.
// Si están configuradas las env vars de Upstash Redis (REST), usamos un contador
// atómico compartido (INCR + EXPIRE). Si no, caemos a un Map local — útil en dev
// o en un servidor Node persistente de instancia única.
//
// Env vars (Upstash Redis → REST API). Acepta los dos esquemas de nombres:
//   - UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN (Upstash directo)
//   - KV_REST_API_URL / KV_REST_API_TOKEN (integración Upstash↔Vercel, inyectadas solas)

import { logWarn } from "@/lib/logger";

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

const memStore = new Map<string, { count: number; reset: number }>();

function memLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = memStore.get(key);
  if (!entry || now > entry.reset) {
    memStore.set(key, { count: 1, reset: now + windowMs });
    return false;
  }
  entry.count++;
  return entry.count > limit;
}

async function redisLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<boolean> {
  const windowSec = Math.max(1, Math.ceil(windowMs / 1000));
  const res = await fetch(`${UPSTASH_URL}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      "Content-Type": "application/json",
    },
    // INCR crea/incrementa; EXPIRE ... NX fija el TTL solo la primera vez,
    // de modo que la ventana arranca con el primer request y no se renueva.
    body: JSON.stringify([
      ["INCR", key],
      ["EXPIRE", key, String(windowSec), "NX"],
    ]),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`upstash ${res.status}`);
  const data = (await res.json()) as { result: number | string }[];
  const count = Number(data[0]?.result ?? 0);
  return count > limit;
}

/** Devuelve true si el request debe ser bloqueado (429). Fail-open ante errores. */
export async function isRateLimited(
  key: string,
  limit: number,
  windowMs: number
): Promise<boolean> {
  if (UPSTASH_URL && UPSTASH_TOKEN) {
    try {
      return await redisLimit(key, limit, windowMs);
    } catch (e) {
      // Si Redis no responde, no rompemos el servicio: usamos el limiter local.
      // Fail-open intencional, pero lo dejamos visible: la degradación a memoria
      // hace que el límite sea inefectivo entre instancias serverless.
      logWarn("[ratelimit] Redis no respondió — degradado al limiter en memoria", {
        error: e instanceof Error ? e.message : String(e),
      });
      return memLimit(key, limit, windowMs);
    }
  }
  return memLimit(key, limit, windowMs);
}
