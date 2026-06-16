import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

// Mockeamos auth (NextAuth) y prisma para testear la guardia compartida del
// dashboard sin DB ni sesión real. Toda ruta autenticada pasa por estos helpers.
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { business: { findFirst: vi.fn() } } }));

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireUserId, requireBusiness, apiError } from "@/lib/api-auth";

const mockAuth = auth as unknown as Mock;
const mockFindFirst = prisma.business.findFirst as unknown as Mock;

beforeEach(() => vi.clearAllMocks());

describe("requireUserId", () => {
  it("401 sin sesión", async () => {
    mockAuth.mockResolvedValue(null);
    const r = await requireUserId();
    if (!("response" in r)) throw new Error("esperaba response");
    expect(r.response.status).toBe(401);
  });

  it("401 si la sesión no trae user.id", async () => {
    mockAuth.mockResolvedValue({ user: {} });
    const r = await requireUserId();
    expect("response" in r).toBe(true);
  });

  it("devuelve userId con sesión válida", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    const r = await requireUserId();
    expect(r).toEqual({ userId: "u1" });
  });
});

describe("requireBusiness", () => {
  it("401 sin sesión (no consulta la DB)", async () => {
    mockAuth.mockResolvedValue(null);
    const r = await requireBusiness();
    if (!("response" in r)) throw new Error("esperaba response");
    expect(r.response.status).toBe(401);
    expect(mockFindFirst).not.toHaveBeenCalled();
  });

  it("404 con sesión pero sin negocio", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockFindFirst.mockResolvedValue(null);
    const r = await requireBusiness();
    if (!("response" in r)) throw new Error("esperaba response");
    expect(r.response.status).toBe(404);
  });

  it("devuelve business + userId cuando existe", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockFindFirst.mockResolvedValue({
      id: "b1", plan: "FREE", planExpiry: null, trialEndsAt: null, timezone: "America/Asuncion",
    });
    const r = await requireBusiness();
    if ("response" in r) throw new Error("no esperaba response");
    expect(r.business.id).toBe("b1");
    expect(r.userId).toBe("u1");
    // El negocio se busca por ownerId del usuario autenticado (scoping anti-IDOR).
    expect(mockFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { ownerId: "u1" } }));
  });
});

describe("apiError.planRequired", () => {
  it("403 con upgrade:true, feature y mensaje", async () => {
    const res = apiError.planRequired("export", "Activá tu plan");
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toMatchObject({ error: "Plan requerido", upgrade: true, feature: "export", message: "Activá tu plan" });
  });
});
