// Logging estructurado a consola (Vercel lo captura) + alerta a un webhook opcional.
//
// Si LOG_SINK_URL está seteada, los errores/warns se envían también a ese endpoint.
// Auto-detecta Slack/Discord (incoming webhooks) y manda un mensaje legible; con
// cualquier otra URL manda el registro JSON crudo (colector tipo Logtail, etc.).
// Sin la env, el comportamiento es idéntico al anterior: solo console.
//
// A diferencia de antes, la entrega al sink NO se silencia: si falla (timeout, 4xx/5xx,
// red), se loguea a consola (sin re-enviar al sink, para no entrar en loop). Sigue
// siendo fire-and-forget para no bloquear el request.

const SINK_URL = process.env.LOG_SINK_URL;
const SINK_TOKEN = process.env.LOG_SINK_TOKEN;
const SINK_TIMEOUT_MS = 3000;

type Level = "error" | "info" | "warn";

export type SinkFormat = "json" | "slack" | "discord";

/** Formato del sink: override por env, o auto-detectado por el host del webhook. */
export function detectSinkFormat(url: string, override?: string): SinkFormat {
  if (override === "slack" || override === "discord" || override === "json") return override;
  if (url.includes("hooks.slack.com")) return "slack";
  if (url.includes("discord.com/api/webhooks") || url.includes("discordapp.com/api/webhooks")) return "discord";
  return "json";
}

/** Cuerpo a enviar al sink. JSON crudo para colectores; texto legible para Slack/Discord. */
export function formatSinkBody(record: Record<string, unknown>, format: SinkFormat): string {
  if (format === "json") return JSON.stringify(record);

  const level = String(record.level ?? "info");
  const emoji = level === "error" ? "🔴" : "🟠";
  const lines = [`${emoji} ${level.toUpperCase()} · ${record.context ?? ""}`.trim()];
  if (record.error) lines.push(String(record.error));

  const meta: Record<string, unknown> = { ...record };
  for (const k of ["level", "timestamp", "context", "error", "stack"]) delete meta[k];
  if (Object.keys(meta).length) lines.push("`" + JSON.stringify(meta) + "`");

  // Discord corta en 2000 chars; dejamos margen.
  const text = lines.join("\n").slice(0, 1900);
  return JSON.stringify(format === "slack" ? { text } : { content: text });
}

function emit(level: Level, payload: Record<string, unknown>) {
  const record = { level, timestamp: new Date().toISOString(), ...payload };
  const line = JSON.stringify(record);

  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);

  // Solo mandamos errores/warns al sink para no inundarlo con info.
  if (SINK_URL && level !== "info") {
    void shipToSink(SINK_URL, record);
  }
}

async function shipToSink(url: string, record: Record<string, unknown>) {
  const format = detectSinkFormat(url, process.env.LOG_SINK_FORMAT);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SINK_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // El token solo aplica a colectores genéricos; Slack/Discord usan la URL como secreto.
        ...(SINK_TOKEN && format === "json" ? { Authorization: `Bearer ${SINK_TOKEN}` } : {}),
      },
      body: formatSinkBody(record, format),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`sink respondió ${res.status}`);
  } catch (e) {
    // El sink nunca debe romper el request, pero el FALLO DE ENTREGA debe ser visible
    // (no lo re-enviamos al sink para no entrar en loop).
    console.error(
      JSON.stringify({
        level: "error",
        timestamp: new Date().toISOString(),
        context: "[logger] entrega al sink de alertas falló",
        error: e instanceof Error ? e.message : String(e),
      })
    );
  } finally {
    clearTimeout(timer);
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
