import { describe, it, expect } from "vitest";
import { generateSlots, rangesOverlap, availableSlots, dayOfWeekUTC, canCancelNow, cancellationDeadline } from "@/lib/booking";

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

describe("cancelación: deadline y ventana", () => {
  const appt = new Date("2026-08-14T15:00:00Z");

  it("el deadline es windowHours antes del turno", () => {
    expect(cancellationDeadline(appt, 2).toISOString()).toBe("2026-08-14T13:00:00.000Z");
    expect(cancellationDeadline(appt, 0).toISOString()).toBe("2026-08-14T15:00:00.000Z");
  });

  it("permite cancelar antes del deadline", () => {
    expect(canCancelNow(appt, 2, new Date("2026-08-14T12:59:00Z"))).toBe(true);
  });

  it("justo en el deadline todavía permite (límite inclusivo)", () => {
    expect(canCancelNow(appt, 2, new Date("2026-08-14T13:00:00Z"))).toBe(true);
  });

  it("rechaza pasado el deadline", () => {
    expect(canCancelNow(appt, 2, new Date("2026-08-14T13:00:01Z"))).toBe(false);
  });

  it("windowHours=0 permite hasta el mismo turno pero no después", () => {
    expect(canCancelNow(appt, 0, new Date("2026-08-14T15:00:00Z"))).toBe(true);
    expect(canCancelNow(appt, 0, new Date("2026-08-14T15:00:01Z"))).toBe(false);
  });
});
