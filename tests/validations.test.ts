import { describe, it, expect } from "vitest";
import { BookingSchema, BusinessUpdateSchema, ServiceCreateSchema } from "@/lib/validations";

describe("BookingSchema", () => {
  const valid = {
    serviceIds: ["svc_1"],
    date: "2026-08-14",
    startTime: "10:00",
    clientName: "Juan Pérez",
    clientWhatsapp: "595981123456",
  };
  it("acepta un payload válido", () => {
    expect(BookingSchema.safeParse(valid).success).toBe(true);
  });
  it("acepta varios servicios", () => {
    expect(BookingSchema.safeParse({ ...valid, serviceIds: ["svc_1", "svc_2"] }).success).toBe(true);
  });
  it("rechaza serviceIds vacío", () => {
    expect(BookingSchema.safeParse({ ...valid, serviceIds: [] }).success).toBe(false);
  });
  it("rechaza whatsapp no numérico", () => {
    expect(BookingSchema.safeParse({ ...valid, clientWhatsapp: "09a1" }).success).toBe(false);
  });
  it("rechaza fecha mal formada", () => {
    expect(BookingSchema.safeParse({ ...valid, date: "14-08-2026" }).success).toBe(false);
  });
  it("rechaza nombre demasiado corto", () => {
    expect(BookingSchema.safeParse({ ...valid, clientName: "J" }).success).toBe(false);
  });
});

describe("BusinessUpdateSchema", () => {
  it("normaliza strings vacíos a undefined", () => {
    const r = BusinessUpdateSchema.safeParse({ name: "Barbería", description: "", logoUrl: "" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.description).toBeUndefined();
      expect(r.data.logoUrl).toBeUndefined();
    }
  });
  it("acepta URLs http(s) válidas", () => {
    const r = BusinessUpdateSchema.safeParse({ name: "X", logoUrl: "https://e.com/l.png" });
    expect(r.success).toBe(true);
  });
  it("rechaza una URL inválida", () => {
    expect(BusinessUpdateSchema.safeParse({ name: "X", logoUrl: "no-url" }).success).toBe(false);
  });
  it("requiere nombre", () => {
    expect(BusinessUpdateSchema.safeParse({ name: "  " }).success).toBe(false);
  });
});

describe("ServiceCreateSchema", () => {
  it("coacciona strings numéricos", () => {
    const r = ServiceCreateSchema.safeParse({ name: "Corte", duration: "30", price: "50000" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.duration).toBe(30);
      expect(r.data.price).toBe(50000);
    }
  });
  it("rechaza duración no numérica (NaN)", () => {
    expect(ServiceCreateSchema.safeParse({ name: "Corte", duration: "abc" }).success).toBe(false);
  });
  it("rechaza duración fuera de rango", () => {
    expect(ServiceCreateSchema.safeParse({ name: "Corte", duration: 2 }).success).toBe(false);
  });
});
