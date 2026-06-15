// Logging estructurado a consola (Vercel lo captura) + sink externo opcional.
//
// Si LOG_SINK_URL está seteada, los errores se envían también a ese endpoint
// (webhook/colector JSON, p.ej. un proyecto de Sentry vía su ingest, Logtail, etc.)
// de forma fire-and-forget. Sin la env, el comportamiento es idéntico al anterior:
// solo console. Así se gana alerting sin imponer una dependencia.

const SINK_URL = process.env.LOG_SINK_URL;
const SINK_TOKEN = process.env.LOG_SINK_TOKEN;

type Level = "error" | "info" | "warn";

function emit(level: Level, payload: Record<string, unknown>) {
  const record = { level, timestamp: new Date().toISOString(), ...payload };
  const line = JSON.stringify(record);

  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);

  // Solo mandamos errores/warns al sink para no inundarlo con info.
  if (SINK_URL && level !== "info") {
    void shipToSink(record);
  }
}

async function shipToSink(record: Record<string, unknown>) {
  try {
    await fetch(SINK_URL!, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(SINK_TOKEN ? { Authorization: `Bearer ${SINK_TOKEN}` } : {}),
      },
      body: JSON.stringify(record),
      cache: "no-store",
    });
  } catch {
    // El sink nunca debe romper el request. Silenciado a propósito.
  }
}

export function logError(
  context: string,
  error: unknown,
  meta?: Record<string, unknown>
) {
  emit("error", {
    context,
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    ...meta,
  });
}

export function logWarn(context: string, meta?: Record<string, unknown>) {
  emit("warn", { context, ...meta });
}

export function logInfo(context: string, meta?: Record<string, unknown>) {
  emit("info", { context, ...meta });
}
