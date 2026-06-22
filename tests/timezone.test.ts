import { describe, it, expect } from "vitest";
import { ymdInTz, addDaysYmd, tomorrowRange, ymdToUtcDate, zonedToUtc, meetsBookingNotice, filterSlotsByNotice } from "@/lib/timezone";

// Usamos zonas de offset fijo (Etc/GMT+N = UTC-N) para evitar ambigüedad de DST.
describe("ymdInTz", () => {
  it("usa UTC correctamente", () => {
    expect(ymdInTz(new Date("2026-06-15T10:00:00Z"), "UTC")).toBe("2026-06-15");
  });

  it("corre el día hacia atrás cerca de medianoche en una tz con offset negativo", () => {
    // 02:00 UTC en UTC-5 = 21:00 del día anterior
    expect(ymdInTz(new Date("2026-06-15T02:00:00Z"), "Etc/GMT+5")).toBe("2026-06-14");
  });
});

describe("addDaysYmd", () => {
  it("cruza fin de mes y año", () => {
    expect(addDaysYmd("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysYmd("2026-02-28", 1)).toBe("2026-03-01"); // 2026 no bisiesto
    expect(addDaysYmd("2026-08-14", -1)).toBe("2026-08-13");
  });
});

describe("ymdToUtcDate", () => {
  it("es medianoche UTC del día calendario", () => {
    expect(ymdToUtcDate("2026-08-16").toISOString()).toBe("2026-08-16T00:00:00.000Z");
  });
});

describe("zonedToUtc", () => {
  it("convierte hora de pared en UTC a UTC sin corrimiento", () => {
    expect(zonedToUtc("2026-08-14", "15:00", "UTC").toISOString()).toBe("2026-08-14T15:00:00.000Z");
  });

  it("aplica el offset de una tz UTC-3 (Etc/GMT+3)", () => {
    // 15:00 en UTC-3 = 18:00 UTC
    expect(zonedToUtc("2026-08-14", "15:00", "Etc/GMT+3").toISOString()).toBe("2026-08-14T18:00:00.000Z");
  });

  it("America/Asuncion (UTC-3, sin DST desde 2024) = 18:00 UTC", () => {
    expect(zonedToUtc("2026-08-14", "15:00", "America/Asuncion").toISOString()).toBe("2026-08-14T18:00:00.000Z");
  });
});

describe("meetsBookingNotice", () => {
  // Negocio en UTC-3 (America/Asuncion). "Ahora" = 14:00 hora local (17:00 UTC).
  const tz = "America/Asuncion";
  const now = new Date("2026-08-14T17:00:00Z"); // 14:00 local

  it("rechaza un horario ya pasado de hoy (notice=0)", () => {
    expect(meetsBookingNotice("2026-08-14", "10:00", 0, tz, now)).toBe(false);
  });

  it("acepta un horario futuro de hoy (notice=0)", () => {
    expect(meetsBookingNotice("2026-08-14", "16:00", 0, tz, now)).toBe(true);
  });

  it("acepta el horario exactamente igual a ahora (notice=0)", () => {
    expect(meetsBookingNotice("2026-08-14", "14:00", 0, tz, now)).toBe(true);
  });

  it("aplica el colchón: con 120min, 15:00 (1h) se rechaza y 16:30 (2.5h) se acepta", () => {
    expect(meetsBookingNotice("2026-08-14", "15:00", 120, tz, now)).toBe(false);
    expect(meetsBookingNotice("2026-08-14", "16:30", 120, tz, now)).toBe(true);
  });

  it("el colchón cruza el día: con 24h, las 08:00 de mañana (faltan <24h) se rechazan", () => {
    expect(meetsBookingNotice("2026-08-15", "08:00", 1440, tz, now)).toBe(false);
  });

  it("no descarta nada en una fecha suficientemente lejana", () => {
    expect(meetsBookingNotice("2026-09-01", "08:00", 1440, tz, now)).toBe(true);
  });
});

describe("filterSlotsByNotice", () => {
  const tz = "America/Asuncion";
  const now = new Date("2026-08-14T17:00:00Z"); // 14:00 local

  it("oculta los horarios pasados del día y conserva los futuros", () => {
    const slots = ["09:00", "13:00", "14:00", "15:00", "18:00"];
    expect(filterSlotsByNotice("2026-08-14", slots, 0, tz, now)).toEqual(["14:00", "15:00", "18:00"]);
  });

  it("con colchón de 60min recorta también la próxima hora", () => {
    const slots = ["14:00", "14:30", "15:00", "16:00"];
    expect(filterSlotsByNotice("2026-08-14", slots, 60, tz, now)).toEqual(["15:00", "16:00"]);
  });
});

describe("tomorrowRange", () => {
  it("calcula mañana en UTC", () => {
    const r = tomorrowRange("UTC", new Date("2026-06-15T10:00:00Z"));
    expect(r.ymd).toBe("2026-06-16");
    expect(r.start.toISOString()).toBe("2026-06-16T00:00:00.000Z");
    expect(r.end.toISOString()).toBe("2026-06-17T00:00:00.000Z");
  });

  it("respeta la tz del negocio cerca de medianoche", () => {
    // 01:00 UTC del 15 → en UTC-3 son las 22:00 del 14 → mañana = 15
    const r = tomorrowRange("Etc/GMT+3", new Date("2026-06-15T01:00:00Z"));
    expect(r.ymd).toBe("2026-06-15");
  });
});
