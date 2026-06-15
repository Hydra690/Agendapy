import { describe, it, expect } from "vitest";
import { parseDateUTC, addMinutes, dateToISODate } from "@/lib/date";

describe("parseDateUTC", () => {
  it("parsea una fecha válida a medianoche UTC", () => {
    const d = parseDateUTC("2026-08-14");
    expect(d?.toISOString()).toBe("2026-08-14T00:00:00.000Z");
  });

  it("rechaza formato inválido", () => {
    expect(parseDateUTC("2026-8-14")).toBeNull();
    expect(parseDateUTC("14/08/2026")).toBeNull();
    expect(parseDateUTC("")).toBeNull();
  });

  it("rechaza fechas calendario imposibles", () => {
    expect(parseDateUTC("2026-02-31")).toBeNull();
    expect(parseDateUTC("2026-13-01")).toBeNull();
    expect(parseDateUTC("2026-00-10")).toBeNull();
  });
});

describe("addMinutes", () => {
  it("suma dentro de la hora", () => {
    expect(addMinutes("10:00", 30)).toBe("10:30");
    expect(addMinutes("10:45", 30)).toBe("11:15");
  });
  it("envuelve a 24h", () => {
    expect(addMinutes("23:45", 30)).toBe("00:15");
  });
});

describe("dateToISODate", () => {
  it("devuelve YYYY-MM-DD en UTC", () => {
    expect(dateToISODate(new Date("2026-08-14T00:00:00.000Z"))).toBe("2026-08-14");
  });
});

// Solapamiento de rangos [start,end): la lógica que usan slots y bookings.
describe("solapamiento de rangos horarios", () => {
  const overlaps = (aStart: string, aEnd: string, bStart: string, bEnd: string) =>
    aStart < bEnd && aEnd > bStart;

  it("detecta solape de servicios de distinta duración", () => {
    // existente 10:00-11:00 (60min) vs nuevo 10:30-11:00 (30min)
    expect(overlaps("10:00", "11:00", "10:30", "11:00")).toBe(true);
  });
  it("no marca solape cuando son adyacentes", () => {
    // 10:00-10:30 y 10:30-11:00 no se pisan
    expect(overlaps("10:00", "10:30", "10:30", "11:00")).toBe(false);
  });
});
