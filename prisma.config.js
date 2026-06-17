/* eslint-disable @typescript-eslint/no-require-imports -- archivo de config CommonJS que Prisma carga con require */
require("dotenv").config();
const { defineConfig } = require("prisma/config");

module.exports = defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts",
  },
  datasource: {
    // Migraciones: usar DIRECT_URL (conexión directa, sin pooler) si está; si no,
    // caer a DATABASE_URL. En prod (Vercel) DATABASE_URL es pooled y el pooler no
    // soporta los advisory locks de migrate → DIRECT_URL apunta a la URL directa.
    // En dev local DATABASE_URL ya es directa, así que DIRECT_URL no hace falta.
    url: process.env["DIRECT_URL"] || process.env["DATABASE_URL"],
  },
});