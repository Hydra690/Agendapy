// Smoke test autenticado del dashboard.
// Registra un usuario, hace login (flujo NextAuth credentials), crea un negocio
// y golpea TODAS las rutas del dashboard esperando 200/201. Limpia todo al final.
//
// Verifica el refactor requireBusiness/requireUserId end-to-end (lo que el
// loadtest público no cubre). Uso: con el dev server corriendo -> npm run smoke

import "./loadenv";
import { prisma } from "../lib/prisma";

const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const ts = Date.now();
const email = `smoketest_${ts}@agendapy.test`;
const password = "Test12345!";
const slug = `smoke-${ts}`;

const cookies: Record<string, string> = {};
const cookieHeader = () => Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; ");

function storeCookies(res: Response) {
  const getSetCookie = (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie;
  const list = getSetCookie ? getSetCookie.call(res.headers) : [];
  for (const c of list) {
    const pair = c.split(";")[0];
    const i = pair.indexOf("=");
    if (i < 0) continue;
    const k = pair.slice(0, i).trim();
    const v = pair.slice(i + 1).trim();
    if (v === "") delete cookies[k];
    else cookies[k] = v;
  }
}

async function req(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(BASE + path, {
    ...init,
    headers: { ...(init.headers || {}), ...(cookieHeader() ? { Cookie: cookieHeader() } : {}) },
    redirect: "manual",
  });
  storeCookies(res);
  return res;
}

const results: { label: string; got: number; expected: number }[] = [];
const check = (label: string, got: number, expected: number) => results.push({ label, got, expected });

async function main() {
  // 1. Registro
  let r = await req("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Smoke", email, password }),
  });
  check("register", r.status, 201);

  // 2. CSRF + login (credentials)
  r = await req("/api/auth/csrf");
  const csrfToken = ((await r.json()) as { csrfToken: string }).csrfToken;
  const form = new URLSearchParams({ csrfToken, email, password, callbackUrl: `${BASE}/dashboard`, json: "true" });
  await req("/api/auth/callback/credentials", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });

  // 3. Sesión activa?
  r = await req("/api/auth/session");
  const session = (await r.json()) as { user?: { email?: string } };
  check("login -> sesión con user", session?.user?.email ? 200 : 0, 200);

  // 4. Onboarding
  r = await req("/api/onboarding", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Smoke Biz", slug, category: "BARBERSHOP" }),
  });
  check("onboarding (crear negocio)", r.status, 201);

  // 5. GETs del dashboard (todos deberían dar 200 con sesión)
  const gets: [string, string][] = [
    ["business", "/api/dashboard/business"],
    ["services", "/api/dashboard/services"],
    ["availability", "/api/dashboard/availability"],
    ["blocked-dates", "/api/dashboard/blocked-dates"],
    ["bookings?date", "/api/dashboard/bookings?date=2026-08-14"],
    ["bookings/month", "/api/dashboard/bookings/month?year=2026&month=8"],
    ["bookings/week", "/api/dashboard/bookings/week?startDate=2026-08-10"],
    ["stats", "/api/dashboard/stats?year=2026&month=8"],
    ["clients", "/api/dashboard/clients"],
    ["reviews", "/api/dashboard/reviews"],
    ["export (trial activo)", "/api/dashboard/export?year=2026&month=8"],
  ];
  for (const [label, path] of gets) {
    const rr = await req(path);
    check(`GET ${label}`, rr.status, 200);
  }

  // 6. Mutaciones
  let rr = await req("/api/dashboard/services", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Corte", duration: 30, price: 50000 }),
  });
  check("POST services", rr.status, 201);

  const schedule = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"].map((d) => ({
    dayOfWeek: d,
    startTime: "08:00",
    endTime: "18:00",
    isActive: d !== "SUNDAY",
  }));
  rr = await req("/api/dashboard/availability", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ schedule }),
  });
  check("PUT availability", rr.status, 200);

  // 7. Gating: sin sesión todo da 401 (limpiamos cookies y probamos 1)
  for (const k of Object.keys(cookies)) delete cookies[k];
  rr = await req("/api/dashboard/business");
  check("GET business SIN sesión -> 401", rr.status, 401);

  // Reporte
  let ok = true;
  for (const { label, got, expected } of results) {
    const pass = got === expected;
    if (!pass) ok = false;
    console.log(`${pass ? "✅" : "❌"} ${label}: ${got} (esperado ${expected})`);
  }

  // Cleanup
  const biz = await prisma.business.findUnique({ where: { slug } });
  if (biz) await prisma.business.delete({ where: { id: biz.id } }); // cascada a service/availability
  await prisma.verificationToken.deleteMany({ where: { identifier: { contains: email } } });
  await prisma.user.deleteMany({ where: { email } });
  console.log("\n🧹 cleanup ok");

  console.log(ok ? "\n🎉 smoke OK" : "\n🔎 revisar fallos");
  process.exit(ok ? 0 : 1);
}

main()
  .catch((e) => {
    console.error("💥", e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
