// Side-effect: carga .env en process.env ANTES de cualquier import que lo use
// (lib/prisma lee DATABASE_URL al inicializarse). Debe importarse primero.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

try {
  const envFile = readFileSync(resolve(process.cwd(), ".env"), "utf8");
  for (const line of envFile.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
} catch {
  console.warn("⚠️  No se pudo leer .env — asumiendo variables ya presentes.");
}
