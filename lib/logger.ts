export function logError(
  context: string,
  error: unknown,
  meta?: Record<string, unknown>
) {
  console.error(
    JSON.stringify({
      level: "error",
      timestamp: new Date().toISOString(),
      context,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      ...meta,
    })
  );
}

export function logInfo(context: string, meta?: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      level: "info",
      timestamp: new Date().toISOString(),
      context,
      ...meta,
    })
  );
}
