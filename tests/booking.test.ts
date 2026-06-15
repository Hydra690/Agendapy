import { describe, it, expect } from "vitest";
import { generateSlots, rangesOverlap, availableSlots, dayOfWeekUTC } from "@/lib/booking";

describe("generateSlots", () => {
  it("genera pasos de la duración dentro del intervalo", () => {
    expect(generateSlots("08:00", "10:00", 30)).toEqual(["08:00", "08:30", "09:00", "09:30"]);
  });
  it("no genera un slot que no entra completo antes del cierre", () => {
    expect(generateSlots("08:00", "09:00", 45)).toEqual(["08:00"]);
  });
  it("devuelve vacío con duración inválida", () => {
    expect(generateSlots("08:00", "18:00", 0)).toEqual([]);
  });
});

describe("rangesOverlap", () => {
  it("solape de distinta duración", () => {
    expect(rangesOverlap("10:30", "11:00", "10:00", "11:00")).toBe(true);
  });
  it("adyacentes no se pisan", () => {
    expect(rangesOverlap("10:30", "11:00", "10:00", "10:30")).toBe(false);
  });
});

describe("availableSlots", () => {
  it("descarta los slots pisados por una reserva más larga", () => {
    // Negocio 08:00-10:00, servicio 30min. Reserva existente 08:00-09:00 (60min).
    const slots = availableSlots({ startTime: "08:00", endTime: "10:00" }, 30, [
      { startTime: "08:00", endTime: "09:00" },
    ]);
    // 08:00 y 08:30 quedan pisados; 09:00 y 09:30 libres.
    expect(slots).toEqual(["09:00", "09:30"]);
  });
  it("sin reservas, devuelve todos", () => {
    expect(availableSlots({ startTime: "08:00", endTime: "09:00" }, 30, [])).toEqual(["08:00", "08:30"]);
  });
});

describe("dayOfWeekUTC", () => {
  it("mapea correctamente", () => {
    expect(dayOfWeekUTC(new Date("2026-08-14T00:00:00Z"))).toBe("FRIDAY"); // 2026-08-14 es viernes
    expect(dayOfWeekUTC(new Date("2026-08-16T00:00:00Z"))).toBe("SUNDAY");
  });
});
